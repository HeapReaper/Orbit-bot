import {Client, TextChannel, Guild, GuildMember} from "discord.js";
import cron from "node-cron";
import Database from "@utils/database";
import {Logging} from "@utils/logging";

let instance: Tasks | null = null;

export default class Tasks {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
    if (instance) return instance;
    instance = this;

    cron.schedule("* * * * *", async () => {
      await this.task();
    })
  }

  async task() {
    Logging.info("Running change nickname task in bot/tasks")

    const settings = await Database
      .select("bot_settings")
      .get();

    for (const setting of settings) {
      const guild = this.client.guilds.cache.get(setting.guild_id as string) as Guild;

      if (!guild) continue;

      if (!this.client) continue

      if (!this.client.user) continue;

      const botMember = await guild.members.fetch(this.client.user.id) as GuildMember

      await botMember.setNickname(setting.nickname as string)
    }
  }
}
