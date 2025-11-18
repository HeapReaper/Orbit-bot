import {Client, EmbedBuilder, Guild, GuildMember, TextChannel} from "discord.js";
import { prisma } from "@utils/prisma";
import cron from "node-cron";
import { Logging } from "@utils/logging";
import { getRedisClient } from "@utils/redis";
import getGuildSettings from "@utils/getGuildSettings";
import { t } from "@utils/i18n";

let instance: Tasks | null = null;
const redis = getRedisClient();

export default class Tasks {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;

    if (instance) return instance;
    instance = this;

    cron.schedule("* * * * *", async () => {
      Logging.info("Checking premium guild trials");
      await this.task();
    });
  }

  async task(): Promise<void> {
    const guilds = await prisma.premiumGuild.findMany({
      where: {
        trialEndsAt: { not: null },
        premium: true,
      },
    });

    const now = new Date();

    for (const guild of guilds) {
      if (!guild.trialEndsAt) continue;

      const trialEndsAt = new Date(guild.trialEndsAt);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 1 week before trail ends
      const weekBefore = new Date(trialEndsAt);
      const weekBeforeDay = new Date(weekBefore);
      weekBeforeDay.setHours(0, 0, 0, 0);

      const reminderKey = `premium_trial_reminder:${guild.guildId}`;

      if (today.getTime() === weekBeforeDay.getTime()) {
        Logging.info(`Sending 1-week trial reminder for guild ${guild.guildId}`);

        const guildSettings = await getGuildSettings(guild.guildId);
        const guildLang: string | null = guildSettings.language;
        const guildFetched = await this.client.guilds.fetch(guildSettings.guildId) as Guild;
        const channel = guildSettings.updatesChannel
          ? (await this.client.channels.fetch(guildSettings.updatesChannel)) as TextChannel
          : null;

        const embed = new EmbedBuilder()
          .setTitle(t(guildLang ?? "en", "trail_will_end_soon"))
          .setColor(guildSettings?.primaryColor || "#2F3136")
          .setDescription(t(guildLang?? "en", "trail_end_description"))
          .addFields(
            { name: "Server", value: guildFetched.name},
            { name: t(guildLang ?? "en", "contact"), value: "https://discord.gg/HyGNHZCeTQ"},
            { name: t(guildLang ?? "en", "email"), value: "contact@klikbit.nl"}
          );

        // If no update channel found, DM guild owner
        if (!channel) {
          const owner: GuildMember = await guildFetched.fetchOwner();

          try {
            await owner.send({ embeds: [embed] });
          } catch (err) {
            Logging.error(`Failed to DM owner of guild ${guild.guildId}: ${err}`);
          }

          continue;
        }

        try {
          await channel.send({ embeds: [embed] });
        } catch (err) {
          Logging.error(`Failed to send trail end notification channel: ${err}`);
        }
      }

      // Trail expired
      if (trialEndsAt < now) {
        Logging.info(`Trial expired — disabling premium for guild ${guild.guildId}`);

        await prisma.premiumGuild.update({
          where: { guildId: guild.guildId },
          data: { premium: false, trialEndsAt: null },
        });

        await prisma.botSettings.update({
          where: { guildId: guild.guildId },
          data: { nickname: "Orbit" },
        });

        // Clear reminder key just in case
        await redis.del(reminderKey);
      }
    }
  }
}