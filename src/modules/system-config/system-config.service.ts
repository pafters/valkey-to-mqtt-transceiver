import {
  Inject,
  Injectable,
  Logger,
  LoggerService,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { checkEnvNumber } from 'src/helpers/checkEnvNumber.helper';
import { checkEnvString } from 'src/helpers/checkEnvString.helper';
import { addContextDecoratorLogger } from 'src/infrastructure/logger/context.decorator.logger';
import { DBConfigType } from 'src/types/DBConfig.type';
import { MqttConfigType } from 'src/types/MqttConfig.type';
import { ValkeyConfigType } from 'src/types/ValkeyConfig.type';

// !REVIEW Реализация в целом интересна. Я бы переделал следующие:
// 1) В функциях check, я бы по мимо проверки ещё бы сохранял конфигурации внутри приватных переменных класса
// 2) Все "getConfig" функции я бы переделал, что бы они выдавали копии сохранённых внутри приватных переменных классов
// Причина: переменные process.env могут быть изменены в ходе runtime, хоть это и не должно происходить, это возможно. Я бы хотел этого избежать обращаясь к process.env один раз, во время инициализации приложения.
@Injectable()
export class SystemConfigService implements OnApplicationBootstrap {
  constructor(@Inject(Logger) private readonly logger: LoggerService) {
    this.logger = addContextDecoratorLogger(logger, SystemConfigService.name);
  }

  onApplicationBootstrap() {
    this.checkDatabaseConfig();
    this.checkValkeyConfig();
    this.checkVocabularyLang();
    this.checkMqttConfig();
    this.checkCacheLifeSettings();
  }

  // Настройки подключения к базе данных
  private checkDatabaseConfig(): void {
    try {
      checkEnvString(process.env.DB_HOST, 'DB_HOST');
      checkEnvNumber(process.env.DB_PORT, 'DB_PORT');
      checkEnvString(process.env.DB_USER, 'DB_HOST');
      checkEnvString(process.env.DB_PASSWORD, 'DB_HOST');
      checkEnvString(process.env.DB_NAME, 'DB_HOST');
    } catch (e) {
      this.logger.error(`ERROR (checkDatabaseConfig): `, e);
      throw e;
    }
  }

  get postgresConfig(): DBConfigType {
    return {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    };
  }

  // настройки подключения к valkey
  private checkValkeyConfig(): void {
    try {
      checkEnvString(process.env.VALKEY_HOST, 'VALKEY_HOST');
      checkEnvNumber(process.env.VALKEY_PORT, 'VALKEY_PORT');
      checkEnvNumber(process.env.VALKEY_DB, 'VALKEY_DB');
      if (process.env.VALKEY_AUTH_REQUIRE === 'true') {
        checkEnvString(process.env.VALKEY_USERNAME, 'VALKEY_USERNAME');
        checkEnvString(process.env.VALKEY_PASSWORD, 'VALKEY_PASSWORD');
      }
    } catch (e) {
      this.logger.error(`ERROR (checkValkeyConfig): `, e);
      throw e;
    }
  }

  get valkeyConfig(): ValkeyConfigType {
    const config: ValkeyConfigType = {
      host: process.env.VALKEY_HOST,
      port: Number(process.env.VALKEY_PORT),
      db: Number(process.env.VALKEY_DB),
    };
    if (process.env.VALKEY_AUTH_REQUIRE === 'true') {
      config.username = process.env.VALKEY_USERNAME;
      config.password = process.env.VALKEY_PASSWORD;
    }
    return config;
  }

  // Настройки языка системы
  private checkVocabularyLang(): void {
    try {
      checkEnvString(process.env.VOCABULARY_LANG, 'VOCABULARY_LANG');
    } catch (e) {
      this.logger.error(`ERROR (checkVocabularyLang): `, e);
      throw e;
    }
  }

  get vocabularyLang(): string {
    return String(process.env.VOCABULARY_LANG);
  }

  // НАСТРОЙКИ MQTT
  private checkMqttConfig(): void {
    try {
      checkEnvString(process.env.MQTT_HOST, 'MQTT_HOST');
      checkEnvNumber(process.env.MQTT_PORT, 'MQTT_PORT');
      checkEnvString(process.env.MQTT_USERNAME, 'MQTT_USERNAME');
      checkEnvString(process.env.MQTT_PASSWORD, 'MQTT_PASSWORD');
      checkEnvString(process.env.MQTT_CLIENT_ID, 'MQTT_CLIENT_ID');
      checkEnvString(process.env.MQTT_TOPIC_PREFIX, 'MQTT_TOPIC_PREFIX', true);
    } catch (e) {
      this.logger.error(`ERROR (checkMqttConfig): `, e);
      throw e;
    }
  }

  get mqttConfing(): MqttConfigType {
    return {
      host: process.env.MQTT_HOST,
      port: Number(process.env.MQTT_PORT),
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clientId: process.env.MQTT_CLIENT_ID,
    };
  }

  get mqttPrefix(): string {
    return String(process.env.MQTT_TOPIC_PREFIX);
  }

  // Ограничения жизни кэша
  private checkCacheLifeSettings(): void {
    try {
      const dbCacheLifeMs =
        process.env.MAX_LIMIT_IN_MS_AT_LAST_UPD_CACHE_BEFORE_ERROR;
      const qualityCacheLifeMs = process.env.QUALITY_CACHE_LIFE_MS;

      checkEnvNumber(
        dbCacheLifeMs,
        'MAX_LIMIT_IN_MS_AT_LAST_UPD_CACHE_BEFORE_ERROR',
      );
      checkEnvNumber(qualityCacheLifeMs, 'QUALITY_CACHE_LIFE_MS');
    } catch (e) {
      this.logger.error(`ERROR (checkCacheLifeSettings): `, e);
      throw e;
    }
  }

  get dbCacheLifeMs(): number {
    return Number(process.env.MAX_LIMIT_IN_MS_AT_LAST_UPD_CACHE_BEFORE_ERROR);
  }

  get qualityCacheLifeMs(): number {
    return Number(process.env.QUALITY_CACHE_LIFE_MS);
  }
}
