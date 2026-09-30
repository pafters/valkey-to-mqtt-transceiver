export function getEnumValue(
  keyValues: string[],
  value: number | string | boolean | null,
) {
  let resultValue: number | null = null;

  keyValues.forEach((k) => {
    const { 0: eKey, 1: eValue } = k.split('::');

    if (eValue === value) resultValue = Number(eKey);
  });

  return resultValue;
}
