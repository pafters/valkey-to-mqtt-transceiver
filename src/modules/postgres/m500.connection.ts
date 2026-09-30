import { DataSource, Repository } from 'typeorm';
import {
  Inject,
  Injectable,
  Logger,
  LoggerService,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { addContextDecoratorLogger } from 'src/infrastructure/logger/context.decorator.logger';
import { Device } from 'src/entities/devices.entity';
import { Site } from 'src/entities/sites.entity';
import { Location } from 'src/entities/locations.entity';
import { ServerAliasTemplateParameters } from 'src/entities/server_alias_template_parameters.entity';
import { Vocabulary } from 'src/entities/vocabulary.entity';
import { ServerModemDeviceBinds } from 'src/entities/server_modem_device_binds.entity';
import { SystemConfigService } from '../system-config/system-config.service';
import { Modem } from 'src/entities/modems.entity';

@Injectable()
export class M500Connection implements OnModuleInit, OnModuleDestroy {
  private postgres: DataSource;

  public deviceRepository: Repository<Device>;
  public modemRepository: Repository<Modem>;
  public locationRepository: Repository<Location>;
  public siteRepository: Repository<Site>;
  public serverAliasTemplateParametersRepository: Repository<ServerAliasTemplateParameters>;
  public vocabularyRepository: Repository<Vocabulary>;
  public serverModemDeviceBindsRepository: Repository<ServerModemDeviceBinds>;

  constructor(
    @Inject(Logger) private readonly logger: LoggerService,
    private readonly systemConfig: SystemConfigService,
  ) {
    this.logger = addContextDecoratorLogger(logger, M500Connection.name);
  }

  async onModuleInit(): Promise<void> {
    this.init();
    this.logger.log('POSTGRESQL connecting...');
    await this.connect();
    this.logger.log('POSTGRESQL connection SUCCESS');

    this.deviceRepository = this.postgres.getRepository(Device);
    this.modemRepository = this.postgres.getRepository(Modem);
    this.locationRepository = this.postgres.getRepository(Location);
    this.siteRepository = this.postgres.getRepository(Site);
    this.serverAliasTemplateParametersRepository = this.postgres.getRepository(
      ServerAliasTemplateParameters,
    );
    this.serverModemDeviceBindsRepository = this.postgres.getRepository(
      ServerModemDeviceBinds,
    );

    this.vocabularyRepository = this.postgres.getRepository(Vocabulary);
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('POSTGRESQL disconnecting...');
    await this.postgres.destroy();
    this.logger.log('POSTGRESQL DISCONNECTED');
  }

  public async getRawSql<T = any>(query: string, params?: any[]): Promise<T> {
    const result = await this.postgres.query<T>(query, params);
    return result;
  }

  private init() {
    this.logger.log('POSTGRESQL initing...');

    this.postgres = new DataSource({
      type: 'postgres',
      ...this.systemConfig.postgresConfig,
      synchronize: false, // !!! при значении true таблица в базе данных перезапишется под структуру модели в коде. Влечет потери данных и связей
      entities: [
        Device,
        Modem,
        Location,
        Site,
        ServerAliasTemplateParameters,
        Vocabulary,
        ServerModemDeviceBinds,
      ],
    });

    this.logger.log('POSTGRESQL inited');
  }

  private async connect(): Promise<void> {
    this.logger.log('POSTGRESQL connecting...');
    await this.postgres.initialize();
    this.logger.log('POSTGRESQL connection SUCCESS');
    // this.liveRepository = postgres.getRepository(Live);
  }
}
