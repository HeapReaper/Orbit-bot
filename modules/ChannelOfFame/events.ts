import {
  Client,
  TextChannel,
  Events as DiscordEvents,
  MessageReaction,
  User,
  PartialMessageReaction,
  PartialUser,
  EmbedBuilder,
} from "discord.js";
import { prisma } from "@utils/prisma";
import { getRedisClient } from "@utils/redis";
import getGuildSettings from "@utils/getGuildSettings";
import { t } from "@utils/i18n";
import {Logging} from "@utils/logging";

let instance: Events | null = null;
const redis = getRedisClient();

export default class Events {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;

    if (instance) return instance;
    instance = this;

    this.client.on(DiscordEvents.MessageReactionAdd, async (reaction, user) => {
      await this.handleEvent(reaction, user);
    });
  }

  async handleEvent(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    try {
      if (user.bot) return;

      if (reaction.partial) {
        try {
          reaction = await reaction.fetch();
        } catch (error) {
          Logging.error(`Failed to fetch partial reaction: ${error}`);
          return;
        }
      }

      const message = reaction.message.partial
        ? await reaction.message.fetch()
        : reaction.message;

      const guildId = message.guild?.id;
      if (!guildId) return;

      // Fetch settings from Redis or DB
      const redisKey = `channel_of_fame:${guildId}`;
      let settings;

      const cachedData = await redis.get(redisKey);
      if (cachedData) {
        settings = JSON.parse(cachedData);
      } else {
        settings = await prisma.channelOfFame.findMany({
          where: { guildId },
        });
        await redis.set(redisKey, JSON.stringify(settings), "EX", 320);
      }

      if (!settings || settings.length === 0) return;

      for (const setting of settings) {
        if (!setting.enabled) continue;

        if (reaction.emoji.name !== setting.emoji) continue;

        if (!reaction.count) continue;
        if (reaction.count < setting.amount) continue;

        const channel = await this.client.channels.fetch(setting.channel as string) as TextChannel;
        if (!channel) continue;

        if (!message.content || !message.author) continue;

        const guildSettings = await getGuildSettings(guildId);
        const hex = guildSettings?.primary_color?.replace("#", "") || "5865F2";
        const color = Number.isNaN(parseInt(hex, 16)) ? 0x5865F2 : parseInt(hex, 16);

        const embed = new EmbedBuilder()
          .setTitle("⭐ Channel Of Fame ⭐")
          .setColor(color)
          .setDescription(`${t(guildSettings.language, "user")}: <@${message.author.id}>`)
          .addFields({
            name: t(guildSettings.language, "message"),
            value: `\`\`\`\n${message.content}\n\`\`\``,
          });

        await channel.send({
          embeds: [embed],
          allowedMentions: { users: [message.author.id] },
        });
      }
    } catch (error) {
      Logging.error(`Error handling reaction event: ${error}`);
    }
  }
}