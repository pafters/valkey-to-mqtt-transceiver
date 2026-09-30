import { Location } from 'src/entities/locations.entity';
import { removeForbiddenSymbols } from './removeForbiddenSymbols.helpler';

export function getLocationPath(
  locationId: number | null,
  locations: Location[],
  path: string[] = [],
): string[] | { siteName: string | undefined; newPath: string[] } {
  const location = locations.find((loc) => loc.id === locationId);

  if (!location) {
    return path; // Прекратить, если location не найден
  }

  const cleanLocationName = removeForbiddenSymbols(location.name);

  const newPath = [cleanLocationName, ...path]; // Добавить текущую location в начало

  if (location.location_id) {
    return getLocationPath(location.location_id, locations, newPath);
  } else {
    const cleanSiteName = location?.site?.name
      ? removeForbiddenSymbols(location?.site?.name)
      : undefined;
    return { siteName: cleanSiteName, newPath }; // Достигнут корень
  }
}
