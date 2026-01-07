import Redis from 'ioredis';
import { env } from '../config/env';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required for Redis adapter
  });

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}
