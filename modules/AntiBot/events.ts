import {
  Client, EmbedBuilder,
  Events as DiscordEvents, GuildMember,
  Message, PartialGuildMember,
  TextChannel,
} from "discord.js";
import { prisma } from "@utils/prisma";
import { getRedisClient } from "@utils/redis";
import { t } from "@utils/i18n";
import { Logging } from "@utils/logging.ts";
import getGuildSettings from "@utils/getGuildSettings.ts";

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
    if (message.webhookId) return;

    const guildId = message.guild.id;

    let settingsRaw: string | null = await redis.get(`antibot:${guildId}`);
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

    const discordInviteRegex = /(https?:\/\/)?(www\.)?(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9]+/i;

    // If message contains invite link and blocking it is enabled
    if (discordInviteRegex.test(message.content) && settings.blockInvites) {
      if (!message.member?.permissions.has("ManageGuild")) {
        await message.delete();

        await this.sendNotification(message, "non_admin_send_discord_invite", settings)
      }
    }

    const key = `antibot_count:${guildId}:${message.author.id}`;
    let countRaw = await redis.get(key);
    let count = countRaw ? parseInt(countRaw) : 0;
    count++;

    await redis.set(key, count.toString(), "EX", settings.timeWindow);

    if (count >= settings.channelLimit) {
      let jailError = false;
      let muteError = false;

      if (settings.excludeAdmins && message.member?.permissions.has("ManageGuild")) return;

      switch (settings.punishment) {
        case "mute":
          if (message.member?.manageable) {
            try {
              await message.member.timeout(10 * 60 * 1000, "Anti-bot triggered");
            } catch (err: any) {
              console.error(`Failed to mute user: ${err}`);
              if (err.code === 50013) muteError = true;
            }
          }
          break;
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
            if (!role) break;

            try {
              await message.member.roles.add(role, "Anti-bot triggered");
            } catch (err: any) {
              console.error(`Failed to add jail role: ${err}`);

              if (err.code === 50013) {
                jailError = true;
              }
            }
          }
          break;
        case "none":
        default:
          break;
      }

      await this.sendNotification(message, "to_many_messages_in_different_channels" , settings);

      await redis.del(key);
    }

    if (Array.isArray(settings.forbiddenWords) && settings.forbiddenWords.length > 0) {
      const forbiddenWords: string[] = settings.forbiddenWords;
      const foundWord = forbiddenWords.find(word =>
        message.content.toLowerCase().includes(word.toLowerCase())
      );

      if (!foundWord) return;

      await message.delete();

      await this.sendNotification(message, "used_forbidden_word" , settings);
    }
  }

  async sendNotification(message: Message, reason: string, settings) {
    const guildSettings = await getGuildSettings(message.guild.id)

    if (!settings) return;

    if (!settings.notificationChannel) return;

    const channel = message.guild.channels.cache.get(settings.notificationChannel) as TextChannel;

    if (!channel || !channel.isTextBased()) return;

    let member = message.member;
    if (member.partial) {
      try {
        member = await member.fetch();
      } catch (err) {
        Logging.error(`Failed to fetch partial member: ${err}`);
        return;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(t(guildSettings.language ?? "EN", "anti_bot_notification"))
      .setColor(guildSettings?.primaryColor || "#2F3136")
      .setDescription(`${t(guildSettings.language ?? "en", "triggered_by")}: <@${member.id}>`)
      .addFields(
        { name: t(guildSettings.language ?? "EN", "reason"), value: t(guildSettings.language ?? "en", reason)},
        { name: t(guildSettings.language ?? "EN", "punishment"), value: t(guildSettings.language ?? "en", settings.punishment)}
      );

    await channel.send({ embeds: [embed] });
  }
}