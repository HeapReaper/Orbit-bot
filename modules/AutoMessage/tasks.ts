import { Client, TextChannel } from "discord.js";
import cron from "node-cron";
import Database from "@utils/database";
import { Logging } from "@utils/logging";

let instance: Tasks | null = null;

export default class Tasks {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
    if (instance) return instance;
    instance = this;

    cron.schedule("* * * * *", async () => {
      await this.task();
    });
  }

  async task() {
    Logging.info("Running auto message task");

    const messages = await Database
      .select("auto_message")
      .where({ enabled: true})
      .get();

    const now = new Date();

    const formatter = new Intl.DateTimeFormat("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/Amsterdam"
    });
    const currentTime = formatter.format(now);

    for (const message of messages) {
      if (message.time !== currentTime) continue;

      const channel = await this.client.channels.fetch(message.channel as string) as TextChannel;
      if (!channel) continue;

      try {
        await channel.send(message.message);
        Logging.info(`Sent auto message to ${channel.id}`);
      } catch (err) {
        Logging.error(`Failed to send message to ${channel.id}: ${err}`);
      }
    }
  }
}
