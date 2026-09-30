import { Device } from 'src/entities/devices.entity';
import { Modem } from 'src/entities/modems.entity';

export function createSatpEntityMap(data: Device[] | Modem[]) {
  const map = new Map<number, number>();

  for (const element of data) {
    if (!element.server_alias_template_id) continue;

    map.set(element.id, element.server_alias_template_id);
  }

  return map;
}
