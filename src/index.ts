import {
  Client,
  GatewayIntentBits,
  Partials,
  Events as DiscordEvents,
  TextChannel,
  ActivityType,
} from "discord.js";
import loadModules from "@utils/moduleLoader";
import { Logging } from "@utils/logging";
import { getEnv } from "@utils/env";
import { runMigrations } from "@utils/migrations";
import QueryBuilder from "@utils/database";
import { createWebServer } from "@utils/api";
import i18next from "i18next";
import Backend from "i18next-fs-backend";
import path from "path";

void i18next.use(Backend).init({
  lng: "en", // Default
  fallbackLng: "en",
  backend: {
    loadPath: path.join(__dirname, '../locales/{{lng}}/translation.json'),
  }
});

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

  // Load modules
  try {
    await loadModules(client);
  } catch (error) {
    Logging.error(`Error while loading modules: ${error}`);
  }

  // Run migrations
  // try {
  //   await runMigrations();
  // } catch (error) {
  //   Logging.error(`Error while running migrations: ${error}`);
  // }

  // Keeping DB active
  setInterval(async () => {
    Logging.debug("Keeping the database connection active...");
    await QueryBuilder.select("migrations").limit(1).execute();
  }, 10000);

  const webApp = await createWebServer(client, 3144);

  // Load modules + API
  try {
    const apiModules = await loadModules(client);

    if (!apiModules) return;

    for (const registerApi of apiModules) {
      registerApi(webApp, client);
    }
  } catch (error) {
    Logging.error(`Error while loading modules: ${error}`);
  }

  Logging.info(`Client ready! Signed in as ${client.user.tag}!`);
});

void client.login(getEnv("DISCORD_TOKEN"));