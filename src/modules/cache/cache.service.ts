// кэширование таблиц sites, locations, devices каждую минуту по крону в deviceSitesLocationMap

import {
  Inject,
  Injectable,
  Logger,
  LoggerService,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { CRON_CONFIG } from 'src/cron.config';
import { DeviceLocationSiteMapType } from 'src/types/DeviceLocationSiteMap.type';
import { SatpDataMapType } from 'src/types/SatpDataMapType.type';
import { WordTranslationMapType } from 'src/types/WordTranslationMapType.type';
import { M500Service } from '../postgres/m500.service';
import { addContextDecoratorLogger } from 'src/infrastructure/logger/context.decorator.logger';
import { getDifferenceInMsBetweenDates } from 'src/helpers/getDifferenceInMsBetweenDates.helper';
import { DATA_TYPE_VARNUMBER_TYPE_LIST } from 'src/constants/dataTypeVarnumberTypeList';
import { Cron } from '@nestjs/schedule';
import { createDeviceLocationSiteMap } from 'src/helpers/createDeviceLocationSiteMap.helper';
import { createSatpDataMap } from 'src/helpers/createSatpDataMap.helper';
import { createWordTranslationMap } from 'src/helpers/createWordTranslationMap.helper';
import { createModemDevicesMap } from 'src/helpers/createModemDevicesMap.helper';
import { ModemDevicesMapType } from 'src/types/ModemDevicesMap.type';
import { SystemConfigService } from '../system-config/system-config.service';
import { ValkeyService } from '../valkey/valkey.service';
import {
  QualityCacheType,
  QualityCacheTypeItem,
} from 'src/types/CacheQuality.type';
import { ValkeyItemType } from 'src/types/ValkeyItem.type';
import { ServerAliasTemplateParameters } from 'src/entities/server_alias_template_parameters.entity';
import { createSatpEntityMap } from 'src/helpers/createSatpEntityMap.helper';
import { createSatpAliasMap } from 'src/helpers/createSatpAliasMap.helper';
import { SatpAliasMap } from 'src/types/SatpAliasMap.type';
import { QualityCodeNumbers } from 'src/types/QualityCodeNumbers.type';
import { EcholotQualityCodeNumbers } from 'src/types/EcholotQualityCodeNumbers.type';
import { EventEmitter } from 'node:events';
import { buildMqttTopic } from 'src/helpers/buildMqttTopic.helper';

const CACHE_UPDATE_EVENT_NAME = 'cached_updated_event';

@Injectable()
export class CacheService implements OnApplicationBootstrap {
  private isAllCacheLoaded = false;

  // !REVIEW Рекомендую заменить на Map<number, string>
  // !REVIEW Не рекомендую такие переменные открывать в public, лучше сделать на них отдельную функцию на получение и изменение переменных (O - в принципах SOLID)
  public deviceLocationSiteMap: DeviceLocationSiteMapType = {};
  private deviceLocationSiteMapIsUpdating = false;
  lastUpdateDeviceLocationSiteMap: Date;

  // !REVIEW Рекомендую заменить на Map<string, ServerAliasTemplateParameters>
  // !REVIEW Не рекомендую такие переменные открывать в public, лучше сделать на них отдельную функцию на получение и изменение переменных (O - в принципах SOLID)
  public satpDataMap: SatpDataMapType = {};
  private satpDataTypeMapIsUpdating = false;
  lastUpdateSatpDataTypeMap: Date;

  // !REVIEW Рекомендую заменить на Map<string, string>
  // !REVIEW Не рекомендую такие переменные открывать в public, лучше сделать на них отдельную функцию на получение и изменение переменных (O - в принципах SOLID)
  public wordTranslationMap: WordTranslationMapType = {};
  private wordTranslationMapIsUpdating = false;
  lastUpdateWordTranslationMap: Date;

  public modemDevicesMap: ModemDevicesMapType = {};
  private modemDevicesMapIsUpdating = false;
  lastUpdateModemDevicesMap: Date;

  private qualityCache: QualityCacheType = {};

  private deviceIdSatpIdMap = new Map<number, number>();
  private deviceIdSatpIdMapIsUpdating = false;
  lastUpdateDeviceIdSatpIdMap: Date;

  private modemIdSatpIdMap = new Map<number, number>();
  private modemIdSatpIdMapIsUpdating = false;
  lastUpdateModemIdSatpIdMap: Date;

  private satpAliasMap: SatpAliasMap = new Map();

  private eventEmitter = new EventEmitter();

  constructor(
    @Inject(Logger) private readonly logger: LoggerService,
    private readonly m500Service: M500Service,
    private readonly systemConfig: SystemConfigService,
    private readonly valkeyService: ValkeyService,
  ) {
    this.logger = addContextDecoratorLogger(logger, CacheService.name);
  }

  getDeviceIdListByModemId(modemId: number): number[] {
    const value = this.modemDevicesMap[modemId] ?? [];
    return value;
  }

  getModemIdByDeviceId(deviceId: number): number | undefined {
    for (const modemId in this.modemDevicesMap) {
      const deviceArray = this.modemDevicesMap[modemId];
      if (deviceArray === undefined) {
        continue;
      }
      const isDeviceIdInArray = deviceArray.some((x) => x === deviceId);
      if (isDeviceIdInArray === true) {
        return Number(modemId);
      }
    }

    return undefined;
  }

  waitTimerUntilAllCacheIsLoaded(): Promise<void> {
    if (this.isAllCacheLoaded === true) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const checkTimer = setInterval(() => {
        if (this.isAllCacheLoaded === true) {
          clearInterval(checkTimer);
          resolve();
        }
      }, 100);
    });
  }

  subscribeToUpdateCacheEvent(callback: () => void | Promise<void>) {
    this.eventEmitter.on(CACHE_UPDATE_EVENT_NAME, () => {
      try {
        callback();
      } catch {
        this.logger.error(
          `UNHANDLED ERROR ON EVENT ${CACHE_UPDATE_EVENT_NAME}`,
        );
      }
    });
  }

  async onApplicationBootstrap() {
    await this.updateAllCache();
  }

  @Cron(CRON_CONFIG.CRON_UPDATE_CACHE)
  async updateAllCache(): Promise<void> {
    await this.updateDeviceLocationSiteMap();
    await this.updateSatpDataTypeMap();
    await this.updateWordTranslationMap();
    await this.updateModemDevicesMap();
    await this.updateDeviceIdSatpIdMap();
    await this.updateModemIdSatpIdMap();
    this.eventEmitter.emit(CACHE_UPDATE_EVENT_NAME);
    this.isAllCacheLoaded = true;
  }

  checkCacheUpdate() {
    const diffMsAtLastUpdDevLocSiteMap = getDifferenceInMsBetweenDates(
      this.lastUpdateDeviceLocationSiteMap,
      new Date(),
    );
    if (diffMsAtLastUpdDevLocSiteMap === undefined) {
      this.logger.error(
        `(checkCacheUpdate) lastUpdateDeviceLocationSiteMap is invalid`,
      );
      return false;
    }
    if (diffMsAtLastUpdDevLocSiteMap > this.systemConfig.dbCacheLifeMs) {
      this.logger.error(
        `(checkCacheUpdate) deviceLocationSiteMap UPDATE EXCEEDED. Last update was at ${this.lastUpdateDeviceLocationSiteMap.toISOString()}. Maximum refresh waiting time in ms = ${this.systemConfig.dbCacheLifeMs}`,
      );
      return false;
    }

    const diffMsAtLastUpdSatpDataTypeMap = getDifferenceInMsBetweenDates(
      this.lastUpdateSatpDataTypeMap,
      new Date(),
    );
    if (diffMsAtLastUpdSatpDataTypeMap === undefined) {
      this.logger.error(
        `(checkCacheUpdate) lastUpdateSatpDataTypeMap is invalid`,
      );
      return false;
    }
    if (diffMsAtLastUpdSatpDataTypeMap > this.systemConfig.dbCacheLifeMs) {
      this.logger.error(
        `(checkCacheUpdate) satpDataMap UPDATE EXCEEDED. Last update was at ${this.lastUpdateSatpDataTypeMap.toISOString()}. Maximum refresh waiting time in ms = ${this.systemConfig.dbCacheLifeMs}`,
      );
      return false;
    }

    const diffMsAtLastUpdWordTranslationMap = getDifferenceInMsBetweenDates(
      this.lastUpdateWordTranslationMap,
      new Date(),
    );
    if (diffMsAtLastUpdWordTranslationMap === undefined) {
      this.logger.error(
        `(checkCacheUpdate) lastUpdateWordTranslationMap is invalid`,
      );
      return false;
    }
    if (diffMsAtLastUpdWordTranslationMap > this.systemConfig.dbCacheLifeMs) {
      this.logger.error(
        `(checkCacheUpdate) wordTranslationMap UPDATE EXCEEDED. Last update was at ${this.lastUpdateWordTranslationMap.toISOString()}. Maximum refresh waiting time in ms = ${this.systemConfig.dbCacheLifeMs}`,
      );
      return false;
    }

    const diffMsAtLastUpdModemDevicesMap = getDifferenceInMsBetweenDates(
      this.lastUpdateModemDevicesMap,
      new Date(),
    );
    if (diffMsAtLastUpdModemDevicesMap === undefined) {
      this.logger.error(
        `(checkCacheUpdate) lastUpdateModemDevicesMap is invalid`,
      );
      return false;
    }
    if (diffMsAtLastUpdModemDevicesMap > this.systemConfig.dbCacheLifeMs) {
      this.logger.error(
        `(checkCacheUpdate) ModemDevicesMap UPDATE EXCEEDED. Last update was at ${this.lastUpdateModemDevicesMap.toISOString()}. Maximum refresh waiting time in ms = ${this.systemConfig.dbCacheLifeMs}`,
      );
      return false;
    }

    // * Devices
    const diffMsAtLastUpdDeviceIdSatpIdMap = getDifferenceInMsBetweenDates(
      this.lastUpdateDeviceIdSatpIdMap,
      new Date(),
    );
    if (diffMsAtLastUpdDeviceIdSatpIdMap === undefined) {
      this.logger.error(
        `(checkCacheUpdate) lastUpdateDeviceIdSatpIdMap is invalid`,
      );
      return false;
    }
    if (diffMsAtLastUpdDeviceIdSatpIdMap > this.systemConfig.dbCacheLifeMs) {
      this.logger.error(
        `(checkCacheUpdate) deviceMqttOutgoingAliasMap UPDATE EXCEEDED. Last update was at ${this.lastUpdateDeviceIdSatpIdMap.toISOString()}. Maximum refresh waiting time in ms = ${this.systemConfig.dbCacheLifeMs}`,
      );
      return false;
    }

    // * Modems
    const diffMsAtLastUpdModemIdSatpIdMap = getDifferenceInMsBetweenDates(
      this.lastUpdateModemIdSatpIdMap,
      new Date(),
    );
    if (diffMsAtLastUpdModemIdSatpIdMap === undefined) {
      this.logger.error(
        `(checkCacheUpdate) lastUpdateModemMqttOutgoingAliasMap is invalid`,
      );
      return false;
    }
    if (diffMsAtLastUpdModemIdSatpIdMap > this.systemConfig.dbCacheLifeMs) {
      this.logger.error(
        `(checkCacheUpdate) modemMqttOutgoingAliasMap UPDATE EXCEEDED. Last update was at ${this.lastUpdateModemIdSatpIdMap.toISOString()}. Maximum refresh waiting time in ms = ${this.systemConfig.dbCacheLifeMs}`,
      );
      return false;
    }

    return true;
  }

  getVarNumTypeByAlias(alias: string): number | undefined {
    try {
      const satpData = this.satpDataMap[alias];
      if (satpData === undefined) {
        return undefined;
      }

      const dataType = satpData.server_data_type_id;
      if (dataType === undefined) {
        return undefined;
      }
      const varNumTypeNumber = DATA_TYPE_VARNUMBER_TYPE_LIST[dataType];
      if (varNumTypeNumber === null) {
        return undefined;
      }
      if (varNumTypeNumber === undefined) {
        this.logger.log(
          `(getVarNumTypeByAlias) varNumTypeNumber is undefined for alias=${alias} with server_data_type_id=${dataType}`,
        );
        return undefined;
      }

      return varNumTypeNumber;
    } catch (e) {
      this.logger.error(`ERROR (getVarNumTypeByAlias):`, e);
      return undefined;
    }
  }

  async updateDeviceLocationSiteMap(): Promise<void> {
    try {
      this.logger.log(
        `(updateDeviceLocationSiteMap) CALLED... deviceLocationSiteMapIsUpdating = ${this.deviceLocationSiteMapIsUpdating}`,
      );
      if (!this.deviceLocationSiteMapIsUpdating) {
        this.logger.log(`(updateDeviceLocationSiteMap) START UPDATING...`);
        const startTime = Date.now();
        this.deviceLocationSiteMapIsUpdating = true;
        const _devices = await this.m500Service.getDevices();
        // only for trace
        // this.logger.log(
        //   `(updateDeviceLocationSiteMap) _devicesLenght: ${_devices.length}`,
        // );
        this.logger.log(
          `(updateDeviceLocationSiteMap) GOT DEVICES IN ${Date.now() - startTime}ms...`,
        );
        const _locations = await this.m500Service.getLocations();
        // only for trace
        // this.logger.log(
        //   `(updateDeviceLocationSiteMap) _locationsLenght: ${_locations.length}`,
        // );
        this.logger.log(
          `(updateDeviceLocationSiteMap) GOT LOCATIONS IN ${Date.now() - startTime}ms...`,
        );
        const newCache = createDeviceLocationSiteMap(_devices, _locations);
        this.logger.log(
          `(updateDeviceLocationSiteMap) CREATE MAP IN ${Date.now() - startTime}ms...`,
        );
        // const newCacheSize = Object.keys(newCache).length;

        // // ? Возомжно теперь нужно избавиться от этого условия
        // if (newCacheSize === 0) {
        //   throw new Error(`ERROR (updateDeviceLocationSiteMap) cache is empty`);
        // }

        this.deviceLocationSiteMap = newCache;
        this.lastUpdateDeviceLocationSiteMap = new Date();
        this.deviceLocationSiteMapIsUpdating = false;
        const updateDuration = Date.now() - startTime;
        this.logger.log(
          `(updateDeviceLocationSiteMap) FINISHED UPDATING in ${updateDuration}ms.`,
        );
      }
    } catch (e) {
      this.logger.error(`CRON ERROR (updateDeviceLocationSiteMap): `, e);
      this.deviceLocationSiteMapIsUpdating = false;
      throw e;
    }
  }

  getRemovedDeviceIds(
    oldList: DeviceLocationSiteMapType,
    newList: DeviceLocationSiteMapType,
  ): Set<number> {
    const oldDeviceIds = Object.keys(oldList).map(Number);
    const newDeviceIdsSet = new Set(Object.keys(newList).map(Number));

    const diff = new Set(oldDeviceIds.filter((k) => !newDeviceIdsSet.has(k)));
    return diff;
  }

  // destroyReSentTopicsByDeviceIds(removedDevices: Set<number>) {
  //   if (removedDevices.size !== 0) {
  //     try {
  //       this.messageRetryService.destroyAllRetryMessagesByDeviceIds(
  //         removedDevices,
  //       );

  //       this.logger.warn(
  //         `Re-sent topics are no longer transmitted on the following devices`,
  //         removedDevices,
  //       );
  //     } catch (e) {
  //       this.logger.error(
  //         `Error while destroying Re-sent topics for devices`,
  //         removedDevices,
  //       );
  //       this.logger.error(e);
  //     }
  //   }
  // }

  getMqttTopicsByValkeyData(
    key: string,
    data: ValkeyItemType,
  ): DeviceLocationSiteMapType {
    try {
      const deviceIds: number[] = [];
      if (key.startsWith('device')) {
        if (data.device_id !== null) {
          deviceIds.push(data.device_id);
        }
      } else if (key.startsWith('modem')) {
        const modemId = data.modem_id;
        if (!modemId) {
          return {};
        }
        const foreignDeviceIds = this.modemDevicesMap[modemId] ?? [];
        deviceIds.push(...foreignDeviceIds);
      }

      if (deviceIds.length === 0) {
        return {};
      }

      const topics = {};

      for (const deviceId of deviceIds) {
        const topic = this.deviceLocationSiteMap[deviceId] as
          | string
          | undefined;
        if (topic) {
          topics[deviceId] = topic;
        }
      }

      return topics;
    } catch (e) {
      this.logger.error(`(pendingTopic) Error:`, e);
      return {};
    }
  }

  async updateSatpDataTypeMap(): Promise<void> {
    try {
      this.logger.log(
        `(updateSatpDataTypeMap) CALLED... satpDataTypeMapIsUpdating = ${this.satpDataTypeMapIsUpdating}`,
      );
      if (!this.satpDataTypeMapIsUpdating) {
        this.logger.log(`(updateSatpDataTypeMap) START UPDATING...`);
        const startTime = Date.now();
        this.satpDataTypeMapIsUpdating = true;
        const _satp = await this.m500Service.getSatp();
        // only for trace
        // this.logger.log(`(updateSatpDataTypeMap) _satp: ${_satp.length}`,);
        const newCache = createSatpDataMap(_satp);
        // const newCacheSize = Object.keys(newCache).length;
        // if (newCacheSize === 0) {
        //   throw new Error(`ERROR (updateSatpDataTypeMap) cache is empty`);
        // }

        this.satpAliasMap = createSatpAliasMap(_satp);
        this.satpDataMap = newCache;
        this.lastUpdateSatpDataTypeMap = new Date();
        this.satpDataTypeMapIsUpdating = false;
        const updateDuration = Date.now() - startTime;
        this.logger.log(
          `(updateSatpDataTypeMap) FINISHED UPDATING in ${updateDuration}ms.`,
        );
      }
    } catch (e) {
      this.logger.error(`CRON ERROR (updateSatpDataTypeMap): `, e);
      this.satpDataTypeMapIsUpdating = false;
      throw e;
    }
  }

  getServerParameterByAlias(
    alias: string,
  ): ServerAliasTemplateParameters | undefined {
    try {
      const serverParameter = this.satpDataMap[alias];
      return serverParameter;
    } catch (e) {
      this.logger.error(
        `(getServerParameterByAlias) ERROR while getting serverParameter`,
        e,
      );
      return undefined;
    }
  }

  async updateWordTranslationMap(): Promise<void> {
    try {
      this.logger.log(
        `(updateWordTranslationMap) CALLED... satpDataTypeMapIsUpdating = ${this.wordTranslationMapIsUpdating}`,
      );
      if (!this.wordTranslationMapIsUpdating) {
        this.logger.log(`(updateWordTranslationMap) START UPDATING...`);
        const startTime = Date.now();
        this.wordTranslationMapIsUpdating = true;

        const _vocabulary = await this.m500Service.getVocabulary(
          this.systemConfig.vocabularyLang,
        );
        // only for trace
        // this.logger.log(`(updateWordTranslationMap) _vocabulary: ${_vocabulary.length}`,);
        const newCache = createWordTranslationMap(_vocabulary);
        // const newCacheSize = Object.keys(newCache).length;
        // if (newCacheSize === 0) {
        //   throw new Error(`ERROR (updateWordTranslationMap) cache is empty`);
        // }

        this.wordTranslationMap = newCache;
        this.lastUpdateWordTranslationMap = new Date();
        this.wordTranslationMapIsUpdating = false;
        const durationTime = Date.now() - startTime;
        this.logger.log(
          `(updateWordTranslationMap) FINISHED UPDATING in ${durationTime}ms.`,
        );
      }
    } catch (e) {
      this.logger.error(`CRON ERROR (updateWordTranslationMap): `, e);
      this.wordTranslationMapIsUpdating = false;
      throw e;
    }
  }

  getTranslationByWord(word: string): string | undefined {
    if (typeof word !== 'string') {
      this.logger.error(`ERROR () column word is invalid`, { word });
      return undefined;
    }
    return this.wordTranslationMap[word];
  }

  async updateModemDevicesMap(): Promise<void> {
    try {
      this.logger.log(
        `(updateModemDevicesMap) CALLED... satpDataTypeMapIsUpdating = ${this.modemDevicesMapIsUpdating}`,
      );
      if (!this.modemDevicesMapIsUpdating) {
        this.logger.log(`(updateModemDevicesMap) START UPDATING...`);
        const startTime = Date.now();
        this.modemDevicesMapIsUpdating = true;
        const _serverModemDeviceBinds =
          await this.m500Service.getServerModemDeviceBinds();
        // only for trace
        // this.logger.log(`(updateSatpDataTypeMap) _satp: ${_satp.length}`,);
        const newCache = createModemDevicesMap(_serverModemDeviceBinds);
        // const newCacheSize = Object.keys(newCache).length;
        // if (newCacheSize === 0) {
        //   throw new Error(`ERROR (updateModemDevicesMap) cache is empty`);
        // }

        this.modemDevicesMap = newCache;
        this.lastUpdateModemDevicesMap = new Date();
        this.modemDevicesMapIsUpdating = false;
        const durationTime = Date.now() - startTime;
        this.logger.log(
          `(updateModemDevicesMap) FINISHED UPDATING in ${durationTime}ms.`,
        );
      }
    } catch (e) {
      this.logger.error(`CRON ERROR (updateModemDevicesMap): `, e);
      this.modemDevicesMapIsUpdating = false;
      throw e;
    }
  }

  public updateQualityCache(
    device_id: number,
    quality: QualityCodeNumbers,
    echolotQuality: EcholotQualityCodeNumbers,
  ) {
    if (!device_id) {
      this.logger.error(`(updateQualityCache) column device_id undefined`);
    }
    if (typeof quality !== 'number') {
      this.logger.error(`(updateQualityCache) column quality invalid`);
    }
    this.qualityCache[device_id] = {
      quality: quality,
      updatedAt: new Date(),
      echolotQuality: echolotQuality,
    };
  }

  public getActualQualityCache(device_id: number): QualityCacheTypeItem | null {
    try {
      const item = this.qualityCache[device_id];
      if (!item) {
        return null;
      }
      const diffMsBetweenLastUpdateAndCurrentDate =
        getDifferenceInMsBetweenDates(item.updatedAt, new Date());
      if (diffMsBetweenLastUpdateAndCurrentDate === undefined) {
        return null;
      }
      if (
        diffMsBetweenLastUpdateAndCurrentDate <
        this.systemConfig.qualityCacheLifeMs
      ) {
        return item;
      }
      return null;
    } catch (e) {
      this.logger.error(`ERROR (getActualQualityCache)`, e);
      return null;
    }
  }

  async checkQuality(
    device_id: number | null,
    modem_id: number | null,
    key: string,
  ): Promise<QualityCacheType> {
    try {
      const deviceIds: number[] = [];
      if (typeof key === 'string') {
        if (key.startsWith('modem') && !device_id) {
          if (!modem_id) {
            return {};
          }
          const foreignDeviceIds = this.modemDevicesMap[modem_id] ?? [];
          deviceIds.push(...foreignDeviceIds);
        }
      }
      if (device_id) {
        deviceIds.push(device_id);
      }
      const qualities: QualityCacheType = {};

      for (let i = 0; i < deviceIds.length; i++) {
        const deviceId = deviceIds[i];
        const cacheQuality = this.getActualQualityCache(deviceId);
        if (cacheQuality === null) {
          continue;
        }
        //!TODO возможно лучше сделать кэш отдельно на Modem_link и 0x0000_State_link_controller
        qualities[deviceId] = cacheQuality;
      }

      const cacheDeviceIds = Object.keys(qualities);

      if (cacheDeviceIds.length !== 0) {
        deviceIds.filter(
          (deviceId) => cacheDeviceIds.indexOf(String(deviceId)) !== -1,
        );
      }

      if (deviceIds.length === 0) {
        return qualities;
      }

      const modemLinkData = modem_id
        ? await this.valkeyService.getValueByKey(`modem/${modem_id}/Modem_link`)
        : undefined;

      for (let i = 0; i < deviceIds.length; i++) {
        const deviceId = deviceIds[i];
        if (deviceId) {
          const stateLinkControllerData = device_id
            ? await this.valkeyService.getValueByKey(
              `device/${device_id}/0x0000_State_link_controller`,
            )
            : undefined;

          const setTypeEcholotData = device_id
            ? await this.valkeyService.getValueByKey(
              `device/${device_id}/3x0750 set_type_echcolot`,
            )
            : undefined;

          const modemLinkQ = modemLinkData
            ? Boolean(modemLinkData?.value_bool)
            : false;
          const stateLinkControllerQ = stateLinkControllerData
            ? Boolean(stateLinkControllerData?.value_bool)
            : true;

          const setTypeEcholotState =
            setTypeEcholotData &&
              typeof setTypeEcholotData?.value_string === 'string'
              ? setTypeEcholotData?.value_string
              : undefined;

          const echolotQuality = this.getQualityCodeForEcholot(
            modemLinkQ,
            stateLinkControllerQ,
            setTypeEcholotState,
          );

          if (modemLinkQ === false) {
            qualities[deviceId] = {
              quality: 0,
              updatedAt: new Date(modemLinkData?.dt ?? Date.now()),
              echolotQuality,
            };
          }

          if (modemLinkQ === true && stateLinkControllerQ === false) {
            qualities[deviceId] = {
              quality: 24,
              updatedAt: new Date(modemLinkData?.dt ?? Date.now()),
              echolotQuality,
            };
          }

          if (modemLinkQ === true && stateLinkControllerQ === true) {
            qualities[deviceId] = {
              quality: 192,
              updatedAt: new Date(modemLinkData?.dt ?? Date.now()),
              echolotQuality,
            };
          }

          if (
            qualities[deviceId]?.quality === 0 ||
            qualities[deviceId]?.quality === 24 ||
            qualities[deviceId]?.quality === 192
          ) {
            this.updateQualityCache(
              deviceId,
              qualities[deviceId].quality,
              echolotQuality,
            );
          }
        }
      }

      return qualities;
    } catch (e) {
      this.logger.error(e);
      return {};
    }
  }

  getQualityCodeForEcholot(
    modemLinkQ: boolean,
    stateLinkControllerQ: boolean,
    setTypeEcholotState: string | undefined,
  ) {
    if (modemLinkQ === false) {
      return 0;
    }

    if (setTypeEcholotState === undefined || setTypeEcholotState === '#Нет') {
      return 8;
    }

    if (
      modemLinkQ === true &&
      stateLinkControllerQ === false &&
      setTypeEcholotState !== '#Магматэк'
    ) {
      return 24;
    }

    if (
      modemLinkQ === true &&
      stateLinkControllerQ === true &&
      setTypeEcholotState === '#Магматэк'
    ) {
      return 192;
    }

    return undefined;
  }

  async updateDeviceIdSatpIdMap() {
    try {
      this.logger.log(
        `(updateDeviceIdSatpIdMap) CALLED... deviceIdSatpIdMapIsUpdating = ${this.deviceIdSatpIdMapIsUpdating}`,
      );
      if (!this.deviceIdSatpIdMapIsUpdating) {
        this.logger.log(`(updateDeviceIdSatpIdMap) START UPDATING...`);
        const startTime = Date.now();
        this.deviceIdSatpIdMapIsUpdating = true;
        const data = await this.m500Service.getDevices();

        const newCache = createSatpEntityMap(data);
        // const newCacheSize = newCache?.size;
        // if (!newCache || newCacheSize === 0) {
        //   this.logger.error(`ERROR (updateDeviceIdSatpIdMap) cache is empty`);
        //   return;
        // }

        this.deviceIdSatpIdMap = newCache;
        this.lastUpdateDeviceIdSatpIdMap = new Date();
        this.deviceIdSatpIdMapIsUpdating = false;
        const durationTime = Date.now() - startTime;
        this.logger.log(
          `(updateDeviceIdSatpIdMap) FINISHED UPDATING in ${durationTime}ms.`,
        );
      }
    } catch (e) {
      this.logger.error(`CRON ERROR (updateDeviceIdSatpIdMap): `, e);
      this.deviceIdSatpIdMapIsUpdating = false;
      throw e;
    }
  }

  async updateModemIdSatpIdMap() {
    try {
      this.logger.log(
        `(updateModemIdSatpIdMap) CALLED... modemIdSatpIdMapIsUpdating = ${this.modemIdSatpIdMapIsUpdating}`,
      );
      if (!this.modemIdSatpIdMapIsUpdating) {
        this.logger.log(`(updateModemIdSatpIdMap) START UPDATING...`);
        const startTime = Date.now();
        this.modemIdSatpIdMapIsUpdating = true;
        const data = await this.m500Service.getModems();

        const newCache = createSatpEntityMap(data);
        // const newCacheSize = newCache?.size;
        if (!newCache) {
          // || newCacheSize === 0) {
          this.logger.error(`ERROR (updateModemIdSatpIdMap) cache is empty`);
          return;
        }

        this.modemIdSatpIdMap = newCache;
        this.lastUpdateModemIdSatpIdMap = new Date();
        this.modemIdSatpIdMapIsUpdating = false;
        const durationTime = Date.now() - startTime;
        this.logger.log(
          `(updateModemIdSatpIdMap) FINISHED UPDATING in ${durationTime}ms.`,
        );
      }
    } catch (e) {
      this.logger.error(`CRON ERROR (updateModemIdSatpIdMap): `, e);
      this.modemIdSatpIdMapIsUpdating = false;
      throw e;
    }
  }

  getMqttAlias({
    alias,
    entityBy,
    entityId,
  }: {
    alias: string;
    entityId: number;
    entityBy: 'modem' | 'device';
  }): string | undefined {
    const satId =
      entityBy === 'device'
        ? this.deviceIdSatpIdMap.get(entityId)
        : this.modemIdSatpIdMap.get(entityId);

    if (!satId) return;

    const satpAlias = this.satpAliasMap.get(alias);
    if (!satpAlias?.size) return;

    return satpAlias.get(satId);
  }

  getAllDeviceAndSatpId(): { device_id: number; satp_id: number }[] {
    const resultList: { device_id: number; satp_id: number }[] = [
      ...this.deviceIdSatpIdMap.entries(),
    ].map((x) => ({ device_id: x[0], satp_id: x[1] }));

    return resultList;
  }

  getMqttTopicLocationPathForDevice(deviceId: number): string | undefined {
    const mqttPrefix = this.systemConfig.mqttPrefix;
    const pathForDevice = this.deviceLocationSiteMap[deviceId];
    const modemId = this.getModemIdByDeviceId(deviceId);
    if (pathForDevice === undefined || modemId === undefined) {
      return undefined;
    }
    const result = buildMqttTopic({
      prefix: mqttPrefix,
      baseTopic: pathForDevice,
      postTopic: '',
    });
    return result;
  }
}
