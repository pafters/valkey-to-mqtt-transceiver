import { Vocabulary } from 'src/entities/vocabulary.entity';
import { WordTranslationMapType } from 'src/types/WordTranslationMapType.type';

export function createWordTranslationMap(_vocabulary: Vocabulary[]) {
  const wordTranslationMap: WordTranslationMapType = {}; // собираем список устройтсв подходящих под отчет

  for (const item of _vocabulary) {
    if (!item) {
      continue;
    }

    wordTranslationMap[item.word] = item.translation;
  }
  return wordTranslationMap;
}
