import { Queue, QueueOptions } from 'bullmq';

/**
 * Get Redis connection config for BullMQ
 * BullMQ needs connection object, not the Redis instance directly
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

/**
 * Create a BullMQ queue with shared Redis connection
 */
export function createQueue<T>(name: string, options?: QueueOptions): Queue<T> {
  return new Queue<T>(name, {
    connection: getConnection(),
    ...options,
  });
}
