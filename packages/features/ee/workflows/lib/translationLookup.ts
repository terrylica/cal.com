import { WorkflowStepTranslationRepository } from "../repositories/WorkflowStepTranslationRepository";
import { WorkflowStepAutoTranslatedField } from "@calcom/prisma/enums";

interface TranslationLookupResult {
  translatedBody?: string;
  translatedSubject?: string;
}

/**
 * Looks up translated content for a workflow step based on the target locale.
 * Returns the translated body and/or subject if available.
 */
export async function getWorkflowStepTranslations(
  workflowStepId: number,
  targetLocale: string,
  options: { includeBody?: boolean; includeSubject?: boolean } = { includeBody: true, includeSubject: false }
): Promise<TranslationLookupResult> {
  const result: TranslationLookupResult = {};

  const promises: Promise<void>[] = [];

  if (options.includeBody) {
    promises.push(
      WorkflowStepTranslationRepository.findByLocale(
        workflowStepId,
        WorkflowStepAutoTranslatedField.REMINDER_BODY,
        targetLocale
      ).then((translation) => {
        if (translation?.translatedText) {
          result.translatedBody = translation.translatedText;
        }
      })
    );
  }

  if (options.includeSubject) {
    promises.push(
      WorkflowStepTranslationRepository.findByLocale(
        workflowStepId,
        WorkflowStepAutoTranslatedField.EMAIL_SUBJECT,
        targetLocale
      ).then((translation) => {
        if (translation?.translatedText) {
          result.translatedSubject = translation.translatedText;
        }
      })
    );
  }

  await Promise.all(promises);

  return result;
}
