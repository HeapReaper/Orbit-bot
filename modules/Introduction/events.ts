import {
  Client,
  TextChannel,
  Events as DiscordEvents,
  Message
} from "discord.js";
import { prisma } from "@utils/prisma";
import { getRedisClient } from "@utils/redis";

let instance: Events | null = null;
const redis = getRedisClient();

interface IntroSettings {
  guild_id: string;
  enabled: boolean;
  channel?: string | null;
  maxMessages: number;
  autoReply?: string | null;
  autoEmoji?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default class Events {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;

    if (instance) return instance;
    instance = this;

    this.client.on(DiscordEvents.MessageCreate, async (message: Message) => {
      if (!message.guild || message.author.bot) return;

      const guildId = message.guild.id;
      const cacheKey = `intro_settings:${guildId}`;

      // Try settings in cache first
      let settings: IntroSettings | null = null;
      const cached = await redis.get(cacheKey);

      if (cached) {
        settings = JSON.parse(cached) as IntroSettings;
      } else {
        // Fetch from DB if not in cache
        settings = await prisma.introductionSettings.findUnique({
          where: { guildId }
        }) as IntroSettings | null;

        // Cache in Redis for 3 minutes
        if (settings) {
          await redis.set(cacheKey, JSON.stringify(settings), "EX", 180);
        }
      }

      if (!settings || !settings.enabled) return;

      const targetChannel = settings.channel
        ? (message.guild.channels.cache.get(settings.channel) as TextChannel)
        : null;

      if (targetChannel && message.channel.id !== targetChannel.id) return;

      const channelToUse = targetChannel ?? (message.channel as TextChannel);

      const fetchedMessages = await channelToUse.messages.fetch({ limit: 100 });

      const userMessagesCount = fetchedMessages.filter(
        (msg) => msg.author.id === message.author.id
      ).size;

      if (userMessagesCount > settings.maxMessages) {
        await message.delete();
        // TODO: add notification
        return;
      }

      if (settings.autoReply) {
        await channelToUse.send(
          settings.autoReply.replace("{user}", `<@${message.author.id}>`)
        );
      }

      if (settings.autoEmoji) {
        try {
          await message.react(settings.autoEmoji);
        } catch (err) {
          console.warn("Invalid emoji in settings:", settings.autoEmoji);
        }
      }
    });
  }
}