import { Logger, Module } from '@nestjs/common';

import { ValkeyConnection } from './valkey.connection';
import { ValkeyService } from './valkey.service';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [SystemConfigModule],
  providers: [Logger, ValkeyConnection, ValkeyService],
  exports: [ValkeyService],
})
export class ValkeyModule {}
