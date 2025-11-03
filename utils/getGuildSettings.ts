import { prisma } from "@utils/prisma";
import { getRedisClient } from "@utils/redis";

const redis = getRedisClient();

export default async function getGuildSettings(guildId: string) {
  const redisKey = `bot_settings:${guildId}`;

  // Try to get from cache
  const cachedData = await redis.get(redisKey);

  // Cache hit
  if (cachedData) {
    return JSON.parse(cachedData);
  }

  // Cache miss: fetch from database
  const settings = await prisma.botSettings.findUnique({
    where: {
      guildId,
    },
  });

  if (settings) {
    // Store in Redis for 5 minutes (320 seconds)
    await redis.set(redisKey, JSON.stringify(settings), "EX", 320);
  }

  return settings;
}
