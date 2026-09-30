import { Logger, Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';

import { MqttModule } from '../mqtt/mqtt.module';
import { SystemConfigModule } from '../system-config/system-config.module';
import { MessageRetryService } from './message-retry.service';

@Module({
  imports: [MqttModule, CacheModule, SystemConfigModule],
  providers: [Logger, MessageRetryService],
  exports: [MessageRetryService],
})
export class MessageRetryModule {}
