import { Client, TextChannel } from "discord.js";
import { prisma } from "@utils/prisma";
import cron from "node-cron";
import { Logging } from "@utils/logging";

let instance: Tasks | null = null;

export default class Tasks {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;

    if (instance) return instance;
    instance = this;

    cron.schedule("* * * * *", async () => {
      Logging.info("Checking if premium guilds trails has ended");
      await this.task();
    })
  }

  async task(): Promise<void> {
    const guilds = await prisma.premiumGuild.findMany({
      where: {
        trialEndsAt: {
          not: null,
        },
        premium: true,
      }
    });

    const now = new Date();

    for (const guild of guilds) {
      if (guild.trialEndsAt && guild.trialEndsAt < now) {
        Logging.info(`Disabled premium because trail ended for guild ID ${guild.guildId}`);
        await prisma.premiumGuild.update({
          where: {
            guildId: guild.guildId,
          },
          data: {
            premium: false,
            trialEndsAt: null
          },
        })

        await prisma.botSettings.update({
          where: {
            guildId: guild.guildId,
          },
          data: {
            nickname: "Orbit",
          }
        })
      }
    }
  }
}
