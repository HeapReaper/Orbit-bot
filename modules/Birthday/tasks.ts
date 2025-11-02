import { Client, TextChannel } from "discord.js";
import { Logging } from "@utils/logging";
import cron from "node-cron";
import { DateTime } from "luxon";
import { getCurrentTime } from "@utils/dateTime.ts";
import { prisma} from "@utils/prisma";
import { getRedisClient } from "@utils/redis";

let instance: Tasks | null = null;

export default class Tasks {
  private client: Client;
  private redis;

  constructor(client: Client) {
    this.client = client;
    this.redis = getRedisClient();

    if (instance) return;
    instance = this;

    void this.checkBirthdays();

    cron.schedule("* * * * *", async (): Promise<void> => {
      Logging.trace("Running Cron 'checkBirthdays'");
      await this.checkBirthdays();
    });
  }

  async checkBirthdays(): Promise<void> {
    let birthdays: any[];

    const cachedData = await this.redis.get("birthdays");

    if (cachedData) {
      birthdays = JSON.parse(cachedData);
    } else {
      birthdays = await prisma.birthday.findMany();

      await this.redis.set("birthdays", JSON.stringify(birthdays), "EX", 180);
    }

    if (birthdays.length <= 0) return;

    for (const birthday of birthdays) {
      const now: DateTime = DateTime.now().setZone("Europe/Amsterdam");

      const birthdaySettings = await prisma.birthdaySettings.findFirst({
        where: {
          guildId: birthday.guildId,
        }
      });

      if (!birthdaySettings) continue;

      const birthdayDate = DateTime.fromJSDate(
        new Date(birthday.birthdate),
      ).setZone("Europe/Amsterdam");

      if (birthdayDate.month !== now.month || birthdayDate.day !== now.day) {
        continue;
      }

      if (birthdaySettings.time !== getCurrentTime()) continue;

      const user = await this.client.users.fetch(`${birthday.user_id}`);
      const channelToSend = await this.client.channels.fetch(birthdaySettings.channel as string) as TextChannel;

      if (!channelToSend) {
        Logging.warn("I cannot find channel to send birthday notification to!");
        continue;
      }

      const age: number = now.year - birthdayDate.year;

      const msgToSend: string = birthdaySettings.message.replace("{age}", `${age}`).replace("{user}", `<@${user.id}>`);

      await channelToSend.send({ content: msgToSend });
    }
  }
}