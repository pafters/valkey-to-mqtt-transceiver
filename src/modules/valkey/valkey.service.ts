import { Inject, Injectable, Logger, LoggerService } from '@nestjs/common';
import { addContextDecoratorLogger } from 'src/infrastructure/logger/context.decorator.logger';
import { ValkeyConnection } from './valkey.connection';

import { ValkeyItemType } from 'src/types/ValkeyItem.type';
import { ValkeySuffixItem } from 'src/types/ValkeySuffixItem.type';

@Injectable()
export class ValkeyService {
  constructor(
    @Inject(Logger) private readonly logger: LoggerService,
    private readonly valkeyConn: ValkeyConnection,
  ) {
    this.logger = addContextDecoratorLogger(logger, ValkeyService.name);
  }

  async getValueByKey(key: string): Promise<ValkeyItemType | null> {
    try {
      const type = await this.valkeyConn.valkeyClient.type(key);

      if (type !== 'string') {
        throw new Error(
          `getValueKey Failed With incorrect type=${type} for polling data key=${key}. Expected type='string'`,
        );
      }
      const value = await this.valkeyConn.valkeyClient.get(key);
      if (value) {
        const parsedData: ValkeyItemType = JSON.parse(value) as ValkeyItemType;
        return parsedData;
      }
      return null;
    } catch {
      // this.logger.error(error);
      return null;
    }
  }

  // Подписка на изменения (например, на событие пуша)
  async subscribeToChanges(
    channel: string,
    callback: (message: string) => void | Promise<void>,
  ): Promise<void> {
    await this.valkeyConn.valkeySubscriber.subscribe(channel);
    this.logger.log(`Subscribed to Valkey channel: ${channel}`);
    this.valkeyConn.valkeySubscriber.on(
      'message',
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (channelName, message) => {
        try {
          if (channelName === channel) {
            await callback(message);
          }
        } catch (e) {
          this.logger.error(`ERROR (subscribeToChanges):`, e);
        }
      },
    );
  }

  async unsubscribeFromChanges(channel: string): Promise<void> {
    await this.valkeyConn.valkeySubscriber.unsubscribe(channel);
    this.logger.log(`Unsubscribed from Valkey channel: ${channel}`);
  }

  async getValuesBySuffix(suffix: string) {
    const stream = this.valkeyConn.valkeyClient.scanStream({
      match: `*${suffix}`,
      count: 10000,
    });

    const allData: ValkeySuffixItem[] = [];

    for await (const keys of stream) {
      const strKeys = keys as string[];
      if (strKeys.length === 0) continue;

      const values = await this.valkeyConn.valkeyClient.mget(strKeys);

      for (let index = 0; index < strKeys.length; index++) {
        const value = values[index];
        const key = strKeys[index];

        if (value !== null)
          allData.push({ key, value: JSON.parse(value) as ValkeyItemType });
      }
    }
    return allData;
  }
}
