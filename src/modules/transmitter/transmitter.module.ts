import { Logger, Module } from '@nestjs/common';

import { TransmitterService } from './transmitter.service';
import { ValkeyModule } from '../valkey/valkey.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { CacheModule } from '../cache/cache.module';
import { SystemConfigModule } from '../system-config/system-config.module';
import { M500Module } from '../postgres/m500.module';
import { MessageRetryModule } from '../message-retry/message-retry.module';

@Module({
  imports: [
    ValkeyModule,
    CacheModule,
    MqttModule,
    SystemConfigModule,
    M500Module,
    MessageRetryModule,
  ],
  providers: [Logger, TransmitterService],
})
export class TransmitterModule {}
