import {
  Inject,
  Injectable,
  Logger,
  LoggerService,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { CODE_COMPARE_CONFIG } from 'src/constants/codesComapres';
import { ValkeyService } from '../valkey/valkey.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { addContextDecoratorLogger } from 'src/infrastructure/logger/context.decorator.logger';
import { ValkeyItemType } from 'src/types/ValkeyItem.type';
import { convertValue } from 'src/helpers/convertValue.helper';
import { CacheService } from '../cache/cache.service';
import { MqttService } from '../mqtt/mqtt.service';
import {
  CodeCompareType,
  CodeCompareValueRepo,
} from 'src/types/CodeCompare.type';
import { ThrottleRegistry } from 'src/types/ThrottleRegistry.type';
import { parseTimestamp } from 'src/helpers/parseTimestamp.helper';
import { buildMqttTopic } from 'src/helpers/buildMqttTopic.helper';
import { OutGoingMessage } from 'src/types/OutGoingMessage.type';
import { MessageRetryService } from '../message-retry/message-retry.service';
import { CRON_CONFIG } from 'src/cron.config';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class TranscoderService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private channel: string;
  private topicsIRZ: Set<string>;
  private throttleRegistry = new Map<string, ThrottleRegistry>();
  private THROTTLE_TIME_MS = 2 * 1000;
  private throttlingIntervalId: NodeJS.Timeout;

  constructor(
    @Inject(Logger) private readonly logger: LoggerService,
    private readonly valkeyService: ValkeyService,
    private readonly systemConfig: SystemConfigService,
    private readonly cacheService: CacheService,
    private readonly mqttService: MqttService,
    private readonly messageRetryService: MessageRetryService,
  ) {
    this.logger = addContextDecoratorLogger(logger, TranscoderService.name);
    this.channel = `__keyevent@${this.systemConfig.valkeyConfig.db}__:set`;
    this.topicsIRZ = new Set<string>(
      CODE_COMPARE_CONFIG.flatMap((c) => c.topicIRZ.map((x) => x.alias)),
    );
  }

  async onApplicationBootstrap() {
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
        this.throttlingIntervalId = setInterval(() => {
          void this.processThrottlingValueList();
        }, 500);
      })
      .catch((e: Error) => {
        this.logger.error(`(onModuleInit) error`);
        this.logger.error(e);
        throw e;
      });
  }

  async onModuleDestroy(): Promise<void> {
    if (
      this.valkeyService &&
      typeof this.valkeyService.unsubscribeFromChanges === 'function'
    ) {
      await this.valkeyService.unsubscribeFromChanges(this.channel);
    }

    // for (const { 1: registry } of this.throttleRegistry) {
    //   clearTimeout(registry.timeoutId);
    // }
    this.throttleRegistry.clear();
    clearInterval(this.throttlingIntervalId);
  }

  async processThrottlingValueList(): Promise<void> {
    const currentTime = Date.now();
    const targetList = [...this.throttleRegistry.values()].filter(
      (x) => x.timeoutTime > currentTime,
    );
    await Promise.all(targetList.map((x) => this.processOneThrottlingValue(x)));
  }

  async processOneThrottlingValue(throttlingValue: ThrottleRegistry) {
    const { lastMsg, mqttTopic, baseMqttPath, deviceId } = throttlingValue;

    try {
      this.logger.log(`Publishing to topic ${mqttTopic}, ${lastMsg}`);
      await this.mqttService.noWaitPublish(mqttTopic, lastMsg);
      this.messageRetryService.registerMessage(
        mqttTopic,
        lastMsg,
        deviceId,
        baseMqttPath,
      );
    } catch (err) {
      this.logger.error(err);
    } finally {
      this.throttleRegistry.delete(mqttTopic);
    }
  }

  @Cron(CRON_CONFIG.CRON_SEND_ALL_TRANSCODER_MESSAGES)
  async initMessages() {
    await this.cacheService.waitTimerUntilAllCacheIsLoaded();
    const listOfAllDevices = this.cacheService.getAllDeviceAndSatpId();
    const devicesAndSatpIdThatHaveModems = listOfAllDevices.filter((i) => {
      return !!this.cacheService.getModemIdByDeviceId(i.device_id);
    });

    await Promise.all(
      devicesAndSatpIdThatHaveModems.flatMap(({ device_id }) => {
        const modemId = this.cacheService.getModemIdByDeviceId(device_id);
        const aliasToCheck = CODE_COMPARE_CONFIG.map(
          (x) => x.topicIRZ[0],
        ).filter((x) => x !== undefined);
        const targetTask = aliasToCheck.map(async (alias) => {
          const targetKey =
            alias.type === 'device'
              ? `device/${device_id}/${alias.alias}`
              : `modem/${modemId}/${alias.alias}`;
          const value = await this.valkeyService.getValueByKey(targetKey);
          if (value === null) {
            return;
          }
          await this.proccessIRZtoNISData({
            key: targetKey,
            data: value,
            topicIRZ: alias.alias,
          });
        });

        return targetTask;
      }),
    );

    this.logger.log(`(initMessages) all messages data was inited`);
  }

  async handleSubscribeItemsToValkey() {
    try {
      await this.valkeyService.subscribeToChanges(
        this.channel,
        this.provideValueToHandler,
      );
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }

  private provideValueToHandler = async (key: string) => {
    const topicIRZ = key.split('/').at(-1);
    if (!topicIRZ || !this.topicsIRZ.has(topicIRZ)) return;

    const data: ValkeyItemType | null =
      await this.valkeyService.getValueByKey(key);
    if (!data) return;

    try {
      await this.proccessIRZtoNISData({ data, key, topicIRZ });
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  };

  private proccessIRZtoNISData = async ({
    data,
    key,
    topicIRZ,
  }: {
    key: string;
    data: ValkeyItemType;
    topicIRZ: string;
  }) => {
    try {
      const topicOrigin: 'device' | 'modem' =
        data.device_id === null ? 'modem' : 'device';

      const currentCompares = CODE_COMPARE_CONFIG.filter((c) =>
        c.topicIRZ.some((x) => x.alias === topicIRZ && x.type === topicOrigin),
      );

      for (const compare of currentCompares) {
        if (topicOrigin === 'device' && data.device_id !== null) {
          await this.compareChanges({
            compare,
            data,
            key,
          });
        } else if (topicOrigin === 'modem' && data.modem_id !== null) {
          // for modem values, we use it for all devices
          const deviceIdList = this.cacheService.getDeviceIdListByModemId(
            data.modem_id,
          );

          await Promise.all(
            deviceIdList.map(async (device_id) => {
              const newData: ValkeyItemType = { ...data, device_id: device_id };
              await this.compareChanges({ compare, data: newData, key });
            }),
          );
        }
      }
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  };

  private async compareChanges({
    compare,
    data,
    key,
  }: {
    compare: CodeCompareType;
    data: ValkeyItemType;
    key: string;
  }) {
    try {
      if (data.device_id === null || data.modem_id === null) return;

      const formulaInputs = await this.getFormulaInputs(
        data.device_id,
        data.modem_id,
        compare,
      );
      if (!formulaInputs) return;

      const valueNIS = compare.formula(data.device_id, formulaInputs);
      if (valueNIS === null) return;

      const timestamp = parseTimestamp(data.dt);

      const qualities =
        (await this.cacheService.checkQuality(
          data.device_id,
          data.modem_id,
          key,
        )) ?? {};

      if (Object.keys(qualities).length === 0) {
        this.logger.error(
          `(compareChanges) qualitiesDeviceIds are empty for:  ${JSON.stringify(data)}`,
        );
        return;
      }

      const topics =
        this.cacheService.getMqttTopicsByValkeyData(key, data) || [];
      if (Object.keys(topics).length === 0) {
        this.logger.error(
          `(compareChanges) topics.length is 0 for:  ${JSON.stringify(data)} ${JSON.stringify(topics)}`,
        );
        return;
      }

      for (const deviceId in qualities) {
        if (!Object.hasOwn(qualities, deviceId)) continue;

        const quality = qualities[deviceId].quality;
        const topic = topics[deviceId];

        if (typeof quality !== 'number') {
          this.logger.error(
            `ERROR column quality = ${JSON.stringify(quality)} for data=${JSON.stringify(data)} and device_id=${deviceId}`,
          );
          continue;
        }

        if (typeof topic !== 'string') {
          this.logger.error(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `ERROR column topic = ${topic} for data=${JSON.stringify(data)} and device_id=${deviceId}`,
          );
          continue;
        }

        if (topic.startsWith('IRZ/Base location') || Number(deviceId) === 3) {
          continue;
        }
        const dataType = compare.returningDataType;

        const msg: OutGoingMessage = {
          d: valueNIS,
          dt: dataType,
          ts: timestamp,
          q: quality,
        };

        const mqttTopic = buildMqttTopic({
          prefix: this.systemConfig.mqttPrefix,
          baseTopic: topic,
          postTopic: compare.tagnameNIS,
        });

        const baseMqttTopic = buildMqttTopic({
          prefix: this.systemConfig.mqttPrefix,
          baseTopic: topic,
          postTopic: '',
        });

        this.proccessThrottledPublish(
          mqttTopic,
          JSON.stringify(msg),
          Number(deviceId),
          baseMqttTopic,
        );
      }
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }

  private async getFormulaInputs(
    deviceId: number,
    modemId: number,
    compareClass: CodeCompareType,
  ): Promise<CodeCompareValueRepo | undefined> {
    const values: CodeCompareValueRepo = {};

    for (const k of compareClass.topicIRZ) {
      const valkeyValue =
        k.type === 'device'
          ? await this.valkeyService.getValueByKey(
              `device/${deviceId}/${k.alias}`,
            )
          : await this.valkeyService.getValueByKey(
              `modem/${modemId}/${k.alias}`,
            );

      if (!valkeyValue) return undefined;

      const dirtyValue =
        valkeyValue.value ?? valkeyValue.value_bool ?? valkeyValue.value_string;
      const serverParameter = this.cacheService.getServerParameterByAlias(
        valkeyValue.alias,
      );

      if (serverParameter === undefined) {
        this.logger.error(
          `(getFormulaInputs) column (serverParameter) undefined for: ${JSON.stringify(valkeyValue)}`,
        );
        return;
      }

      const value = convertValue(
        serverParameter.server_data_type_id,
        dirtyValue,
        serverParameter,
      );
      if (value === null) {
        continue;
      }

      values[k.alias] = { value };
    }

    return values;
  }

  private proccessThrottledPublish(
    mqttTopic: string,
    msg: string,
    deviceId: number,
    baseMqttPath: string,
  ) {
    if (this.throttleRegistry.has(mqttTopic)) {
      this.logger.warn(
        `Find throttled on topic ${mqttTopic}, changing data to ${msg}`,
      );
      const oldMessage = this.throttleRegistry.get(mqttTopic);
      oldMessage!.lastMsg = msg;
      this.throttleRegistry.set(mqttTopic, oldMessage!);
      return;
    }

    // await this.mqttService.noWaitPublish(mqttTopic, msg);
    this.logger.log(
      `Registered publishing to topic ${mqttTopic}, message ${msg}`,
    );

    const timeNow = Date.now();
    const timeoutTime = timeNow + this.THROTTLE_TIME_MS;

    this.throttleRegistry.set(mqttTopic, {
      lastMsg: msg,
      baseMqttPath,
      deviceId,
      mqttTopic,
      timeoutTime,
    });
  }
}
