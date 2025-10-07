import { Client, TextChannel, EmbedBuilder } from "discord.js";
import { Logging } from "@utils/logging";
import QueryBuilder from "@utils/database";
import { getEnv } from "@utils/env.ts";
import cron from "node-cron";
import { DateTime } from "luxon";
import {getCurrentTime} from "@utils/dateTime.ts";

let instance: Tasks | null = null;

export default class Tasks {
  private client: Client;

  constructor(client: Client) {
    this.client = client;

    if (instance) return;
    instance = this;

    void this.checkBirthdays();

    cron.schedule("* * * * *", async (): Promise<void> => {
      Logging.debug("Running Cron 'checkBirthdays'");
      await this.checkBirthdays();
    });
  }

  async checkBirthdays(): Promise<void> {
    const now: DateTime = DateTime.now().setZone("Europe/Amsterdam");
    const currentDate = DateTime.now()
      .setZone("Europe/Amsterdam")
      .toFormat("yyyy-MM-dd");

    const birthdays: any[] = await QueryBuilder
      .select("birthdays")
      .where({ birthdate: currentDate })
      .get();

    if (birthdays.length <= 0) return;

    for (const birthday of birthdays) {
      const birthdaySettings = await QueryBuilder
        .select("birthday_settings")
        .where({ guild_id: birthday.guild_id })
        .first()

      console.log("TIME DB: ", birthdaySettings.time);
      console.log("CURRENT TIME: ", getCurrentTime())
      if (birthdaySettings.time !== getCurrentTime()) continue;

      const user = await this.client.users.fetch(`${birthday.user_id}`);
      const channelToSend = await this.client.channels.fetch(birthdaySettings.channel as string) as TextChannel;

      if (!channelToSend) {
        Logging.warn("I cannot find channel to send birthday notification to!");
        continue;
      }

      const now = DateTime.now().setZone("Europe/Amsterdam");
      const birthdayDate = DateTime.fromJSDate(new Date(birthday.birthdate)).setZone("Europe/Amsterdam");
      const age: number = now.year - birthdayDate.year;

      const msgToSend: string = birthdaySettings.message.replace("{age}", `${age}`).replace("{user}", `<@${user.id}>`);

      await channelToSend.send({ content: msgToSend });
    }
  }
}