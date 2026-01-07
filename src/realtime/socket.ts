import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { env } from '../config/env';
import { redis } from '../db/redis';
import { verifyAccessToken } from '../utils/jwt';
import { prisma } from '../db/prisma';
import { getUserChatIds } from '../modules/chats/chats.service';
import { sendMessage } from '../modules/messages/messages.service';
import {
  markChatAsRead,
  verifyChatMembership,
} from '../modules/chats/chats.service';
import {
  markUserOnline,
  markUserOffline,
  refreshPresenceTTL,
} from './presence.service';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from './types';

/**
 * Setup Socket.IO server with Redis adapter
 */
export function setupSocketIO(
  httpServer: HttpServer
): Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData> {
  // Create Socket.IO server
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    {},
    SocketData
  >(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    },
  });

  // Setup Redis adapter for horizontal scaling
  // Create separate pub/sub clients (required by adapter)
  const pubClient = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  const subClient = pubClient.duplicate();

  io.adapter(createAdapter(pubClient, subClient));

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      // Get token from handshake auth or Authorization header
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication required'));
      }

      // Verify token
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;

      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on(
    'connection',
    async (
      socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>
    ) => {
      const userId = socket.data.userId;

      if (!userId) {
        socket.disconnect();
        return;
      }

      try {
        // Verify user exists
        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          socket.disconnect();
          return;
        }

        // Mark user online
        await markUserOnline(userId, socket.id);

        // Join user's personal room
        socket.join(`user:${userId}`);

        // Get all chats user is member of
        const chatIds = await getUserChatIds(userId);

        // Join all chat rooms
        for (const chatId of chatIds) {
          socket.join(`chat:${chatId}`);
        }

        // Emit presence update to all chat rooms user is member of
        for (const chatId of chatIds) {
          io.to(`chat:${chatId}`).emit('presence:update', {
            userId,
            status: 'online',
          });
        }

        // Event handlers

        // chat:join - Join a chat room
        socket.on('chat:join', async data => {
          try {
            refreshPresenceTTL(userId);

            const { chatId } = data;

            // Verify membership
            await verifyChatMembership(userId, chatId);

            // Join room
            socket.join(`chat:${chatId}`);
          } catch (error) {
            socket.emit('error', {
              message:
                error instanceof Error ? error.message : 'Failed to join chat',
            });
          }
        });

        // chat:leave - Leave a chat room
        socket.on('chat:leave', async data => {
          try {
            refreshPresenceTTL(userId);

            const { chatId } = data;

            // Verify membership
            await verifyChatMembership(userId, chatId);

            // Leave room
            socket.leave(`chat:${chatId}`);
          } catch (error) {
            socket.emit('error', {
              message:
                error instanceof Error ? error.message : 'Failed to leave chat',
            });
          }
        });

        // message:send - Send a message
        socket.on('message:send', async data => {
          try {
            refreshPresenceTTL(userId);

            const { chatId, content } = data;

            // Call existing service
            const message = await sendMessage(userId, chatId, content);

            // Emit to chat room
            io.to(`chat:${chatId}`).emit('message:new', {
              chatId,
              message,
            });
          } catch (error) {
            socket.emit('error', {
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to send message',
            });
          }
        });

        // typing:start - User started typing
        socket.on('typing:start', async data => {
          try {
            refreshPresenceTTL(userId);

            const { chatId } = data;

            // Verify membership
            await verifyChatMembership(userId, chatId);

            // Emit to chat room (excluding sender)
            socket.to(`chat:${chatId}`).emit('typing', {
              chatId,
              userId,
              isTyping: true,
            });
          } catch (error) {
            socket.emit('error', {
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to send typing indicator',
            });
          }
        });

        // typing:stop - User stopped typing
        socket.on('typing:stop', async data => {
          try {
            refreshPresenceTTL(userId);

            const { chatId } = data;

            // Verify membership
            await verifyChatMembership(userId, chatId);

            // Emit to chat room (excluding sender)
            socket.to(`chat:${chatId}`).emit('typing', {
              chatId,
              userId,
              isTyping: false,
            });
          } catch (error) {
            socket.emit('error', {
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to send typing indicator',
            });
          }
        });

        // read:mark - Mark chat as read
        socket.on('read:mark', async data => {
          try {
            refreshPresenceTTL(userId);

            const { chatId, lastReadMessageId } = data;

            // Call existing service
            await markChatAsRead(userId, chatId, lastReadMessageId);

            // Emit to chat room
            io.to(`chat:${chatId}`).emit('read:update', {
              chatId,
              userId,
              lastReadMessageId,
            });
          } catch (error) {
            socket.emit('error', {
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to mark chat as read',
            });
          }
        });

        // Disconnection handler
        socket.on('disconnect', async () => {
          try {
            // Get chat IDs before marking offline (to emit presence update)
            const chatIds = await getUserChatIds(userId);

            // Mark user offline
            await markUserOffline(userId, socket.id);

            // Check if user is still online (has other sockets)
            const socketKey = `socket:user:${userId}`;
            const socketCount = await redis.scard(socketKey);

            // If no more sockets, emit presence update to all chat rooms
            if (socketCount === 0) {
              const lastSeenKey = `lastSeen:user:${userId}`;
              const lastSeen = await redis.get(lastSeenKey);

              for (const chatId of chatIds) {
                io.to(`chat:${chatId}`).emit('presence:update', {
                  userId,
                  status: 'offline',
                  lastSeen: lastSeen || undefined,
                });
              }
            }
          } catch (error) {
            console.error('Error handling disconnect:', error);
          }
        });
      } catch (error) {
        console.error('Error in connection handler:', error);
        socket.disconnect();
      }
    }
  );

  return io;
}
