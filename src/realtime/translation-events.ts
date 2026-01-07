import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { env } from '../config/env';

let ioInstance: Server | null = null;
let httpServerInstance: ReturnType<
  typeof import('http').createServer
> | null = null;

/**
 * Initialize Socket.IO instance for worker process
 * Workers run in separate process, so need their own Socket.IO server
 */
export function initializeSocketIOForWorker(): Server {
  if (ioInstance) {
    return ioInstance;
  }

  // Create minimal HTTP server (not actually used, just for Socket.IO)
  const httpServer = require('http').createServer();
  httpServerInstance = httpServer;

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      credentials: true,
    },
  });

  // Use Redis adapter to emit events (same Redis as main server)
  const pubClient = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));
  // Note: Redis clients are managed by Socket.IO adapter
  // They will be closed when Socket.IO closes

  ioInstance = io;
  return io;
}

/**
 * Close Socket.IO instance and all connections
 * Call this in tests to clean up
 */
export async function closeSocketIOForWorker(): Promise<void> {
  if (ioInstance) {
    try {
      await new Promise<void>(resolve => {
        ioInstance!.close(() => {
          resolve();
        });
      });
    } catch (error) {
      // Ignore errors during close
    }
    ioInstance = null;
  }

  if (httpServerInstance) {
    try {
      await new Promise<void>(resolve => {
        httpServerInstance!.close(() => {
          resolve();
        });
      });
    } catch (error) {
      // Ignore errors during close
    }
    httpServerInstance = null;
  }

  // Note: Redis clients are managed by Socket.IO adapter
  // When Socket.IO closes, it will close the adapter connections automatically
  // We don't need to manually disconnect them
}

/**
 * Emit translation event to chat room
 * Can be called from worker process
 */
export async function emitTranslationEvent(
  chatId: string,
  data: {
    messageId: string;
    lang: string;
    content: string;
  }
): Promise<void> {
  const io = initializeSocketIOForWorker();

  // Emit to chat room via Redis adapter
  io.to(`chat:${chatId}`).emit('message:translated', {
    chatId,
    ...data,
  });
}

