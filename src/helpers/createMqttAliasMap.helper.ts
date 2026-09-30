import { DeviceMqttOutgoingAlias } from 'src/types/DeviceMqttOutgoingAlias.type';
import { ModemMqttOutgoingAlias } from 'src/types/ModemMqttOutgoingAlias.type';
import { MqttOutgoingAlias } from 'src/types/MqttOutgoingAlias.type';

type MqttAliasArgs =
  | [aliasBy: 'modem', aliases: ModemMqttOutgoingAlias[]]
  | [aliasBy: 'device', aliases: DeviceMqttOutgoingAlias[]];

export function createMqttAliasMap(...[aliasBy, aliases]: MqttAliasArgs) {
  try {
    const aliasMap = new Map<number, MqttOutgoingAlias[]>();

    if (aliasBy === 'device') {
      for (const alias of aliases) {
        const currentAlias = aliasMap.get(alias.device_id);
        if (currentAlias)
          currentAlias.push({
            alias: alias.alias,
            mqtt_outgoing_alias: alias.mqtt_outgoing_alias,
          });
        else
          aliasMap.set(alias.device_id, [
            {
              alias: alias.alias,
              mqtt_outgoing_alias: alias.mqtt_outgoing_alias,
            },
          ]);
      }
    } else if (aliasBy === 'modem') {
      for (const alias of aliases) {
        const currentAlias = aliasMap.get(alias.modem_id);
        if (currentAlias)
          currentAlias.push({
            alias: alias.alias,
            mqtt_outgoing_alias: alias.mqtt_outgoing_alias,
          });
        else
          aliasMap.set(alias.modem_id, [
            {
              alias: alias.alias,
              mqtt_outgoing_alias: alias.mqtt_outgoing_alias,
            },
          ]);
      }
    }

    return aliasMap;
  } catch (e) {
    console.error(`ERROR (createModemDevicesMap)`, e);
    return;
  }
}
