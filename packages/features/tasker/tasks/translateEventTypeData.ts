import { z } from "zod";

import { EventTypeTranslationRepository } from "@calcom/features/eventTypeTranslation/repositories/EventTypeTranslationRepository";
import { locales as i18nLocales } from "@calcom/lib/i18n";
import logger from "@calcom/lib/logger";
import {
  TRANSLATION_SUPPORTED_LOCALES,
  type TranslationSupportedLocale,
} from "@calcom/lib/translationConstants";
import { EventTypeAutoTranslatedField } from "@calcom/prisma/enums";

export const ZTranslateEventDataPayloadSchema = z.object({
  eventTypeId: z.number(),
  userId: z.number(),
  description: z.string().nullable().optional(),
  title: z.string().optional(),
  userLocale: z.string(),
});

async function processTranslations({
  text,
  userLocale,
  eventTypeId,
  userId,
  field,
}: {
  text: string;
  field: EventTypeAutoTranslatedField;
} & z.infer<typeof ZTranslateEventDataPayloadSchema>) {
  const { LingoDotDevService } = await import("@calcom/lib/server/service/lingoDotDev");

  try {
    const targetLocales = TRANSLATION_SUPPORTED_LOCALES.filter(
      (locale) => locale !== userLocale && i18nLocales.includes(locale)
    );

    const translations = await Promise.all(
      targetLocales.map((targetLocale) => LingoDotDevService.localizeText(text, userLocale, targetLocale))
    );

    // Map translations with their locales first, then filter out null translations
    // This maintains alignment between translations and their target locales
    const translationsWithLocales = translations.map((trans, index) => ({
      translatedText: trans,
      targetLocale: targetLocales[index],
    }));

    const validTranslations = translationsWithLocales.filter(
      (item): item is { translatedText: string; targetLocale: TranslationSupportedLocale } =>
        item.translatedText !== null
    );

    if (validTranslations.length > 0) {
      const translationData = validTranslations.map(({ translatedText, targetLocale }) => ({
        eventTypeId,
        sourceLocale: userLocale,
        targetLocale,
        translatedText,
        userId,
      }));

      const upsertMany =
        field === EventTypeAutoTranslatedField.DESCRIPTION
          ? EventTypeTranslationRepository.upsertManyDescriptionTranslations
          : EventTypeTranslationRepository.upsertManyTitleTranslations;

      await upsertMany(translationData);
    }
  } catch (error) {
    logger.error(`Failed to process ${field} translations:`, error);
  }
}

export async function translateEventTypeData(payload: string): Promise<void> {
  const { eventTypeId, description, title, userLocale, userId } = ZTranslateEventDataPayloadSchema.parse(
    JSON.parse(payload)
  );

  await Promise.all([
    description &&
      processTranslations({
        text: description,
        userLocale,
        eventTypeId,
        userId,
        field: EventTypeAutoTranslatedField.DESCRIPTION,
      }),
    title &&
      processTranslations({
        text: title,
        userLocale,
        eventTypeId,
        userId,
        field: EventTypeAutoTranslatedField.TITLE,
      }),
  ]);
}
