import { Worker } from 'bullmq';
import { prisma } from '../db/prisma';
import { getTranslationProvider } from '../modules/translation/translation.provider';
import { env } from '../config/env';
import { TranslationJobData } from '../queue/translation.queue';
import { emitTranslationEvent } from '../realtime/translation-events';

/**
 * Get Redis connection config for BullMQ
 */
function getConnection() {
  // Parse REDIS_URL to get host and port
  const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: url.password || undefined,
  };
}

const worker = new Worker<TranslationJobData>(
  env.TRANSLATION_QUEUE_NAME,
  async job => {
    const { messageId, chatId, fromLang, toLang, originalContent } = job.data;

    // Verify message still exists and not deleted
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message || message.deletedAt) {
      throw new Error(`Message ${messageId} not found or deleted`);
    }

    // Check if translation already exists (race condition protection)
    const existing = await prisma.messageTranslation.findUnique({
      where: {
        messageId_lang: {
          messageId,
          lang: toLang,
        },
      },
    });

    if (existing) {
      // Translation already exists, skip
      return { skipped: true, translationId: existing.id };
    }

    // Get translation provider
    const provider = getTranslationProvider();

    // Translate content
    const translatedContent = await provider.translate(
      originalContent,
      fromLang,
      toLang
    );

    // Determine provider name based on environment
    const providerName =
      process.env.NODE_ENV === 'test' ? 'mock' : 'openai';

    // Create translation record
    const translation = await prisma.messageTranslation.create({
      data: {
        messageId,
        lang: toLang,
        content: translatedContent,
        provider: providerName,
      },
    });

    // Emit socket event to chat room
    await emitTranslationEvent(chatId, {
      messageId,
      lang: toLang,
      content: translatedContent,
    });

    return { translationId: translation.id };
  },
  {
    connection: getConnection(),
    concurrency: env.TRANSLATION_CONCURRENCY,
    limiter: {
      max: env.TRANSLATION_CONCURRENCY,
      duration: 1000, // Per second
    },
  }
);

worker.on('completed', job => {
  console.log(`Translation job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Translation job ${job?.id} failed:`, err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await worker.close();
  process.exit(0);
});

export { worker };

