export function getDifferenceInMsBetweenDates(
  date1: Date,
  date2: Date = new Date(),
): number | undefined {
  try {
    if (date1 instanceof Date && date2 instanceof Date) {
      return date2.valueOf() - date1.valueOf();
    }
    return undefined;
  } catch (e) {
    console.error(`(getDifferenceInMsBetweenDates) error`, e);
    return undefined;
  }
}
