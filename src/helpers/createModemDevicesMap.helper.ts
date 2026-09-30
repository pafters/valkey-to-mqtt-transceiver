import { ModemDevicesMapType } from 'src/types/ModemDevicesMap.type';
import { ServerModemDeviceBinds } from 'src/entities/server_modem_device_binds.entity';

export function createModemDevicesMap(
  _serverModemDeviceBinds: ServerModemDeviceBinds[],
): ModemDevicesMapType {
  try {
    const modemDevicesMap: ModemDevicesMapType = {}; // собираем список устройтсв подходящих под отчет

    for (const item of _serverModemDeviceBinds) {
      try {
        if (!item) {
          continue;
        }
        const deviceId = item.device_id;
        const modemId = item.modem_id;

        if (!deviceId && !modemId) {
          continue;
        }

        if (!modemDevicesMap[modemId]) {
          modemDevicesMap[modemId] = [];
        }
        modemDevicesMap[modemId].push(deviceId);
      } catch (e) {
        console.error(
          `ERROR (createModemDevicesMap) for: ${JSON.stringify(item)}`,
          e,
        );
        continue;
      }
    }
    return modemDevicesMap;
  } catch (e) {
    console.error(`ERROR (createModemDevicesMap)`, e);
    return {};
  }
}
