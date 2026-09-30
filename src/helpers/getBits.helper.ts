import { ServerAliasTemplateParameters } from 'src/entities/server_alias_template_parameters.entity';

export function getBits(
  server_parameter: ServerAliasTemplateParameters,
  value: string | number | boolean | null,
): string | number | boolean | null {
  try {
    if (value === null) {
      return null;
    }
    if (
      server_parameter &&
      server_parameter.last_bit &&
      !server_parameter.first_bit
    )
      return value;
    const valuebits = value;
    let arraybits: string = valuebits.toString(2).split('').reverse().join('');
    const sizeBits =
      server_parameter.last_bit - server_parameter.first_bit - arraybits.length;
    if (sizeBits > 0) {
      arraybits = arraybits + '0'.repeat(sizeBits);
    }
    return arraybits;
  } catch (e) {
    console.error('ERROR (getBits)', e);
    return null;
  }
}
