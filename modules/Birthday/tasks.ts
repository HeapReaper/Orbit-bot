import { Client, TextChannel } from "discord.js";
import { Logging } from "@utils/logging";
import QueryBuilder from "@utils/database";
import cron from "node-cron";
import { DateTime } from "luxon";
import {getCurrentTime} from "@utils/dateTime.ts";
import { PrismaClient } from "@prisma/client";
import {getRedisClient} from "@utils/redis";

let instance: Tasks | null = null;

export default class Tasks {
  private client: Client;
  private prisma: PrismaClient;
  private redis;

  constructor(client: Client) {
    this.client = client;
    this.prisma = new PrismaClient();
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
      birthdays = await QueryBuilder
        .select("birthdays")
        .get();
      await this.redis.set("birthdays", JSON.stringify(birthdays), "EX", 180);
    }

    if (birthdays.length <= 0) return;

    for (const birthday of birthdays) {
      const now: DateTime = DateTime.now().setZone("Europe/Amsterdam");

      const birthdaySettings = await QueryBuilder
        .select("birthday_settings")
        .where({ guild_id: birthday.guild_id })
        .first()

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