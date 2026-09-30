import { Logger, Module } from '@nestjs/common';
import { MqttConnection } from './mqtt.connection';
import { MqttService } from './mqtt.service';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [SystemConfigModule],
  providers: [Logger, MqttConnection, MqttService],
  exports: [MqttService],
})
export class MqttModule {}
