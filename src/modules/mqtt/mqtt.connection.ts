import {
  Inject,
  Injectable,
  Logger,
  LoggerService,
  OnModuleInit,
} from '@nestjs/common';
import * as mqtt from 'mqtt';
import { addContextDecoratorLogger } from 'src/infrastructure/logger/context.decorator.logger';
import { SystemConfigService } from '../system-config/system-config.service';

@Injectable()
export class MqttConnection implements OnModuleInit {
  public client: mqtt.MqttClient;

  constructor(
    @Inject(Logger) private readonly logger: LoggerService,
    private readonly systemConfig: SystemConfigService,
  ) {
    this.logger = addContextDecoratorLogger(logger, MqttConnection.name);
  }

  async onModuleInit() {
    await this.init();
    this.connect();
  }

  async init() {
    this.client = await mqtt.connectAsync(
      `mqtt://${this.systemConfig.mqttConfing.host}:${this.systemConfig.mqttConfing.port}`,
      {
        username: this.systemConfig.mqttConfing.username,
        password: this.systemConfig.mqttConfing.password,
        clean: true,
        keepalive: 60,
        clientId: this.systemConfig.mqttConfing.clientId,
      },
    );
  }

  private connect() {
    this.client.on('connect', () => {
      this.logger.log('Connected to MQTT broker');
    });

    this.client.on('error', (err) => {
      this.logger.error('MQTT error:', err);
    });

    this.client.on('close', () => {
      this.logger.warn('MQTT connection closed');
    });
  }
}
