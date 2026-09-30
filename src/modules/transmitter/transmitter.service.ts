/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// подписка на обновление волкей

// отправка сообщений в формате json.stringify по mqtt

import {
  Inject,
  Injectable,
  Logger,
  LoggerService,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ValkeyService } from '../valkey/valkey.service';
import { addContextDecoratorLogger } from 'src/infrastructure/logger/context.decorator.logger';
import { MqttService } from '../mqtt/mqtt.service';
import { ValkeyItemType } from 'src/types/ValkeyItem.type';
import { removeForbiddenSymbols } from 'src/helpers/removeForbiddenSymbols.helpler';
import { convertValue } from 'src/helpers/convertValue.helper';
import { TRANSLATION_DATA_TYPES } from 'src/constants/translationDataTypes';
import { CacheService } from '../cache/cache.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { M500Service } from '../postgres/m500.service';
import { OutGoingMessage } from 'src/types/OutGoingMessage.type';
import { echolotAliasList } from 'src/constants/echolotAliasList';
import { MessageRetryService } from '../message-retry/message-retry.service';
import { buildMqttTopic } from 'src/helpers/buildMqttTopic.helper';
import { CRON_CONFIG } from 'src/cron.config';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class TransmitterService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private channel: string;

  constructor(
    @Inject(Logger) private readonly logger: LoggerService,
    private readonly cacheService: CacheService,
    private readonly valkeyService: ValkeyService,
    private readonly mqttService: MqttService,
    private readonly systemConfig: SystemConfigService,
    private readonly m500Service: M500Service,
    private readonly messageRetryService: MessageRetryService,
  ) {
    this.logger = addContextDecoratorLogger(logger, TransmitterService.name);
    this.channel = `__keyevent@${this.systemConfig.valkeyConfig.db}__:set`;
  }

  async onApplicationBootstrap(): Promise<void> {
    await Promise.all([this.cacheService.waitTimerUntilAllCacheIsLoaded()])
      .then(async () => {
        await this.initMessages();
        // После завершения обоих методов вызываем handleSubscribeItemsToValkey()
        await this.handleSubscribeItemsToValkey();
        this.cacheService.subscribeToUpdateCacheEvent(async () => {
          try {
            await this.initMessages();
          } catch (error) {
            this.logger.error(`(onModuleInit) error`);
            this.logger.error(error);
            throw error;
          }
        });
      })
      .catch((e: Error) => {
        this.logger.error(`(onModuleInit) error`);
        this.logger.error(e);
        throw e;
      });
  }

  @Cron(CRON_CONFIG.CRON_SEND_ALL_TRANSMITTER_MESSAGES)
  async initMessages() {
    await this.cacheService.waitTimerUntilAllCacheIsLoaded();

    const availableSatps = await this.m500Service.getAvailableAliases();

    const listOfAllDevices = this.cacheService.getAllDeviceAndSatpId();
    const devicesAndSatpIdThatHaveModems = listOfAllDevices.filter((i) => {
      return !!this.cacheService.getModemIdByDeviceId(i.device_id);
    });

    await Promise.all(
      devicesAndSatpIdThatHaveModems.flatMap(({ device_id, satp_id }) => {
        const targetAlias = availableSatps.filter(
          (x) => x.server_alias_template_id === satp_id,
        );

        const targetTask = targetAlias.map(async ({ alias }) => {
          const deviceAliasKey = `device/${device_id}/${alias}`;
          const value = await this.valkeyService.getValueByKey(deviceAliasKey);
          if (value === null) {
            return;
          }
          await this.proccessIRZtoNISData({
            key: deviceAliasKey,
            data: value,
          });
        });

        return targetTask;
      }),
    );

    // for (const { alias } of availableSatps) {
    //   try {
    //     const values = await this.valkeyService.getValuesBySuffix(alias);

    //     for (const { key, value } of values) {
    //       try {
    //         await this.proccessIRZtoNISData({
    //           key,
    //           data: value,
    //         });
    //       } catch (e) {
    //         this.logger.error(e);
    //       }
    //     }
    //   } catch (e) {
    //     this.logger.error(e);
    //   }
    // }

    this.logger.log(`(initMessages) all messages data was inited`);
  }

  // Подписка на изменения Valkey
  async handleSubscribeItemsToValkey(): Promise<void> {
    //!REVIEW рекомендую такие callback выносить в отдельную функцию
    try {
      await this.valkeyService.subscribeToChanges(this.channel, async (key) => {
        const cacheIsUpdated = this.cacheService.checkCacheUpdate();

        if (!cacheIsUpdated) {
          return;
        }

        const data: ValkeyItemType | null =
          await this.valkeyService.getValueByKey(key);

        // only for trace
        // this.logger.log(`(subscribeToChanges) data: ${JSON.stringify(data)}`);
        if (!data) {
          return;
        }

        if (data.alias === undefined) {
          return;
        }
        // only for trace
        // this.logger.log({ mqttTopic, value, dataType });
        await this.proccessIRZtoNISData({ data, key });
      });
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }

  async proccessIRZtoNISData({
    data,
    key,
  }: {
    data: ValkeyItemType;
    key: string;
  }) {
    if (data.alias === undefined) {
      return;
    }

    const varNumTypeNumber = this.cacheService.getVarNumTypeByAlias(data.alias);

    if (varNumTypeNumber === undefined) {
      // this.logger.error(
      //   `(proccessIRZToNISData) column (varNumTypeNumber) undefined for: ${JSON.stringify(data)}`,
      // );
      return;
    }

    // сделать проверку на data.dt, что он валидный и выдает валидную дату
    const dateTime = new Date(data.dt);
    if (isNaN(dateTime.valueOf()) === true) {
      this.logger.error(
        `(proccessIRZToNISData) isNaN(dateTime.valueOf()) error ${JSON.stringify(data)} for:  ${JSON.stringify(data)}`,
      );
      return;
    }
    const timestamp = dateTime.toISOString();
    const dirtyValue = data.value ?? data.value_bool ?? data.value_string;

    const serverParameter = this.cacheService.getServerParameterByAlias(
      data.alias,
    );
    if (serverParameter === undefined) {
      this.logger.error(
        `(proccessIRZToNISData) column (serverParameter) undefined for: ${JSON.stringify(data)}`,
      );
      return;
    }

    const dataType = serverParameter?.server_data_type_id;

    if (dataType === undefined) {
      this.logger.error(
        `(proccessIRZToNISData) column (dataType) undefined for: ${JSON.stringify(data)}`,
      );
      return;
    }

    let value: number | string | boolean | undefined = undefined;

    // !REVIEW Эту логику имеет смысл перенести внутри convertValue
    if (
      TRANSLATION_DATA_TYPES.includes(dataType) &&
      typeof dirtyValue === 'string'
    ) {
      value = this.cacheService.getTranslationByWord(dirtyValue) ?? dirtyValue;
    } else {
      const rawValue = convertValue(
        dataType,
        dirtyValue,
        serverParameter,
      ) as string;
      value = rawValue;
    }

    if (value === undefined) {
      this.logger.error(
        `(proccessIRZToNISData) column (value) undefined for: ${JSON.stringify(data)}`,
      );
      return;
    }

    const qualities = await this.cacheService.checkQuality(
      data.device_id,
      data.modem_id,
      key,
    );

    const qualitiesDeviceIds = Object.keys(qualities);
    if (qualitiesDeviceIds.length === 0) {
      this.logger.error(
        `(proccessIRZToNISData) qualitiesDeviceIds are empty for:  ${JSON.stringify(data)}`,
      );
      return;
    }

    const topics = this.cacheService.getMqttTopicsByValkeyData(key, data) || [];
    const topicDeviceIds = Object.keys(topics);
    if (topicDeviceIds.length === 0) {
      this.logger.error(
        `(proccessIRZToNISData) topicDeviceIds are empty for:  ${JSON.stringify(data)} ${JSON.stringify(topics)}`,
      );
      return;
    }

    // * Проверка на всякий случай
    if (!data.device_id && !data.modem_id) {
      this.logger.error(
        `(proccessIRZToNISData) device_id and modem_id not provided: ${JSON.stringify(data)}`,
      );
      return;
    }

    const aliasBy = data.device_id !== null ? 'device' : 'modem';
    const cleanAlias = await this.getMqttAlias({
      alias: data.alias,
      entityBy: aliasBy,
      entityId: data[`${aliasBy}_id`]!,
    });
    // * Проверка на наличие mqtt_outgoing_alias
    if (!cleanAlias) return;

    //!TODO возможно стоит добавить проверку на количество топиков и количество квалити
    for (let i = 0; i < qualitiesDeviceIds.length; i++) {
      const deviceId = qualitiesDeviceIds[i];
      const quality = qualities[Number(deviceId)].quality;
      const echolotQuality = qualities[Number(deviceId)]?.echolotQuality;
      const topic = topics[deviceId];
      if (typeof quality !== 'number') {
        this.logger.error(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `ERROR column quality = ${quality} for data=${JSON.stringify(data)} and device_id=${deviceId}`,
        );
        continue;
      }

      if (typeof topic !== 'string') {
        this.logger.error(
          `ERROR column topic = ${topic} for data=${JSON.stringify(data)} and device_id=${deviceId}`,
        );
        continue;
      }

      // исключаем из выборки топики Base location и все топики по устройству Ve-999
      if (topic.startsWith('IRZ/Base location') || Number(deviceId) === 3) {
        continue;
      }

      const isEcholotAlias = echolotAliasList[data.alias] === true;

      if (isEcholotAlias === true && echolotQuality === undefined) {
        continue;
      }

      const msg: OutGoingMessage = {
        d: isEcholotAlias === true ? (echolotQuality === 8 ? 0 : value) : value,
        dt: varNumTypeNumber,
        ts: timestamp,
        q: isEcholotAlias === true ? echolotQuality : quality,
      };

      const mqttTopic = buildMqttTopic({
        prefix: this.systemConfig.mqttPrefix,
        baseTopic: topic,
        postTopic: cleanAlias,
      });
      const baseMqttTopic = buildMqttTopic({
        prefix: this.systemConfig.mqttPrefix,
        baseTopic: topic,
        postTopic: '',
      });

      await this.mqttService.noWaitPublish(mqttTopic, JSON.stringify(msg));

      this.messageRetryService.registerMessage(
        mqttTopic,
        JSON.stringify(msg),
        Number(deviceId),
        baseMqttTopic,
      );
    }

    // only for trace
    // this.logger.log({ mqttTopic, value, dataType });
  }

  async onModuleDestroy(): Promise<void> {
    if (
      this.valkeyService &&
      typeof this.valkeyService.unsubscribeFromChanges === 'function'
    ) {
      await this.valkeyService.unsubscribeFromChanges(this.channel);
    }
  }

  private async getMqttAlias({
    alias,
    entityBy,
    entityId,
  }: {
    alias: string;
    entityId: number;
    entityBy: 'modem' | 'device';
  }) {
    let ongoingAlias: string | undefined;

    const cacheAlias = this.cacheService.getMqttAlias({
      alias,
      entityBy,
      entityId,
    });

    if (cacheAlias) {
      ongoingAlias = cacheAlias;
    } else {
      if (entityBy === 'device') {
        ongoingAlias = await this.m500Service.getMqttDeviceOutgoingAlias(
          entityId,
          alias,
        );
      } else if (entityBy === 'modem') {
        ongoingAlias = await this.m500Service.getMqttModemOutgoingAlias(
          entityId,
          alias,
        );
      }
    }

    if (!ongoingAlias) return;

    return removeForbiddenSymbols(ongoingAlias, 'mqtt_alias');
  }
}
