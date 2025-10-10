import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import fs from "fs/promises";
import path from "path";
import { Logging } from "@utils/logging";
import { getEnv } from "@utils/env.ts";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function refreshSlashCommands(guildId?: string): Promise<void> {
  const modulesPath: string = path.join(process.cwd(), "modules");
  const modulesFolder: string[] = await fs.readdir(modulesPath);
  const rest = new REST({ version: "10" }).setToken(getEnv("DISCORD_TOKEN")!);

  // Load all commands from module folders
  const allCommands: any[] = [];

  for (const module of modulesFolder) {
    Logging.debug(`Trying to load commands for module: ${module}`);
    const modulePath: string = path.join(modulesPath, module, "commands.ts");

    try {
      const commandsFromModule: any = await import(path.resolve(modulePath));

      if (!commandsFromModule.commands) {
        Logging.warn(`No commands exported from ${modulePath}`);
        continue;
      }

      Logging.debug(`Commands: ${JSON.stringify(commandsFromModule.commands)}`);
      allCommands.push(...commandsFromModule.commands);

      Logging.info(`Successfully prepared commands for module: ${module}`);
    } catch (error) {
      Logging.warn(`Failed to load commands for module: ${module} - ${error}`);
    }
  }

  // Determine which guilds to refresh
  let guildsToRefresh: string[] = [];

  if (guildId) {
    guildsToRefresh = [guildId];
  } else {
    const botSettings = await prisma.bot_settings.findMany({
      select: { guild_id: true },
    });
    guildsToRefresh = botSettings.map((s) => s.guild_id).filter(Boolean);
  }

  // Sync commands for each guild
  for (const guild of guildsToRefresh) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(getEnv("CLIENT_ID")!, guild),
        { body: [] }
      );

      await rest.put(
        Routes.applicationGuildCommands(getEnv("CLIENT_ID")!, guild),
        { body: allCommands }
      );

      Logging.info(`✅ Successfully synced commands for guild: ${guild}`);
    } catch (error) {
      Logging.error(`❌ Failed to sync commands for guild ${guild}: ${error}`);
    }
  }
}
