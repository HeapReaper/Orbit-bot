import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import fs from "fs/promises";
import path from "path";
import { Logging } from "@utils/logging";
import { getEnv } from "@utils/env";

export async function refreshSlashCommands(global = false): Promise<void> {
  const modulesPath: string = path.join(getEnv("MODULES_BASE_PATH") as string, "modules");
  const modulesFolder: string[] = await fs.readdir(modulesPath);
  const rest = new REST({ version: "10" }).setToken(getEnv("DISCORD_TOKEN")!);

  // Load all commands from modules
  const allCommands: any[] = [];
  for (const module of modulesFolder) {
    Logging.debug(`Trying to load commands for module: ${module}`);
    const modulePath: string = path.join(modulesPath, module, "commands.ts");

    try {
      const commandsFromModule: any = await import(path.resolve(modulePath));
      if (!commandsFromModule.commands) continue;
      allCommands.push(...commandsFromModule.commands);
      Logging.info(`Successfully prepared commands for module: ${module}`);
    } catch (error) {
      Logging.warn(`Failed to load commands for module: ${module} - ${error}`);
    }
  }

  if (global) {
    // Sync globally
    try {
      await rest.put(
        Routes.applicationCommands(getEnv("CLIENT_ID")!),
        { body: allCommands }
      );
      Logging.info(`Successfully synced global commands`);
    } catch (error) {
      Logging.error(`Failed to sync global commands: ${error}`);
    }
  } else {
    // Refresh for all guilds the bot is in
    try {
      const guilds = await rest.get(Routes.userGuilds()) as { id: string }[];
      for (const guild of guilds) {
        try {
          await rest.put(
            Routes.applicationGuildCommands(getEnv("CLIENT_ID")!, guild.id),
            { body: allCommands }
          );
          Logging.info(`Successfully synced commands for guild: ${guild.id}`);
        } catch (error) {
          Logging.error(`Failed to sync commands for guild ${guild.id}: ${error}`);
        }
      }
    } catch (error) {
      Logging.error(`Failed to fetch guilds: ${error}`);
    }
  }
}