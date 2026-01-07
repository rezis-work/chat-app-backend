import { redis } from '../db/redis';

const PRESENCE_TTL = 60; // seconds
const PRESENCE_KEY_PREFIX = 'presence:user:';
const SOCKET_KEY_PREFIX = 'socket:user:';
const LAST_SEEN_KEY_PREFIX = 'lastSeen:user:';
const CHAT_ROOM_KEY_PREFIX = 'chat:room:user:';

/**
 * Mark user as online
 * Adds socketId to set and sets presence key with TTL
 */
export async function markUserOnline(
  userId: string,
  socketId: string
): Promise<void> {
  const presenceKey = `${PRESENCE_KEY_PREFIX}${userId}`;
  const socketKey = `${SOCKET_KEY_PREFIX}${userId}`;

  // Add socketId to set
  await redis.sadd(socketKey, socketId);

  // Set presence key with TTL (refresh if already exists)
  await redis.setex(presenceKey, PRESENCE_TTL, 'online');
}

/**
 * Mark user as offline
 * Removes socketId from set, and if set is empty, marks user offline
 */
export async function markUserOffline(
  userId: string,
  socketId: string
): Promise<void> {
  const presenceKey = `${PRESENCE_KEY_PREFIX}${userId}`;
  const socketKey = `${SOCKET_KEY_PREFIX}${userId}`;
  const lastSeenKey = `${LAST_SEEN_KEY_PREFIX}${userId}`;

  // Remove socketId from set
  await redis.srem(socketKey, socketId);

  // Check if set is empty
  const socketCount = await redis.scard(socketKey);

  if (socketCount === 0) {
    // No more sockets, mark user offline
    await redis.del(presenceKey);
    await redis.set(lastSeenKey, new Date().toISOString());
  }
}

/**
 * Get user presence status
 * Returns online if presence key exists, otherwise offline with lastSeen
 */
export async function getUserPresence(userId: string): Promise<{
  status: 'online' | 'offline';
  lastSeen?: string;
}> {
  const presenceKey = `${PRESENCE_KEY_PREFIX}${userId}`;
  const lastSeenKey = `${LAST_SEEN_KEY_PREFIX}${userId}`;

  const isOnline = await redis.exists(presenceKey);

  if (isOnline) {
    return { status: 'online' };
  }

  const lastSeen = await redis.get(lastSeenKey);

  return {
    status: 'offline',
    lastSeen: lastSeen || undefined,
  };
}

/**
 * Check if user is online
 */
export async function isUserOnline(userId: string): Promise<boolean> {
  const presenceKey = `${PRESENCE_KEY_PREFIX}${userId}`;
  const exists = await redis.exists(presenceKey);
  return exists === 1;
}

/**
 * Refresh presence TTL (heartbeat)
 * Called on each socket event to keep user online
 */
export async function refreshPresenceTTL(userId: string): Promise<void> {
  const presenceKey = `${PRESENCE_KEY_PREFIX}${userId}`;
  const exists = await redis.exists(presenceKey);

  if (exists) {
    // Refresh TTL
    await redis.expire(presenceKey, PRESENCE_TTL);
  }
}

/**
 * Track that a socket joined a chat room
 */
export async function trackChatRoomJoin(
  userId: string,
  socketId: string,
  chatId: string
): Promise<void> {
  const key = `${CHAT_ROOM_KEY_PREFIX}${userId}`;
  await redis.sadd(key, `${socketId}:${chatId}`);
}

/**
 * Track that a socket left a chat room
 */
export async function trackChatRoomLeave(
  userId: string,
  socketId: string,
  chatId: string
): Promise<void> {
  const key = `${CHAT_ROOM_KEY_PREFIX}${userId}`;
  await redis.srem(key, `${socketId}:${chatId}`);
}

/**
 * Check if user is currently in a specific chat room
 */
export async function isUserInChatRoom(
  userId: string,
  chatId: string
): Promise<boolean> {
  const key = `${CHAT_ROOM_KEY_PREFIX}${userId}`;
  const members = await redis.smembers(key);
  return members.some(m => m.endsWith(`:${chatId}`));
}
