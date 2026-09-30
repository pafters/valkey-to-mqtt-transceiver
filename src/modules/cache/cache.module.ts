import { Logger, Module } from '@nestjs/common';
import { M500Module } from '../postgres/m500.module';
import { CacheService } from './cache.service';
import { SystemConfigModule } from '../system-config/system-config.module';
import { ValkeyModule } from '../valkey/valkey.module';

@Module({
  imports: [M500Module, SystemConfigModule, ValkeyModule],
  providers: [Logger, CacheService],
  exports: [CacheService],
})
export class CacheModule {}
