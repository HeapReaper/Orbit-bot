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
    if (user.bot) return;

    const message = reaction.message;
    const guildId = message.guild?.id;
    if (!guildId) return;

    const redisKey = `channel_of_fame:${guildId}`;
    let settings;

    const cachedData = await redis.get(redisKey);
    if (cachedData) {
      settings = JSON.parse(cachedData);
    } else {
      settings = await prisma.channel_of_fame.findMany({
        where: { guild_id: guildId },
      });
      await redis.set(redisKey, JSON.stringify(settings), "EX", 320);
    }

    if (!settings || settings.length === 0) return;

    for (const setting of settings) {
      if (!setting.enabled) continue;

      if (reaction.emoji.name !== setting.emoji) return;

      if (!reaction.count) return;

      if (reaction.count < setting.amount) return

      const channel = await this.client.channels.fetch(setting.channel as string) as TextChannel;

      if (!channel) return;

      if (!reaction.message.content || !reaction.message.author) return;

      const guildSettings = await getGuildSettings(guildId);

      const embed: EmbedBuilder = new EmbedBuilder()
        .setTitle("Channel Of Fame")
        .setColor(parseInt(guildSettings.primary_color.replace("#", ""), 16) ?? "Purple")
        .setDescription(`${t(guildSettings.language, "user")}: <@${reaction.message.author.id}>`)
        .addFields(
          {
            name: t(guildSettings.language, "message"),
            value: `\`\`\`\n${reaction.message.content}\n\`\`\``
          },
        );

      await channel.send({
        embeds: [embed],
        allowedMentions: { users: [reaction.message.author.id] }
      });
    }
  }
}
