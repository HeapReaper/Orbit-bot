import { Client, TextChannel } from "discord.js";
import cron from "node-cron";
import { Logging } from "@utils/logging";
import {prisma} from "@utils/prisma";
import { JsonArray } from "@prisma/client/runtime/library";

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
    Logging.trace("Running auto message task");

    const messages = await prisma.auto_message.findMany({
      where: {
        enabled: true,
      }
    });

    const now = new Date();

    const formatter = new Intl.DateTimeFormat("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/Amsterdam",
    });
    const currentTime = formatter.format(now);

    const currentDayShort = now
      .toLocaleString("en-US", { weekday: "short" })
      .replace(".", "");

    for (const message of messages) {
      if (message.time !== currentTime) continue;

      let days: JsonArray = [];
      try {
        if (typeof message.days === "string") {
          days = JSON.parse(message.days);
        } else if (Array.isArray(message.days)) {
          days = message.days;
        }
      } catch (err) {
        Logging.error(`Invalid days JSON for message ID ${message.id}: ${err}`);
        continue;
      }

      if (days.length > 0 && !days.includes(currentDayShort)) {
        Logging.info(`Skipping message ${message.id}: not scheduled for ${currentDayShort}`);
        continue;
      }

      const channel = (await this.client.channels
        .fetch(message.channel as string)
        .catch(() => null)) as TextChannel | null;
      if (!channel) continue;

      const content = message.message.replace(/<u>(.*?)<\/u>/gi, "__$1__");

      try {
        await channel.send(content);
        Logging.info(`Sent auto message to ${channel.id} (${currentDayShort} ${currentTime})` );
      } catch (err) {
        Logging.error(`Failed to send message to ${channel.id}: ${err}`);
      }
    }
  }
}