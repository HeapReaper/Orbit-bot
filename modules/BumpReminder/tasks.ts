import {
  Client,
  TextChannel
} from "discord.js";
import {Logging} from "@utils/logging";
import {prisma} from "@utils/prisma";
import {getRedisClient} from "@utils/redis.ts";
import {GuildLogger} from "@utils/guildLog";

const redis = getRedisClient();
let instance: BumpReminderTasks | null = null;

export default class BumpReminderTasks {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;

    if (instance) return instance;
    instance = this;

    void this.bumpReminderTask();
    setInterval(async () => {
      await this.bumpReminderTask();
    }, 20000);
  }

  async bumpReminderTask(): Promise<void> {
    try {
      Logging.trace("Checking if servers can be bumped again!");

      let guilds: any[];
      const cachedData = await redis.get("bumpReminderSettings");

      if (cachedData) {
        guilds = JSON.parse(cachedData);
      } else {
        guilds = await prisma.bumpReminderSettings.findMany({
          where: {
            enabled: 1,
          }
        });
        await redis.set("bumpReminderSettings", JSON.stringify(guilds), "EX", 180);
      }

      for (const guild of guilds) {
        try {
          if (!guild.channel) continue;

          const channel = await this.client.channels.fetch(guild.channel as string) as TextChannel;
          const messages = channel.messages.fetch({limit: 20});

          messages.then(async messages => {
            if (messages.size === 0) return;

            const lastMessage = messages.first();
            if (!lastMessage) return;

            if (lastMessage?.author.id === this.client.user?.id) return;

            // @ts-ignore
            if (lastMessage.createdTimestamp < Date.now() - (2 * 60 * 60 * 1000)) {
              await channel.send({
                content: guild.message
              });
            }
          });
        } catch (error) {
          GuildLogger.error(guild.id, `Error in bump reminder tasks: ${error}`);
          Logging.warn(`Error in bump reminder tasks: ${error}`);
        }
      }
    } catch(error) {
      Logging.warn(`Error in bump reminder tasks: ${error}`);
    }
  }
}