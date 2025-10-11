import {
  Client,
  Events as DiscordEvents,
} from "discord.js";
import {clickhouse} from "@utils/clickhouse";

let instance: Events | null = null;

export default class Events {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
    if (instance) return instance;
    instance = this;

    this.client.on(DiscordEvents.MessageCreate, async (message) => {
      await this.addMessage(message);
    });
  }

  async addMessage(message: any): Promise<void> {
    const isCommand = message.content.startsWith('!');
    const commandName = isCommand ? message.content.split(' ')[0].substring(1) : '';

    try {
      const res = await clickhouse.insert({
        table: 'discord_messages',
        values: [{
          guild_id: message.guild?.id ?? '',
          channel_id: message.channel?.id ?? '',
          user_id: message.author?.id ?? '',
          message_id: message.id,
          is_command: isCommand ? 1 : 0,
          command_name: commandName,
          created_at: new Date(),
        }],
        format: 'JSONEachRow',
      });

      console.log("Insert response:", res);
    } catch (err) {
      console.error("ClickHouse insert failed:", err);
    }

    console.log(res);
  }
}
