import { ServerAliasTemplateParameters } from 'src/entities/server_alias_template_parameters.entity';
import { SatpAliasMap } from 'src/types/SatpAliasMap.type';

export function createSatpAliasMap(data: ServerAliasTemplateParameters[]) {
  const map: SatpAliasMap = new Map();

  for (const element of data) {
    const mapValue = map.get(element.alias);
    if (!element.mqtt_outgoing_alias) continue;

    if (mapValue) {
      mapValue.set(
        element.server_alias_template_id,
        element.mqtt_outgoing_alias,
      );
    } else {
      const mqttAliasMap = new Map([
        [element.server_alias_template_id, element.mqtt_outgoing_alias],
      ]);

      map.set(element.alias, mqttAliasMap);
    }
  }

  return map;
}
