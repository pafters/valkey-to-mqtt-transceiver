export function removeForbiddenSymbols(
  text: string,
  variant: 'text' | 'mqtt_alias' = 'text',
): string {
  let cleanString = text
    .replace(/#/g, '<<sharp>>')
    .replace(/\+/g, '<<plus>>')
    .replace(/\$/g, '<<dollar>>');

  if (variant === 'text') cleanString = cleanString.replace(/\//g, '<<slash>>');

  return cleanString;
}
