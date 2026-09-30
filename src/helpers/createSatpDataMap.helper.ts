import { ServerAliasTemplateParameters } from 'src/entities/server_alias_template_parameters.entity';
import { SatpDataMapType } from 'src/types/SatpDataMapType.type';

export function createSatpDataMap(
  _satp: ServerAliasTemplateParameters[],
): SatpDataMapType {
  const satpDataMap: SatpDataMapType = {}; // собираем список устройтсв подходящих под отчет

  for (const tag of _satp) {
    if (!tag) {
      continue;
    }

    satpDataMap[tag.alias] = tag;
  }
  return satpDataMap;
}
