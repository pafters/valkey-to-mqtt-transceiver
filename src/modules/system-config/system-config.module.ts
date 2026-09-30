import { Logger, Module } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';

@Module({
  providers: [Logger, SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
