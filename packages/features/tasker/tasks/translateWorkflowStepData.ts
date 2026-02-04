import { getTranslationService } from "@calcom/features/di/containers/TranslationService";
import { getWorkflowStepTranslationRepository } from "@calcom/features/ee/workflows/di/WorkflowStepTranslationRepository.container";
import logger from "@calcom/lib/logger";
import { WorkflowStepAutoTranslatedField } from "@calcom/prisma/enums";
import { z } from "zod";

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
  sourceLocale: string;
  workflowStepId: number;
  field: WorkflowStepAutoTranslatedField;
}): Promise<void> {
  try {
    const translationService = await getTranslationService();
    const result = await translationService.translateText({ text, sourceLocale });

    if (result.translations.length > 0) {
      const translationData = result.translations.map(({ translatedText, targetLocale }) => ({
        workflowStepId,
        sourceLocale,
        targetLocale,
        translatedText,
      }));

      const workflowStepTranslationRepository = getWorkflowStepTranslationRepository();
      if (field === WorkflowStepAutoTranslatedField.REMINDER_BODY) {
        await workflowStepTranslationRepository.upsertManyBodyTranslations(translationData);
      } else {
        await workflowStepTranslationRepository.upsertManySubjectTranslations(translationData);
      }
    }

    if (result.failedLocales.length > 0) {
      logger.warn(
        `Failed to translate workflow step ${field} to locales: ${result.failedLocales.join(", ")}`
      );
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
