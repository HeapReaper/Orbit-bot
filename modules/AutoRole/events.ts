import {
  Client,
  Events as DiscordEvents,
} from "discord.js";
import { prisma } from "@utils/prisma";
import { Logging } from "@utils/logging";

let instance: Events | null = null;

export default class Events {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;

    if (instance) return instance;
    instance = this;

    this.client.on(DiscordEvents.GuildMemberAdd, async (member) => {
      await this.addRole(member);
    })
  }

  async addRole(member: any) {
    // TODO: Add Redis caching
    const res = await prisma.autoRoleSettings.findUnique({
      where: {
        guildId: member.guild.id,
      }
    });

    if (!res || res.enabled !== true) return;

    if (!res?.autoRoles || !Array.isArray(res.autoRoles)) return;

    const autoRoles: string[] = Array.isArray(res.autoRoles)
      ? res.autoRoles
      : JSON.parse(res.autoRoles as string);

    for (const role of autoRoles) {
      try {
        await member.roles.add(role);
        Logging.trace(`Automatically added role`)
      } catch (error) {
        Logging.error(`Error adding role in AutoRole ${role}: ${error}`);
      }
    }
  }
}
