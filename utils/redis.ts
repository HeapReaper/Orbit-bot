import Redis from 'ioredis';
import {Logging} from "@utils/logging";
let redis: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (redis === null) {
    redis = new Redis(process.env.REDIS_URL || `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`, {
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    // Temp
    redis.on('connect', () => Logging.info("Redis connected"));
    redis.on('error', (err) => Logging.error(`Redis error: ${err.message}`));
  }
  return redis;
};

export const disconnectRedis = async () => {
  if (redis) {
    await redis.quit();
    redis = null;
  }
};