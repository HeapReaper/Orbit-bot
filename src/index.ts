import {
  Client,
  GatewayIntentBits,
  Partials,
  Events as DiscordEvents,
} from "discord.js";
import loadModules from "@utils/moduleLoader";
import { Logging } from "@utils/logging";
import { getEnv } from "@utils/env";
import { createWebServer } from "@utils/api";
import { clickhouseClient } from "@utils/clickhouse";

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
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
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

  // Keep ClickHouse alive
  setInterval(async () => {
    try {
      await clickhouseClient.query({ query: "SELECT 1" });
      Logging.debug("ClickHouse connection alive...");
    } catch (err) {
      Logging.error(`ClickHouse connection error: ${err}`);
    }
  }, 10000);

  // Create API
  const webApp = await createWebServer(client, 3144);

  Logging.info(`Client ready! Signed in als ${client.user.tag}`);
});

void client.login(getEnv("DISCORD_TOKEN"));
