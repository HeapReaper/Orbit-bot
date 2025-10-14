import {
  Client,
  TextChannel,
  Events as DiscordEvents,
} from "discord.js";
import { addDays } from "date-fns";
import {PrismaClient} from "@prisma/client";

let instance: Events | null = null;

export default class Events {
  private readonly client: Client;
  private prisma;

  constructor(client: Client) {
    this.client = client;
    this.prisma = new PrismaClient();

    if (instance) return instance;
    instance = this;

    this.client.on(DiscordEvents.GuildCreate, async (guild) => {
      await this.newGuild(guild);
    });
  }

  async newGuild(guild: any) {
    if (!guild) return;

    await this.prisma.premium_guilds.create({
      data: {
        guild_id: guild.id,
        premium: true,
        trial_ends_at: addDays(new Date(), 7),
      },
    });

    // Send serverowner a message:
    // const owner = await guild.fetchOwner();
    // owner.send(`Thanks for adding me! Your server has 1 week free premium. Enjoy!`);
  }
}
