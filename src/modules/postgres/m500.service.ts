import { Inject, Injectable, Logger, LoggerService } from '@nestjs/common';

import { addContextDecoratorLogger } from 'src/infrastructure/logger/context.decorator.logger';
import { M500Connection } from './m500.connection';

import { Device } from 'src/entities/devices.entity';
import { Location } from 'src/entities/locations.entity';
import { ServerAliasTemplateParameters } from 'src/entities/server_alias_template_parameters.entity';
import { Vocabulary } from 'src/entities/vocabulary.entity';
import { ServerModemDeviceBinds } from 'src/entities/server_modem_device_binds.entity';
import { MqttOutgoingAlias } from 'src/types/MqttOutgoingAlias.type';
import { DeviceMqttOutgoingAlias } from 'src/types/DeviceMqttOutgoingAlias.type';
import { ModemMqttOutgoingAlias } from 'src/types/ModemMqttOutgoingAlias.type';
import { Modem } from 'src/entities/modems.entity';

@Injectable()
export class M500Service {
  constructor(
    @Inject(Logger) private readonly logger: LoggerService,
    private readonly m500Connection: M500Connection,
  ) {
    this.logger = addContextDecoratorLogger(logger, M500Service.name);
  }

  async getDevices(): Promise<Device[]> {
    try {
      return await this.m500Connection.deviceRepository.find({});
    } catch (e) {
      this.logger.error('ERROR (getDevices):', e);
      throw e;
    }
  }

  async getModems(): Promise<Modem[]> {
    try {
      return await this.m500Connection.modemRepository.find();
    } catch (e) {
      this.logger.error('ERROR (getModems):', e);
      throw e;
    }
  }

  async getLocations(): Promise<Location[]> {
    try {
      return await this.m500Connection.locationRepository.find({
        relations: ['site'],
      });
    } catch (e) {
      this.logger.error('ERROR (getDevices):', e);
      throw e;
    }
  }

  async getSatp(): Promise<ServerAliasTemplateParameters[]> {
    try {
      return await this.m500Connection.serverAliasTemplateParametersRepository.find(
        {},
      );
    } catch (e) {
      this.logger.error('ERROR (getSatp):', e);
      throw e;
    }
  }

  async getVocabulary(lang: string): Promise<Vocabulary[]> {
    try {
      return await this.m500Connection.vocabularyRepository.find({
        where: { lang },
      });
    } catch (e) {
      this.logger.error('ERROR (getSatp):', e);
      throw e;
    }
  }

  async getServerModemDeviceBinds(): Promise<ServerModemDeviceBinds[]> {
    try {
      return await this.m500Connection.serverModemDeviceBindsRepository.find(
        {},
      );
    } catch (e) {
      this.logger.error(`ERROR (getForeignDeviceIdsByModemId):`, e);
      throw e;
    }
  }

  async getMqttDeviceOutgoingAlias(
    device_id: number,
    alias: string,
  ): Promise<string | undefined> {
    try {
      const { 0: rawData } = await this.m500Connection.getRawSql<
        MqttOutgoingAlias[]
      >(
        `
        select
	        satp.alias,
          satp.mqtt_outgoing_alias
        from
        	server_alias_template_parameters satp
          inner join devices d on
	        d.server_alias_template_id = satp.server_alias_template_id
        where
          d.id = $1 and
          satp.alias = $2;
        `,
        [device_id, alias],
      );

      const result = rawData?.mqtt_outgoing_alias ?? undefined;

      return result;
    } catch (e) {
      this.logger.error(`ERROR (getMqttDeviceOutgoingAlias):`, e);
      throw e;
    }
  }

  async getMqttModemOutgoingAlias(modem_id: number, alias: string) {
    try {
      const rawData = await this.m500Connection.getRawSql<MqttOutgoingAlias[]>(
        `
        select
	        satp.alias,
          satp.mqtt_outgoing_alias
        from
        	server_alias_template_parameters satp
          inner join modems m on
	        m.server_alias_template_id = satp.server_alias_template_id
        where
          m.id = $1 and
          satp.alias = $2;
        `,
        [modem_id, alias],
      );

      const result: string | undefined =
        rawData[0]?.mqtt_outgoing_alias ?? undefined;

      return result;
    } catch (e) {
      this.logger.error(`ERROR (getMqttModemOutgoingAlias):`, e);
      throw e;
    }
  }

  async getAllDeviceMqttAliases() {
    const query = `
      select
        d.id as device_id,
        satp.alias,
        satp.mqtt_outgoing_alias
      from
        server_alias_template_parameters satp
        inner join devices d on
        d.server_alias_template_id = satp.server_alias_template_id
    `;

    const result =
      await this.m500Connection.getRawSql<DeviceMqttOutgoingAlias[]>(query);

    return result;
  }

  async getAllModemMqttAliases() {
    const query = `
      select
        m.id as modem_id,
        satp.alias,
        satp.mqtt_outgoing_alias
      from
        server_alias_template_parameters satp
        inner join modems m on
        m.server_alias_template_id = satp.server_alias_template_id
    `;

    const result =
      await this.m500Connection.getRawSql<ModemMqttOutgoingAlias[]>(query);

    return result;
  }

  async getAvailableAliases() {
    try {
      return await this.m500Connection.serverAliasTemplateParametersRepository
        .createQueryBuilder('satp')
        .select(
          'satp.mqtt_outgoing_alias, satp.alias, satp.server_alias_template_id',
        )
        .where('satp.mqtt_outgoing_alias IS NOT NULL')
        .andWhere("satp.mqtt_outgoing_alias != ''")
        .distinct(true)
        .getRawMany<
          Pick<
            ServerAliasTemplateParameters,
            'mqtt_outgoing_alias' | 'alias' | 'server_alias_template_id'
          >
        >();
    } catch (e) {
      this.logger.error(`ERROR (getAvailableAliases):`, e);
      throw e;
    }
  }
}
