import { DataTypeEnum } from 'src/types/DataTypeEnum.enum';
import { getBits } from './getBits.helper';
import { ServerAliasTemplateParameters } from 'src/entities/server_alias_template_parameters.entity';
import { getEnumValue } from './getEnumValue.helper';

export function convertValue(
  dataType: DataTypeEnum,
  value: string | number | boolean | null,
  sarverParameter: ServerAliasTemplateParameters,
  // translate,
): string | number | boolean | null {
  try {
    if (dataType === undefined || value === undefined || value === null) {
      return null;
    }
    switch (dataType) {
      case DataTypeEnum.enum: {
        const keyValues = sarverParameter.value_interpretation?.split(';');
        if (!keyValues) return null;

        return getEnumValue(keyValues, value);
      }
      case DataTypeEnum.bits: {
        return getBits(sarverParameter, value);
      }
      case DataTypeEnum.CSUVer: {
        const valuebytes = value;
        const arraybytes = valuebytes.toString(16).split('');
        if (arraybytes.length % 2 != 0) arraybytes.unshift('0');
        let res = '';
        switch (arraybytes.length) {
          case 4:
            res =
              parseInt(arraybytes[0] + arraybytes[1], 16) +
              '.' +
              parseInt(arraybytes[2] + arraybytes[3], 16);
            break;
          case 6:
            res =
              arraybytes[1] +
              arraybytes[2] +
              '.' +
              arraybytes[3] +
              arraybytes[4];
            break;
          case 8:
            res =
              parseInt(arraybytes[0] + arraybytes[1], 16) +
              '.' +
              parseInt(arraybytes[2] + arraybytes[3], 16) +
              '.' +
              parseInt(
                arraybytes[4] + arraybytes[5] + arraybytes[6] + arraybytes[7],
                16,
              );
            break;

          default:
            return res;
        }
        return res;
      }
      default:
        return value;
    }
  } catch (e) {
    console.error(`ERROR (convertValue):`, e);
    return null;
  }
}
