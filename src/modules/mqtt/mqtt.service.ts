import { Inject, Injectable, Logger, LoggerService } from '@nestjs/common';
import { MqttConnection } from './mqtt.connection';
import { addContextDecoratorLogger } from 'src/infrastructure/logger/context.decorator.logger';

@Injectable()
export class MqttService {
  constructor(
    @Inject(Logger) private readonly logger: LoggerService,
    private readonly mqttConn: MqttConnection,
  ) {
    this.logger = addContextDecoratorLogger(logger, MqttService.name);
  }

  // message: valkey-value
  public async noWaitPublish(topic: string, message: string): Promise<void> {
    if (this.mqttConn.client.connected) {
      try {
        await this.mqttConn.client.publishAsync(topic, message, {
          qos: 0,
          retain: true,
        });
      } catch (e) {
        this.logger.error(
          `(noWaitPublish) topic=${topic} with message=${message} has not been sent`,
        );
        throw e;
      }
      // Отправляем сообщение без ожидания подтверждения
    } else {
      this.logger.error('(noWaitPublish) MQTT client is not connected');
      this.logger.error(
        `(noWaitPublish) topic=${topic} with message=${message} has not been sent`,
      );
    }
  }

  public waitPublish(topic: string, message: string): void {
    if (this.mqttConn.client.connected) {
      // Отправляем сообщение без ожидания подтверждения
      this.logger.log(`(noWaitPublish) MQTT SENDING TOPIC: `, topic);
      this.mqttConn.client.publish(
        topic,
        message,
        { qos: 0, retain: true },
        (err) => {
          if (err) {
            this.logger.error('Publish error:', err);
          }
        },
      );
    } else {
      this.logger.warn('MQTT client not connected');
    }
  }
}
