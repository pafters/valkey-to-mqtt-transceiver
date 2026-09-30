import { Device } from 'src/entities/devices.entity';
import { Location } from 'src/entities/locations.entity';
import { getLocationPath } from './getLocationPath.helper';
import { DeviceLocationSiteMapType } from 'src/types/DeviceLocationSiteMap.type';

export function createDeviceLocationSiteMap(
  _devices: Device[],
  _locations: Location[],
): DeviceLocationSiteMapType {
  const deviceLocationsMap: DeviceLocationSiteMapType = {}; // собираем список устройтсв подходящих под отчет
  for (const device of _devices) {
    if (!device) {
      continue;
    }
    const { siteName, newPath } = getLocationPath(
      device.location_id,
      _locations,
    ) as { siteName: string | undefined; newPath: string[] };
    if (siteName === undefined) {
      continue;
    }
    // const cleanDeviceName = device.location_id
    //   ? removeForbiddenSymbols(device.name)
    //   : undefined;

    // if (cleanDeviceName === undefined) {
    //   continue;
    // }

    deviceLocationsMap[device.id] = `${siteName}/` + newPath.join('/');
  }
  return deviceLocationsMap;
}
