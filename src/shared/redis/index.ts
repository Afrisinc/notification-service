import Redis from 'ioredis';

const NODE_ENV = process.env.NODE_ENV || 'development';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = new Redis(REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (attempt: number) => Math.min(attempt * 200, 5000),
  reconnectOnError: (err: Error) => err.message.includes('READONLY'),
});

redisClient.on('ready', () => console.log('Redis connection established successfully on', NODE_ENV));
redisClient.on('error', (err: Error) => console.error('Redis connection error:', err.message));

export const verifyRedisConnection = async (): Promise<boolean> => {
  try {
    if (redisClient.status === 'wait') {
      await redisClient.connect();
    }
    await redisClient.ping();
    return true;
  } catch (err) {
    console.error('Unable to connect to Redis:', err);
    return false;
  }
};

export const closeRedisConnection = async () => {
  try {
    await redisClient.quit();
    console.log('Redis connection closed cleanly.');
  } catch (err) {
    console.error('Error during Redis disconnection:', err);
  }
};
