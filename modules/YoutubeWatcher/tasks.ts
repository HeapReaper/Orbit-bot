import {Client, EmbedBuilder, TextChannel} from "discord.js";
import { prisma } from "@utils/prisma";
import { getRedisClient } from "@utils/redis";
import cron from "node-cron";
import { Logging } from "@utils/logging";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import getGuildSettings from "@utils/getGuildSettings";

let instance: Tasks | null = null;
const redis = getRedisClient();

export default class Tasks {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
    if (instance) return instance;
    instance = this;

    cron.schedule("* * * * *", async () => {
      Logging.info("Running YoutubeWatcher background task")
      await this.task();
    });
  }

  async task() {
    const cachedData = await redis.get("youtubeWatcherData");
    const watchers = cachedData
      ? JSON.parse(cachedData)
      : await prisma.youtubeWatcher.findMany({ where: { enabled: true } });

    if (!cachedData) {
      await redis.set("youtubeWatcherData", JSON.stringify(watchers), "EX", 60); // cache 1 minute
    }

    for (const watcher of watchers) {
      const guild = this.client.guilds.cache.get(watcher.guildId);
      if (!guild) continue;

      const channel = guild.channels.cache.get(watcher.channel) as TextChannel;
      if (!channel) continue;

      // array in JSON field
      const youtubeTargets: string[] = watcher.users;

      for (const input of youtubeTargets) {
        const channelId = await this.resolveChannelId(input);
        if (!channelId) continue;

        const latest = await this.getLatestVideo(channelId);
        if (!latest) continue;

        const redisKey = `yt:last:${channelId}`;

        const lastSeen = await redis.get(redisKey);

        // If not new video move to next one
        if (latest.id === lastSeen) continue;

        const guildSettings = await getGuildSettings(watcher.guildId);

        if (!guildSettings || !guildSettings.length) continue;

        const embed = new EmbedBuilder()
          .setTitle(latest.title ?? "Oops, something went wrong")
          .setDescription(latest.description?.slice(0, 4000) || "No description available.")
          .setColor(guildSettings.primaryColor ?? "Purple")
          .setTimestamp(latest.published);

        await channel.send({embeds: [embed]});

        // store new last ID
        await redis.set(redisKey, latest.id);
      }
    }
  }

  async resolveChannelId(input: string): Promise<string | null> {
    try {
      if (input.includes("channel/")) {
        return input.split("channel/")[1].split(/[/?]/)[0];
      }

      // @handle
      if (input.includes("@")) {
        const username = input.split("@")[1];
        const html = await axios.get(`https://www.youtube.com/@${username}`);
        const match = html.data.match(/"channelId":"(.*?)"/);
        return match ? match[1] : null;
      }

      return null;
    } catch {
      return null;
    }
  }

  async getLatestVideo(channelId: string) {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

    const res = await axios.get(url);
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });

    const feed = parser.parse(res.data);

    const video = feed.feed.entry?.[0];
    if (!video) return null;

    const videoId = video["yt:videoId"];

    const link = Array.isArray(video.link)
      ? video.link.find((l: any) => l["@_rel"] === "alternate")
      : video.link;

    return {
      id: videoId,
      title: video.title,
      url: link?.["@_href"],
      description: await this.getVideoDescription(videoId),
      published: new Date(video.published)
    };
  }

  async getVideoDescription(videoId: string): Promise<string | null> {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const html = await axios.get(url).then(res => res.data);

      // New YouTube player JSON (2024–2025)
      const match = html.match(/"shortDescription":"(.*?)"/);

      if (!match) return null;

      return match[1].replace(/\\n/g, "\n");
    } catch (err) {
      Logging.error(`Description fetch error: ${err}`);
      return null;
    }
  }
}
