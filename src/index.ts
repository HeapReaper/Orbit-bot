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
import QueryBuilder from "@utils/database";
import { createWebServer } from "@utils/api";

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
});

void client.login(getEnv("DISCORD_TOKEN"));
