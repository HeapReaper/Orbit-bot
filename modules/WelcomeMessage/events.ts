import {
  Client,
  TextChannel,
  Events as DiscordEvents,
} from "discord.js";
import {prisma} from "@utils/prisma.ts";
import {GuildLogger} from "@utils/guildLog";

let instance: Events | null = null;

export default class Events {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;

    if (instance) return instance;
    instance = this;

    this.client.on(DiscordEvents.GuildMemberAdd, async (member) => {
      void this.event(member);
    });
  }

  async event(member: any) {
    const res = await prisma.welcome_message_settings.findFirst({
      where: {
        guild_id: member.guild.id,
        enabled: 1
      }
    });

    if (!res || !res.messages) return;

    let channel: TextChannel | null = null;
    try {
      const fetchedChannel = await this.client.channels.fetch(res.channel as string);
      if (fetchedChannel?.isTextBased()) {
        channel = fetchedChannel as TextChannel;
      }
    } catch (err) {
      GuildLogger.error(res.guild_id, "Welcome message channel could not be fetched. Please configure it again.");
      return;
    }

    if (!channel) {
      GuildLogger.error(res.guild_id, "Welcome message channel could not be found. Please configure it again.");
      return;
    }

    let messages: string[] = [];
    try {
      messages = Array.isArray(res.messages)
        ? res.messages
        // @ts-ignore
        : JSON.parse(res.messages);
    } catch (err) {
      GuildLogger.error(res.guild_id, "Could not parse welcome messages array.");
      return;
    }

    if (!messages.length) return;

    let messageToSend: string;
    if (res.randomize) {
      const randomIndex = Math.floor(Math.random() * messages.length);
      messageToSend = messages[randomIndex];
    } else {
      messageToSend = messages[0];
    }

    const updatedMessage = messageToSend.replace(/{user}/g, `<@${member.user.id}>`);

    await channel.send({ content: updatedMessage });
  }
}
