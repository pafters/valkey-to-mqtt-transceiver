import { config } from 'dotenv';

import { envPathProvider } from './infrastructure/env.path.provider';
import { checkEnvString } from './helpers/checkEnvString.helper';

config({ path: envPathProvider() });

checkEnvString(process.env.CRON_UPDATE_CACHE, 'CRON_UPDATE_CACHE');
checkEnvString(
  process.env.CRON_SEND_ALL_TRANSMITTER_MESSAGES,
  'CRON_SEND_ALL_TRANSMITTER_MESSAGES',
);
checkEnvString(
  process.env.CRON_SEND_ALL_TRANSCODER_MESSAGES,
  'CRON_SEND_ALL_TRANSCODER_MESSAGES',
);

export const CRON_CONFIG = {
  // правило для крона - периодичность выполнения процедуры обновления кэша топиков для каждого устройства (updateDeviceLocationSiteMap)
  CRON_UPDATE_CACHE: process.env.CRON_UPDATE_CACHE ?? '0 0 5 31 2 *',
  CRON_SEND_ALL_TRANSMITTER_MESSAGES:
    process.env.CRON_SEND_ALL_TRANSMITTER_MESSAGES ?? '0 0 5 31 2 *',
  CRON_SEND_ALL_TRANSCODER_MESSAGES:
    process.env.CRON_SEND_ALL_TRANSCODER_MESSAGES ?? '0 0 5 31 2 *',
};
