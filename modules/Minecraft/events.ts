import { Client, TextChannel } from "discord.js";
import { prisma } from "@utils/prisma";
import { getRedisClient } from "@utils/redis";

let instance: Events | null = null;
const redis = getRedisClient();

interface MinecraftSettings {
  guild_id: string;
  enabled: boolean;
  ip: string;
  port: number;
  channel: string;
  notify_enabled: boolean;
}

export default class Events {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;

    if (instance) return instance;
    instance = this;

    // ✅ Bind the context so `this` works inside task()
    setInterval(this.task.bind(this), 1000);
  }

  async task(): Promise<void> {
    const cacheKey = `minecraft_settings`;
    let settings: MinecraftSettings[] | null = null;

    // Try to get settings from cache first
    const cached = await redis.get(cacheKey);

    if (cached) {
      try {
        settings = JSON.parse(cached) as MinecraftSettings[];
      } catch (err) {
        console.error("Failed to parse cached Minecraft settings:", err);
        settings = null;
      }
    }

    //
    if (!settings) {
      settings = await prisma.minecraft_settings.findMany();

      // Cache settings in Redis for 3 minutes
      await redis.set(cacheKey, JSON.stringify(settings), "EX", 180); // expires after 60s
    }

    for (const s of settings) {
      if (!s.enabled) continue;
      console.log(`Checking server ${s.ip}:${s.port} for guild ${s.guild_id}`);
    }
  }
}
