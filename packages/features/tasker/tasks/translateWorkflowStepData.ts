import { z } from "zod";

import { WorkflowStepTranslationRepository } from "@calcom/features/ee/workflows/repositories/WorkflowStepTranslationRepository";
import { locales as i18nLocales } from "@calcom/lib/i18n";
import logger from "@calcom/lib/logger";
import {
  TRANSLATION_SUPPORTED_LOCALES,
  type TranslationSupportedLocale,
} from "@calcom/lib/translationConstants";
import { WorkflowStepAutoTranslatedField } from "@calcom/prisma/enums";

const ZTranslateWorkflowStepDataPayloadSchema = z.object({
  workflowStepId: z.number(),
  reminderBody: z.string().nullable().optional(),
  emailSubject: z.string().nullable().optional(),
  sourceLocale: z.string(),
});

async function processTranslations({
  text,
  sourceLocale,
  workflowStepId,
  field,
}: {
  text: string;
  field: WorkflowStepAutoTranslatedField;
} & Pick<z.infer<typeof ZTranslateWorkflowStepDataPayloadSchema>, "sourceLocale" | "workflowStepId">): Promise<void> {
  const { LingoDotDevService } = await import("@calcom/lib/server/service/lingoDotDev");

  try {
    const targetLocales = TRANSLATION_SUPPORTED_LOCALES.filter(
      (locale) => locale !== sourceLocale && i18nLocales.includes(locale)
    );

    const translations = await Promise.all(
      targetLocales.map((targetLocale) => LingoDotDevService.localizeText(text, sourceLocale, targetLocale))
    );

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
        workflowStepId,
        sourceLocale,
        targetLocale,
        translatedText,
      }));

      if (field === WorkflowStepAutoTranslatedField.REMINDER_BODY) {
        await WorkflowStepTranslationRepository.upsertManyBodyTranslations(translationData);
      } else {
        await WorkflowStepTranslationRepository.upsertManySubjectTranslations(translationData);
      }
    }
  } catch (error) {
    logger.error(`Failed to process workflow step ${field} translations:`, error);
  }
}

async function translateWorkflowStepData(payload: string): Promise<void> {
  const { workflowStepId, reminderBody, emailSubject, sourceLocale } =
    ZTranslateWorkflowStepDataPayloadSchema.parse(JSON.parse(payload));

  await Promise.all([
    reminderBody &&
      processTranslations({
        text: reminderBody,
        sourceLocale,
        workflowStepId,
        field: WorkflowStepAutoTranslatedField.REMINDER_BODY,
      }),
    emailSubject &&
      processTranslations({
        text: emailSubject,
        sourceLocale,
        workflowStepId,
        field: WorkflowStepAutoTranslatedField.EMAIL_SUBJECT,
      }),
  ]);
}

export { ZTranslateWorkflowStepDataPayloadSchema, translateWorkflowStepData };
