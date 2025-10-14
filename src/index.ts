import {
  Client,
  GatewayIntentBits,
  Partials,
  Events as DiscordEvents,
  TextChannel,
} from "discord.js";
import loadModules from "@utils/moduleLoader";
import { Logging } from "@utils/logging";
import { getEnv } from "@utils/env";
import { runMigrations } from "@utils/migrations";
import QueryBuilder from "@utils/database";
import { createWebServer } from "@utils/api";
import { clickhouseClient } from "@utils/clickhouse";


async function syncMessagesToClickhouse(client: Client) {
  const BATCH_SIZE = 500;

  async function saveMessages(messages: any[]) {
    if (messages.length === 0) return;

    try {
      await clickhouseClient.insert({
        table: "discord_messages",
        values: messages,
        format: "JSONEachRow",
      });
      Logging.info(`Inserted ${messages.length} messages into ClickHouse`);
    } catch (error) {
      Logging.error(`ClickHouse insert error: ${error}`);
    }
  }

  async function fetchAllMessages(channel: TextChannel) {
    Logging.info(`Fetching messages for #${channel.name}`);
    let lastId: string | undefined;
    const batch: any[] = [];

    while (true) {
      const messages = await channel.messages.fetch({ limit: 100, before: lastId });
      if (messages.size === 0) break;

      messages.forEach((msg) => {
        if (msg.author.bot) return;
        const formatted = msg.createdAt
          .toISOString()
          .replace("T", " ")
          .replace("Z", "")
          .split(".")[0];

        batch.push({
          guild_id: msg.guild?.id ?? "DM",
          channel_id: msg.channelId,
          user_id: msg.author.id,
          message_id: msg.id,
          us_command: msg.content.startsWith("!") ? 1 : 0,
          command_name: msg.content.startsWith("!")
            ? msg.content.split(" ")[0].substring(1)
            : "",
          created_at: formatted,
        });
      });

      if (batch.length >= BATCH_SIZE) {
        await saveMessages(batch.splice(0, BATCH_SIZE));
      }

      lastId = messages.last()?.id;
    }

    if (batch.length > 0) await saveMessages(batch);
    Logging.info(`Finished fetching messages for #${channel.name}`);
  }

  for (const [guildId, guild] of client.guilds.cache) {
    Logging.info(`Processing guild: ${guild.name}`);
    await guild.channels.fetch();

    const textChannels = guild.channels.cache.filter(
      (ch) => ch.isTextBased() && ch.type === 0 // GuildText
    );

    for (const [, channel] of textChannels) {
      try {
        await fetchAllMessages(channel as TextChannel);
        await new Promise((res) => setTimeout(res, 2000)); // rate limit buffer
      } catch (err) {
        Logging.error(`Error fetching ${channel.name}: ${err}`);
      }
    }
  }

  Logging.info("✅ Finished syncing all messages.");
}


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
  ],
});

client.on(DiscordEvents.ClientReady, async (client) => {
  client.setMaxListeners(20);

  process.on("unhandledRejection", (reason: any) => {
    console.error("[UNHANDLED REJECTION]", reason);
  });

  process.on("uncaughtException", (err) => {
    console.error("[UNCAUGHT EXCEPTION]", err);
  });

  // Load modules
  try {
    await loadModules(client);
  } catch (error) {
    Logging.error(`Error while loading modules: ${error}`);
  }

  // Optionally run migrations
  // try {
  //   await runMigrations();
  // } catch (error) {
  //   Logging.error(`Error while running migrations: ${error}`);
  // }

  // Keep MariaDB alive
  setInterval(async () => {
    Logging.debug("Keeping the database connection active...");
    await QueryBuilder.select("migrations").limit(1).execute();
  }, 10000);

  // Create API
  const webApp = await createWebServer(client, 3144);

  // Load API modules
  try {
    const apiModules = await loadModules(client);
    if (apiModules) {
      for (const registerApi of apiModules) {
        registerApi(webApp, client);
      }
    }
  } catch (error) {
    Logging.error(`Error while loading modules: ${error}`);
  }

  await QueryBuilder.isOnline()
    ? Logging.info("MariaDB online")
    : Logging.error("MariaDB offline");

  Logging.info(`Client ready! Signed in as ${client.user.tag}`);


  try {
    await syncMessagesToClickhouse(client);
  } catch (err) {
    Logging.error(`Message sync failed: ${err}`);
  }
});

void client.login(getEnv("DISCORD_TOKEN"));
