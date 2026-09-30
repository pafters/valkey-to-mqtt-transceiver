import { MqttOutgoingAlias } from './MqttOutgoingAlias.type';

export type DeviceMqttOutgoingAlias = MqttOutgoingAlias & { device_id: number };
