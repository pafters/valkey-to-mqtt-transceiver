export type RetryMessage = {
  body: string;
  last_send_timestamp: number;
  deviceId: number;
  baseMqttPath: string;
};
