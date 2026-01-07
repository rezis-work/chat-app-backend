import '../tests/setup';
import { io as Client } from 'socket.io-client';
import { createServer } from 'http';
import { createApp } from '../src/server';
import { setupSocketIO } from '../src/realtime/socket';
import { prisma } from '../src/db/prisma';
import { registerUser } from '../src/modules/auth/auth.service';
import { createOrGetDmChat } from '../src/modules/chats/chats.service';
import { signAccessToken } from '../src/utils/jwt';
import { sendMessage } from '../src/modules/messages/messages.service';
import {
  addTranslationJob,
  translationQueue,
  TranslationJobData,
} from '../src/queue/translation.queue';
import { Worker } from 'bullmq';
import { getTranslationProvider } from '../src/modules/translation/translation.provider';
import {
  emitTranslationEvent,
  closeSocketIOForWorker,
} from '../src/realtime/translation-events';

/**
 * Get Redis connection config for BullMQ
 */
function getConnection() {
  const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: url.password || undefined,
  };
}

describe('Translation Queue', () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: ReturnType<typeof setupSocketIO>;
  let worker: Worker<TranslationJobData>;
  let userA: { id: string; accessToken: string };
  let userB: { id: string; accessToken: string };
  let chatId: string;

  beforeAll(async () => {
    // Create HTTP server and Socket.IO
    const app = createApp();
    httpServer = createServer(app);
    io = setupSocketIO(httpServer);

    // Start server on random port
    await new Promise<void>(resolve => {
      httpServer.listen(0, () => {
        resolve();
      });
    });

    // Create test worker that processes jobs immediately
    worker = new Worker<TranslationJobData>(
      'translation',
      async job => {
        try {
          const { messageId, chatId, fromLang, toLang, originalContent } =
            job.data;

          // Verify message still exists
          const message = await prisma.message.findUnique({
            where: { id: messageId },
          });

          if (!message || message.deletedAt) {
            throw new Error(`Message ${messageId} not found or deleted`);
          }

          // Check if translation already exists
          const existing = await prisma.messageTranslation.findUnique({
            where: {
              messageId_lang: {
                messageId,
                lang: toLang,
              },
            },
          });

          if (existing) {
            return { skipped: true, translationId: existing.id };
          }

          // Get translation provider (mock in test)
          const provider = getTranslationProvider();

          // Translate content
          const translatedContent = await provider.translate(
            originalContent,
            fromLang,
            toLang
          );

          // Create translation record
          const translation = await prisma.messageTranslation.create({
            data: {
              messageId,
              lang: toLang,
              content: translatedContent,
              provider: 'mock',
            },
          });

          // Emit socket event
          await emitTranslationEvent(chatId, {
            messageId,
            lang: toLang,
            content: translatedContent,
          });

          return { translationId: translation.id };
        } catch (error) {
          // Log but don't crash worker
          console.error('Worker error:', error);
          throw error;
        }
      },
      {
        connection: getConnection(),
        concurrency: 5,
      }
    );

    // Suppress unhandled error events (they're expected when jobs are processed quickly)
    worker.on('error', error => {
      // Ignore "Missing key" errors - they happen when jobs are processed/cleaned up quickly
      const errorWithCode = error as Error & { code?: number };
      if (error.message?.includes('Missing key') || errorWithCode.code === -1) {
        return;
      }
      console.error('Worker error:', error);
    });
  });

  afterAll(async () => {
    try {
      // Wait for any active jobs to complete (give them time)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Close worker and wait for it to finish
      // Worker.close() will wait for active jobs to complete
      await worker.close();
      
      // Wait for worker to fully close and release connections
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Close Socket.IO instance created by translation-events
      await closeSocketIOForWorker();
      
      // Clean up queue (after worker is closed)
      try {
        await translationQueue.obliterate({ force: true });
      } catch (error) {
        // Ignore errors during cleanup
      }
      
      // Close queue connection (after worker is closed)
      try {
        await translationQueue.close();
      } catch (error) {
        // Ignore errors
      }
      
      // Close main Socket.IO and HTTP server
      await new Promise<void>(resolve => {
        io.close(() => {
          httpServer.close(() => {
            resolve();
          });
        });
      });
      
      // Wait a bit more for all connections to close
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      // Ignore cleanup errors
      console.error('Cleanup error:', error);
    }
  });

  beforeEach(async () => {
    // Wait for any active jobs to finish before cleanup
    await new Promise(resolve => setTimeout(resolve, 100));

    // Clean up queue
    try {
      await translationQueue.obliterate({ force: true });
    } catch (error) {
      // Ignore errors during cleanup (jobs might be processing)
    }

    // Create test users
    const userAResult = await registerUser({
      email: `usera-${Date.now()}@test.com`,
      password: 'password123',
    });
    userA = {
      id: userAResult.user.id,
      accessToken: signAccessToken(userAResult.user.id),
    };

    const userBResult = await registerUser({
      email: `userb-${Date.now()}@test.com`,
      password: 'password123',
    });
    userB = {
      id: userBResult.user.id,
      accessToken: signAccessToken(userBResult.user.id),
    };

    // Create DM chat
    const chat = await createOrGetDmChat(userA.id, userB.id);
    chatId = chat.chat.id;
  });

  afterEach(async () => {
    // Wait for any active jobs to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    // Clean up queue
    try {
      await translationQueue.obliterate({ force: true });
    } catch (error) {
      // Ignore errors during cleanup (jobs might be processing or already cleaned)
    }
  });

  describe('Job Enqueueing', () => {
    it('should enqueue translation job when sending message', async () => {
      // Set language preferences
      await prisma.chatLanguagePreference.upsert({
        where: {
          chatId_userId: {
            chatId,
            userId: userA.id,
          },
        },
        create: {
          chatId,
          userId: userA.id,
          myLanguage: 'en',
          viewLanguage: 'en',
        },
        update: {
          myLanguage: 'en',
          viewLanguage: 'en',
        },
      });

      await prisma.chatLanguagePreference.upsert({
        where: {
          chatId_userId: {
            chatId,
            userId: userB.id,
          },
        },
        create: {
          chatId,
          userId: userB.id,
          myLanguage: 'en',
          viewLanguage: 'es', // Different view language
        },
        update: {
          myLanguage: 'en',
          viewLanguage: 'es',
        },
      });

      // Send message
      const message = await sendMessage(userA.id, chatId, 'Hello world');

      // Wait a bit for job to be enqueued and potentially processed
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check queue for jobs (check all states since worker processes quickly)
      const jobs = await translationQueue.getJobs([
        'waiting',
        'active',
        'completed',
      ]);
      expect(jobs.length).toBeGreaterThan(0);

      // Find the job for this message
      const job = jobs.find(
        j => j.data.messageId === message.id && j.data.toLang === 'es'
      );
      expect(job).toBeDefined();
      expect(job?.id).toBe(`translation:${message.id}:es`);
    });

    it('should use correct jobId format', async () => {
      // Create a message first (worker needs it to exist)
      const message = await prisma.message.create({
        data: {
          chatId,
          senderId: userA.id,
          type: 'TEXT',
          content: 'Hello',
        },
      });

      const jobData: TranslationJobData = {
        messageId: message.id,
        chatId,
        fromLang: 'en',
        toLang: 'es',
        originalContent: message.content,
      };

      await addTranslationJob(jobData);

      // Check job was added with correct ID (might be processed already, so check all states)
      const allJobs = await translationQueue.getJobs([
        'waiting',
        'active',
        'completed',
      ]);

      const job = allJobs.find(
        j => j.data.messageId === message.id && j.data.toLang === 'es'
      );
      expect(job).toBeDefined();
      expect(job?.id).toBe(`translation:${message.id}:es`);

      // Wait for job to complete if it's still processing
      await new Promise(resolve => setTimeout(resolve, 500));
    });
  });

  describe('Deduplication', () => {
    it('should not create duplicate translations for same (messageId, lang)', async () => {
      // Create a message
      const message = await prisma.message.create({
        data: {
          chatId,
          senderId: userA.id,
          type: 'TEXT',
          content: 'Test message',
        },
      });

      const jobData: TranslationJobData = {
        messageId: message.id,
        chatId,
        fromLang: 'en',
        toLang: 'es',
        originalContent: message.content,
      };

      // Enqueue same job twice
      await addTranslationJob(jobData);
      await addTranslationJob(jobData);

      // Wait for jobs to process
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check that only one translation exists
      const translations = await prisma.messageTranslation.findMany({
        where: {
          messageId: message.id,
          lang: 'es',
        },
      });

      expect(translations.length).toBe(1);
    });
  });

  describe('Socket Event Emission', () => {
    it('should emit message:translated when worker completes', done => {
      const port = (httpServer.address() as { port: number }).port;
      const client = Client(`http://localhost:${port}`, {
        auth: {
          token: userB.accessToken,
        },
      });

      client.on('connect', async () => {
        // Create a message
        const message = await prisma.message.create({
          data: {
            chatId,
            senderId: userA.id,
            type: 'TEXT',
            content: 'Hello world',
          },
        });

        // Listen for translation event
        client.on('message:translated', data => {
          expect(data.chatId).toBe(chatId);
          expect(data.messageId).toBe(message.id);
          expect(data.lang).toBe('es');
          expect(data.content).toBeDefined();
          client.disconnect();
          done();
        });

        // Enqueue translation job
        await addTranslationJob({
          messageId: message.id,
          chatId,
          fromLang: 'en',
          toLang: 'es',
          originalContent: message.content,
        });

        // Wait for job to process
        await new Promise(resolve => setTimeout(resolve, 500));
      });

      client.on('connect_error', done);
    });
  });

  describe('Safety Limits', () => {
    it('should limit to max 10 target languages per message', async () => {
      // Create many users with different view languages
      const users = [];
      for (let i = 0; i < 15; i++) {
        const userResult = await registerUser({
          email: `user${i}-${Date.now()}@test.com`,
          password: 'password123',
        });
        users.push(userResult.user);

        // Add to chat with different view language
        await prisma.chatMember.create({
          data: {
            chatId,
            userId: userResult.user.id,
            role: 'MEMBER',
          },
        });

        await prisma.chatLanguagePreference.upsert({
          where: {
            chatId_userId: {
              chatId,
              userId: userResult.user.id,
            },
          },
          create: {
            chatId,
            userId: userResult.user.id,
            myLanguage: 'en',
            viewLanguage: `lang${i}`, // Different language for each
          },
          update: {
            viewLanguage: `lang${i}`,
          },
        });
      }

      // Set sender language
      await prisma.chatLanguagePreference.upsert({
        where: {
          chatId_userId: {
            chatId,
            userId: userA.id,
          },
        },
        create: {
          chatId,
          userId: userA.id,
          myLanguage: 'en',
          viewLanguage: 'en',
        },
        update: {
          myLanguage: 'en',
          viewLanguage: 'en',
        },
      });

      // Send message
      await sendMessage(userA.id, chatId, 'Hello');

      // Wait for jobs to be enqueued
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check that only 10 jobs were enqueued (15 users + sender = 16 languages, but max 10)
      // Check all states since worker processes quickly
      const jobs = await translationQueue.getJobs([
        'waiting',
        'active',
        'completed',
      ]);
      // We check that at most 10 unique jobs exist (some might be completed already)
      const uniqueJobIds = new Set(jobs.map(j => j.id));
      expect(uniqueJobIds.size).toBeLessThanOrEqual(10);

      // Wait for remaining jobs to process
      await new Promise(resolve => setTimeout(resolve, 500));
    });
  });
});
