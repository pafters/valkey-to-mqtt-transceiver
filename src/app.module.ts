import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { envPathProvider } from './infrastructure/env.path.provider';

import { ValkeyModule } from './modules/valkey/valkey.module';
import { MqttModule } from './modules/mqtt/mqtt.module';
import { M500Module } from './modules/postgres/m500.module';
import { TransmitterModule } from './modules/transmitter/transmitter.module';
import { CacheModule } from './modules/cache/cache.module';
import { SystemConfigModule } from './modules/system-config/system-config.module';
import { TranscoderModule } from './modules/transcoder/transcoder.module';
import { MessageRetryModule } from './modules/message-retry/message-retry.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: envPathProvider(),
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    ValkeyModule,
    M500Module,
    MqttModule,
    TransmitterModule,
    CacheModule,
    SystemConfigModule,
    TranscoderModule,
    MessageRetryModule,
  ],
  controllers: [],
  providers: [Logger],
})
export class AppModule {}
