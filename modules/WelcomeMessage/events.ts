import {
  Client,
  TextChannel,
  Events as DiscordEvents,
} from "discord.js";
import Database from "@utils/database";
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
    const res = await Database
      .select("welcome_message_settings")
      .where({ guild_id: member.guild.id, enabled: true })
      .first();

    if (!res || !res.messages?.length) return;

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

    let messageToSend: string;
    if (res.randomize) {
      const randomIndex = Math.floor(Math.random() * res.messages.length);
      messageToSend = res.messages[randomIndex];
    } else {
      // standaard het eerste bericht
      messageToSend = res.messages[0];
    }

    const updatedMessage = messageToSend.replace(/{user}/g, `<@${member.user.id}>`);

    await channel.send({ content: updatedMessage });
  }
}
