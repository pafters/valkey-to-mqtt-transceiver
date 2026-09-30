import {
  Inject,
  Injectable,
  Logger,
  LoggerService,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { MqttService } from '../mqtt/mqtt.service';
import { addContextDecoratorLogger } from 'src/infrastructure/logger/context.decorator.logger';
import { RetryMessage } from 'src/types/RetryMessage.type';
import { CacheService } from '../cache/cache.service';
import { SystemConfigService } from '../system-config/system-config.service';

@Injectable()
export class MessageRetryService
  implements OnModuleDestroy, OnApplicationBootstrap
{
  private RETRY_TIMEOUT = 60 * 1000;
  private CHECK_TIMEOUT = 10 * 1000;
  private isTimerInProgress = false;

  private messagesMap = new Map<string, RetryMessage>();

  constructor(
    @Inject(Logger) private readonly logger: LoggerService,
    private readonly cacheService: CacheService,
    private readonly mqttService: MqttService,
    private readonly systemConfig: SystemConfigService,
  ) {
    this.logger = addContextDecoratorLogger(logger, MessageRetryService.name);
  }

  onApplicationBootstrap() {
    setInterval(() => {
      void this.handleTimerForMessageRetry();
    }, this.CHECK_TIMEOUT);
    this.cacheService.subscribeToUpdateCacheEvent(() => {
      try {
        void this.handleCacheUpdate();
      } catch {
        this.logger.error(
          `Error during cleaning in ${MessageRetryService.name} cache update`,
        );
      }
    });
  }

  onModuleDestroy() {
    this.messagesMap.clear();
  }

  handleCacheUpdate() {
    const keyToDelete = new Set<string>();
    this.messagesMap.forEach((message, topic) => {
      const deviceId = message.deviceId;
      const actualCacheLocationPathForDevice =
        this.cacheService.getMqttTopicLocationPathForDevice(deviceId);
      if (actualCacheLocationPathForDevice === undefined) {
        keyToDelete.add(topic);
        return;
      }
      if (message.baseMqttPath !== actualCacheLocationPathForDevice) {
        keyToDelete.add(topic);
      }
    });
    keyToDelete.forEach((topic) => {
      this.logger.warn(
        `Removing topic ${topic} from retry message. Reason, device was deleted or moved.`,
      );
      this.destroyRetryMessage(topic);
    });
  }

  registerMessage(
    topic: string,
    message: string,
    deviceId: number,
    baseMqttPath: string,
  ) {
    try {
      this.destroyRetryMessage(topic);

      this.addRetryMessage(topic, message, deviceId, baseMqttPath);
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }

  private addRetryMessage(
    topic: string,
    message: string,
    deviceId: number,
    baseMqttPath: string,
  ) {
    try {
      const retryMessage: RetryMessage = {
        body: message,
        last_send_timestamp: Date.now(),
        deviceId: deviceId,
        baseMqttPath,
      };

      this.messagesMap.set(topic, retryMessage);

      this.logger.debug!(
        `(addRetryMessage) RetryMessage register to topic ${topic}, ${message}`,
      );
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }

  private destroyRetryMessage(topic: string) {
    this.messagesMap.delete(topic);
  }

  destroyAllRetryMessagesByDeviceIds(idsToRemove: Set<number>) {
    const newMap = new Map<string, RetryMessage>(
      [...this.messagesMap.entries()].filter(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ([_, v]) => !idsToRemove.has(v.deviceId),
      ),
    );
    this.messagesMap = newMap;
  }

  private async handleTimerForMessageRetry() {
    try {
      if (this.isTimerInProgress === true) {
        return;
      }
      this.isTimerInProgress = true;
      const dateNow = Date.now();
      await Promise.all(
        [...this.messagesMap.entries()].map(async ([topic, record]) => {
          try {
            if (dateNow - record.last_send_timestamp <= this.RETRY_TIMEOUT) {
              return;
            }

            this.logger.debug!(
              `(defferredPublishMessage) Publishing to topic ${topic}, ${record?.body}`,
            );

            if (
              record &&
              record.body &&
              record.baseMqttPath &&
              record.deviceId
            ) {
              this.messagesMap.set(topic, {
                body: record.body,
                last_send_timestamp: dateNow,
                deviceId: record.deviceId,
                baseMqttPath: record.baseMqttPath,
              });
              await this.mqttService.noWaitPublish(topic, record.body);
            }
          } catch (e) {
            this.logger.error(e);
          }
        }),
      );
    } finally {
      this.isTimerInProgress = false;
    }
  }
}
