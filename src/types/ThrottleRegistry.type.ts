export type ThrottleRegistry = {
  timeoutTime: number;
  lastMsg: string;
  mqttTopic: string;
  deviceId: number;
  baseMqttPath: string;
};
