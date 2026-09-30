import { EcholotQualityCodeNumbers } from './EcholotQualityCodeNumbers.type';
import { QualityCodeNumbers } from './QualityCodeNumbers.type';

export type QualityCacheTypeItem = {
  quality: QualityCodeNumbers;
  echolotQuality: EcholotQualityCodeNumbers;
  updatedAt: Date;
};

export type QualityCacheType = {
  [device_id: number]: QualityCacheTypeItem;
};
