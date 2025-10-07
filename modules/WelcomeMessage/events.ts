import {
  Client,
  TextChannel,
  Events as DiscordEvents,
} from "discord.js";
+import Database from "@utils/database.ts";

let instance: Events | null = null;

export default class Events {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
    if (instance) return instance;
    instance = this;
    this.client.on(DiscordEvents.GuildMemberAdd, async (member) => {
      void this.event(member);
    })
  }

  async event(member: any) {
    const res = await Database
      .select("welcome_message_settings")
      .where({ guild_id: member.guild.id, enabled: true })
      .first();

    if (!res) return;

    const channel = await this.client.channels.fetch(res.channel as string) as TextChannel;

    if (!channel) return;

    const updatedMessage: string = res.message.replace("{user}", `<@${member.user.id}>`);

    await channel.send({
      content: (updatedMessage)
    });
  }
}
