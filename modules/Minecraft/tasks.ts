import {
  Client,
  TextChannel,
  EmbedBuilder,
} from "discord.js";
import { prisma } from "@utils/prisma";
import { status } from "minecraft-server-util";
import getGuildSettings from "@utils/getGuildSettings";
import { t } from "utils/i18n";
import { getRedisClient } from "@utils/redis";
import { Logging } from "@utils/logging";

let instance: Tasks | null = null;
const redis = getRedisClient();

export default class Tasks {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
    if (instance) return instance;
    instance = this;

    setInterval(async () => {
      await this.task();
    }, 5000); // every 10 seconds
  }

  async task() {
    Logging.info("Running task Minecraft: Notify if players are online...");

    let data;
    const cachedData = await redis.get("minecraftSettings");

    if (cachedData) {
      data = JSON.parse(cachedData);
    } else {
      data = await prisma.minecraftSettings.findMany({
        where: {
          enabled: true,
          notifyEnabled: true,
        },
      });

      // Cache it for 5 minutes
      await redis.set("minecraftSettings", JSON.stringify(data), "EX", 300);
    }

    for (const server of data) {
      try {
        const guildSettings = await getGuildSettings(server.guildId);

        const res = await status(server.ip, server.port, { timeout: 5000 });
        const onlinePlayers = res.players.sample?.map(p => p.name) || [];

        const redisKey = `minecraft:players:${server.guildID}`;
        const cachedPlayersJSON = await redis.get(redisKey);
        const cachedPlayers: string[] = cachedPlayersJSON ? JSON.parse(cachedPlayersJSON) : [];

        const joined = onlinePlayers.filter(p => !cachedPlayers.includes(p));
        const left = cachedPlayers.filter(p => !onlinePlayers.includes(p));

        // Save new state
        await redis.set(redisKey, JSON.stringify(onlinePlayers));

        // Skip notifications if nothing changed
        if (joined.length === 0 && left.length === 0) continue;

        const channel = this.client.channels.cache.get(server.channel) as TextChannel;
        if (!channel) continue;

        let message = "";
        if (joined.length > 0) {
          message += `✅ **${joined.join(", ")}** joined the server.\n`;
        }
        if (left.length > 0) {
          message += `❌ **${left.join(", ")}** left the server.\n`;
        }

        if (message.length > 0) {
          const joinedText = joined.length > 0 ? `✅ **${joined.join(", ")}**` : "";
          const leftText = left.length > 0 ? `❌ **${left.join(", ")}**` : "";

          const embed = new EmbedBuilder()
            .setTitle(`Minecraft Server - ${t(guildSettings?.language, "player_update")}`)
            .setColor(guildSettings?.primaryColor || "#2F3136")
            .addFields(
              ...(joined.length > 0 ? [{ name: t(guildSettings?.language, "joined"), value: joinedText, inline: false }] : []),
              ...(left.length > 0 ? [{ name: t(guildSettings?.language, "left"), value: leftText, inline: false }] : [])
            )
            .setTimestamp()
            .setFooter({ text: "Minecraft Player Activity" });

          try {
            await channel.send({ embeds: [embed] });
            Logging.info(`Sent Minecraft player update for ${server.name}`);
          } catch (err) {
            Logging.error(`Failed to send embed in ${server.channelId}: ${err}`);
          }
        }
      } catch (err) {
        Logging.error(`Failed to check server ${server.ip}:${server.port}: ${err}`);
      }
    }
  }
}