import { createQueue } from './queue';
import { env } from '../config/env';

export interface TranslationJobData {
  messageId: string;
  chatId: string;
  fromLang: string;
  toLang: string;
  originalContent: string;
}

const translationQueue = createQueue<TranslationJobData>(
  env.TRANSLATION_QUEUE_NAME
);

/**
 * Add translation job with deduplication
 * JobId format: translation:<messageId>:<toLang>
 */
export async function addTranslationJob(
  data: TranslationJobData
): Promise<void> {
  const jobId = `translation:${data.messageId}:${data.toLang}`;

  await translationQueue.add('translate', data, {
    jobId, // Deduplication: same jobId = same job
    attempts: env.TRANSLATION_MAX_RETRIES,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2s, exponential backoff
    },
  });
}

export { translationQueue };
