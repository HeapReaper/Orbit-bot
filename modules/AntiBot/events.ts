import {
  Client,
  Events as DiscordEvents,
  Message,
  TextChannel,
} from "discord.js";
import { prisma } from "@utils/prisma";
import { getRedisClient } from "@utils/redis";

const redis = getRedisClient();
let instance: Events | null = null;

export default class Events {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;

    if (instance) return instance;
    instance = this;

    this.client.on(DiscordEvents.MessageCreate, this.handleMessage.bind(this));
  }

  private async handleMessage(message: Message) {
    if (!message.guild || message.author.bot) return;

    const guildId = message.guild.id;

    let settingsRaw = await redis.get(`antibot:${guildId}`);
    let settings: any;

    if (settingsRaw) {
      settings = JSON.parse(settingsRaw);
    } else {
      settings = await prisma.antiBotSettings.findUnique({
        where: { guildId },
      });

      if (!settings) return;

      await redis.set(`antibot:${guildId}`, JSON.stringify(settings), "EX", 600);
    }

    if (!settings.enabled) return;

    const key = `antibot_count:${guildId}:${message.author.id}`;
    let countRaw = await redis.get(key);
    let count = countRaw ? parseInt(countRaw) : 0;
    count++;

    await redis.set(key, count.toString(), "EX", settings.timeWindow);

    if (count > settings.channelLimit) {
      switch (settings.punishment) {
        case "kick":
          if (message.member?.kickable) {
            await message.member.kick("Anti-bot triggered");
          }
          break;
        case "ban":
          if (message.member?.bannable) {
            await message.member.ban({ reason: "Anti-bot triggered" });
          }
          break;
        case "jail":
          if (settings.jailRole && message.member) {
            const role = message.guild.roles.cache.get(settings.jailRole);
            if (!role) return;

            try {
              await message.member.roles.add(role, "Anti-bot triggered");
            } catch (err) {
              console.error(`Failed to add jail role: ${err}`);
            }
          }
          break;
        case "none":
        default:
          break;
      }

      if (settings.notificationChannel) {
        const channel = message.guild.channels.cache.get(settings.notificationChannel);
        if (channel && channel.isTextBased()) {
          await (channel as TextChannel).send(`${message.author.tag} triggered the anti-bot system.`);
        }
      }

      await redis.del(key);
    }

    if (Array.isArray(settings.forbiddenWords) && settings.forbiddenWords.length > 0) {
      const forbiddenWords: string[] = settings.forbiddenWords;
      const foundWord = forbiddenWords.find(word =>
        message.content.toLowerCase().includes(word.toLowerCase())
      );

      if (!foundWord) return;

      await message.delete().catch(() => {});

      if (!settings.notificationChannel) return;

      const channel = message.guild.channels.cache.get(settings.notificationChannel);
      if (channel && channel.isTextBased()) {
        await (channel as TextChannel).send(`${message.author.tag} used a forbidden word: ${foundWord}`);
      }
    }
  }
}