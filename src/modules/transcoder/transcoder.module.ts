import { Logger, Module } from '@nestjs/common';
import { ValkeyModule } from '../valkey/valkey.module';
import { M500Module } from '../postgres/m500.module';
import { TranscoderService } from './transcoder.service';
import { SystemConfigModule } from '../system-config/system-config.module';
import { CacheModule } from '../cache/cache.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { MessageRetryModule } from '../message-retry/message-retry.module';

@Module({
  imports: [
    ValkeyModule,
    M500Module,
    SystemConfigModule,
    CacheModule,
    MqttModule,
    MessageRetryModule,
  ],
  providers: [Logger, TranscoderService],
})
export class TranscoderModule {}
