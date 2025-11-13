import {
  Client,
  GatewayIntentBits,
  Partials,
  Events as DiscordEvents,
  ActivityType
} from "discord.js";
import loadModules from "@utils/moduleLoader";
import { Logging } from "@utils/logging";
import { getEnv } from "@utils/env";
import { createWebServer } from "@utils/api";
import { clickhouseClient } from "@utils/clickhouse";
import { refreshSlashCommands } from "@utils/refreshSlashCommands";

async function main() {
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
    if (process.env.ENVIRONMENT !== "debug") {
      await refreshSlashCommands(true);
    }

    const activityTypes: {name: string, type: ActivityType}[] = [
      { name: "botinorbit.com", type: ActivityType.Playing},
      { name: "/help", type: ActivityType.Listening},
      { name: `In ${client.guilds.cache.size} servers!`, type: ActivityType.Competing},
    ];

    process.on("unhandledRejection", (reason: any) => {
      console.error("[UNHANDLED REJECTION]", reason);
    });

    process.on("uncaughtException", (err) => {
      console.error("[UNCAUGHT EXCEPTION]", err);
    });

    // Load all modules
    let apiModules = [];
    try {
      // @ts-ignore
      apiModules = await loadModules(client);
      Logging.info(`Loaded ${apiModules.length} API module(s)`);
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

    // Create Express web server
    const webApp = await createWebServer(client, 3144);

    // Register all module APIs
    for (const registerApi of apiModules) {
      try {
        registerApi(webApp, client);
        Logging.info("Registered API routes from a module");
      } catch (err) {
        Logging.error(`Failed to register module API: ${err}`);
      }
    }

    let index: number = 0;

    setInterval(() => {
      const nextActivityType: {name: string, type: ActivityType} = activityTypes[index];

      client.user.setActivity(nextActivityType.name, {type: nextActivityType.type});
      // Loop back to start after being on the end
      index = (index + 1) % activityTypes.length;
    }, 7000) // 7 seconds

    Logging.info(`Client ready! Logged in as ${client.user.tag}`);
  });

  await client.login(getEnv("DISCORD_TOKEN"));
}

void main();
