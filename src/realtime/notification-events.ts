import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { env } from '../config/env';

let ioInstance: Server | null = null;
let httpServerInstance: ReturnType<typeof import('http').createServer> | null =
  null;

/**
 * Set the Socket.IO instance (for use in tests with main server)
 */
export function setSocketIOInstance(io: Server): void {
  ioInstance = io;
}

/**
 * Get Socket.IO instance (reuse main server instance if available)
 * For workers, create a new instance with Redis adapter
 */
function getSocketIOInstance(): Server {
  // Try to get from main server first (if in same process)
  // Otherwise create worker instance
  if (ioInstance) {
    return ioInstance;
  }

  // Create worker instance with Redis adapter
  const httpServer = require('http').createServer();
  httpServerInstance = httpServer;

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      credentials: true,
    },
  });

  const pubClient = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  ioInstance = io;
  return io;
}

/**
 * Close Socket.IO instance and all connections
 * Call this in tests to clean up
 */
export async function closeSocketIOForWorker(): Promise<void> {
  if (ioInstance) {
    await new Promise<void>(resolve => {
      ioInstance!.close(() => {
        resolve();
      });
    });
    ioInstance = null;
  }

  if (httpServerInstance) {
    await new Promise<void>(resolve => {
      httpServerInstance!.close(() => {
        resolve();
      });
    });
    httpServerInstance = null;
  }
}

/**
 * Emit notification event to user's personal room
 */
export async function emitNotificationEvent(
  userId: string,
  notification: any
): Promise<void> {
  const io = getSocketIOInstance();
  io.to(`user:${userId}`).emit('notification:new', {
    notification,
  });
}
