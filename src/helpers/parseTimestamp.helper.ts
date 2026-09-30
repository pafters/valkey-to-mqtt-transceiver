export function parseTimestamp(rawDate: number) {
  const dateTime = new Date(rawDate);

  if (isNaN(dateTime.valueOf()) === true) {
    throw new Error(
      `[ERROR] (parseTimestamp) isNaN(dateTime.valueOf()) error ${rawDate})}`,
    );
  }

  return dateTime.toISOString();
}
