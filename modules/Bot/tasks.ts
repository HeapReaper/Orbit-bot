import {Client, TextChannel, Guild, GuildMember} from "discord.js";
import cron from "node-cron";
import Database from "@utils/database";
import {Logging} from "@utils/logging";
import { PrismaClient } from "@prisma/client";

let instance: Tasks | null = null;

export default class Tasks {
  private readonly client: Client;
  private prisma: PrismaClient;

  constructor(client: Client) {
    this.client = client;
    this.prisma = new PrismaClient()

    if (instance) return instance;
    instance = this;

    cron.schedule("* * * * *", async () => {
      await this.task();
    });
  }

  async task() {
    Logging.trace("Running change nickname task in bot/tasks");

    if (process.env.NODE_ENV !== "production") return;

    const data = await this.prisma.botSettings.findMany();

    for (const setting of data) {
      const guild = this.client.guilds.cache.get(setting.guildId as string);
      if (!guild) continue;
      if (!this.client?.user) continue;

      const botMember = await guild.members.fetch(this.client.user.id);

      const nickname = setting.nickname as string | null;
      // Skip if nickname is null, undefined, empty string, or "None"
      if (!nickname || nickname.toLowerCase() === "none") continue;

      await botMember.setNickname(nickname);
      Logging.info(`Nickname changed to: ${nickname}`);
    }
  }

}
