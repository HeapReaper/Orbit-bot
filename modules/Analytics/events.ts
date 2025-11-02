import { clickhouseClient } from "@utils/clickhouse";
import {
  Message,
  Client,
  Events as DiscordEvents,
  GuildMember,
  VoiceState
} from "discord.js";
import {Logging} from "@utils/logging";
import cron from "node-cron";

let instance: Events | null = null;

export default class Events {
  private readonly client;
  private activeVCs: Map<string, { guildId: string; channelId: string; joinedAt: Date }> = new Map();

  constructor(client: Client) {
    this.client = client;

    if (instance) return instance;
    instance = this;

    void this.syncAllGuildMembers(this.client)

    this.client.on(DiscordEvents.MessageCreate, async (message: Message) => {
      await this.insertMsg(message);
    });

    this.client.on(DiscordEvents.GuildMemberAdd, async (member) => {
      await this.memberJoined(member);
    });

    this.client.on(DiscordEvents.GuildMemberRemove, async (member) => {
      await this.memberLeft(member);
    });

    this.client.on(DiscordEvents.VoiceStateUpdate, async (oldState, newState) => {
      await this.handleVoiceStateUpdate(oldState, newState);
    });

    cron.schedule("0 16 * * *", async () => {
      await this.syncAllGuildMembers(this.client);
    })
  }

  async insertMsg(message: Message) {
    if (message.author.bot) return;

    try {
      const formatted = new Date()
        .toISOString()
        .replace("T", " ")
        .replace("Z", "")
        .split(".")[0];

      await clickhouseClient.insert({
        table: "discord_messages",
        values: [
          {
            guild_id: message.guild?.id ?? "DM",
            channel_id: message.channelId,
            user_id: message.author.id,
            message_id: message.id,
            us_command: message.content.startsWith("!") ? 1 : 0,
            command_name: message.content.startsWith("!")
              ? message.content.split(" ")[0].substring(1)
              : "",
            created_at: formatted,
          },
        ],
        format: "JSONEachRow",
      });

      Logging.debug("Saved message to ClickHouse")
    } catch (error) {
      Logging.error(`Error saving message from ClickHouse: ${error}`);
    }
  }


  private async memberJoined(member: any) {
    try {
      const formatted = new Date()
        .toISOString()
        .replace("T", " ")
        .replace("Z", "")
        .split(".")[0];

      await clickhouseClient.insert({
        table: "discord_membership",
        values: [
          {
            guild_id: member.guild.id,
            user_id: member.id,
            joined_at: formatted,
            left_at: null,
          },
        ],
        format: "JSONEachRow",
      });

      Logging.debug(`Member joined: ${member.user.tag}`);
    } catch (error) {
      Logging.error(`Error by clickhouse member insert:: ${error}`);
    }
  }

  private async memberLeft(member: any) {
    try {
      const formatted = new Date()
        .toISOString()
        .replace("T", " ")
        .replace("Z", "")
        .split(".")[0];

      await clickhouseClient.command({
        query: `
          ALTER TABLE discord_membership
          UPDATE left_at = parseDateTimeBestEffort('${formatted}')
          WHERE guild_id = '${member.guild.id}' AND user_id = '${member.id}'
        `,
      });

      Logging.debug(`Member left: ${member.user.tag}`);
    } catch (error) {
      Logging.error(`Error by clickhouse member update: ${error}`);
    }
  }

  // TODO: Remove this when db entries are sufficient with all current members
  async syncAllGuildMembers(client: Client) {
    Logging.info("Starting full member sync...");

    for (const [guildId, guild] of client.guilds.cache) {
      await guild.members.fetch();

      const valuesToInsert: any[] = [];

      for (const [userId, member] of guild.members.cache) {
        const formatted = member.joinedAt
          ? member.joinedAt.toISOString().replace("T", " ").replace("Z", "").split(".")[0]
          : new Date().toISOString().replace("T", " ").replace("Z", "").split(".")[0];

        // Prepare values for batch insert
        valuesToInsert.push({
          guild_id: guildId,
          user_id: userId,
          joined_at: formatted,
          left_at: null,
        });
      }

      if (valuesToInsert.length > 0) {
        try {
          await clickhouseClient.insert({
            table: "discord_membership",
            values: valuesToInsert,
            format: "JSONEachRow",
          });
          Logging.info(`Synced ${valuesToInsert.length} members for guild ${guild.name} (${guildId})`);
        } catch (err) {
          Logging.error(`Failed to sync members for guild ${guild.name} (${guildId}): ${err}`);
        }
      }
    }

    Logging.info("Finished syncing all guild members.");
  }

  private async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const userId = newState.id;
    const guildId = newState.guild.id;
    const key = `${guildId}:${userId}`;

    // User joins a VC
    if (!oldState.channelId && newState.channelId) {
      this.activeVCs.set(key, {
        guildId,
        channelId: newState.channelId,
        joinedAt: new Date()
      });
      Logging.debug(`User ${userId} joined VC ${newState.channelId}`);
      return;
    }

    // User leaves or switches VC
    if (oldState.channelId && (!newState.channelId || newState.channelId !== oldState.channelId)) {
      const session = this.activeVCs.get(key);
      if (!session) return;

      const leftAt = new Date();
      const duration = Math.floor((leftAt.getTime() - session.joinedAt.getTime()) / 1000);

      try {
        await clickhouseClient.insert({
          table: "discord_voice_activity",
          values: [
            {
              guild_id: session.guildId,
              channel_id: session.channelId,
              user_id: userId,
              joined_at: session.joinedAt.toISOString().replace("T", " ").replace("Z", "").split(".")[0],
              left_at: leftAt.toISOString().replace("T", " ").replace("Z", "").split(".")[0],
              duration
            }
          ],
          format: "JSONEachRow"
        });

        Logging.debug(`Saved VC session for ${userId} (${duration}s)`);
      } catch (error) {
        Logging.error(`Error saving VC session: ${error}`);
      }

      this.activeVCs.delete(key);

      if (newState.channelId) {
        this.activeVCs.set(key, {
          guildId,
          channelId: newState.channelId,
          joinedAt: new Date()
        });
      }
    }
  }
}