import { ValkeyItemType } from './ValkeyItem.type';

export type CodeCompareValueRepo = Record<
  string | number,
  ValkeyItemType | { value: string | number | boolean | null }
>;

export type CodeCompareIrzTopicDescription = {
  alias: string;
  type: 'device' | 'modem';
};

export type CodeCompareType = {
  topicIRZ: CodeCompareIrzTopicDescription[];
  tagnameNIS: string;
  returningDataType: number;
  valueIRZ?: Record<string, unknown>;
  valueNIS?: Record<string, unknown>;
  formula: (
    device_id: number,
    values: CodeCompareValueRepo,
  ) => number | string | boolean | null;
};
