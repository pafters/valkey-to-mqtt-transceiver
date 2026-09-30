import { EcholotQualityCodeNumbers } from './EcholotQualityCodeNumbers.type';
import { QualityCodeNumbers } from './QualityCodeNumbers.type';

export interface OutGoingMessage {
  d: string | number | boolean;
  dt: number;
  ts: string;
  q: QualityCodeNumbers | EcholotQualityCodeNumbers;
}
