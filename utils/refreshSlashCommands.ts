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
      // Ensure fresh import to avoid cached commands
      const commandsFromModule: any = await import(`${path.resolve(modulePath)}?update=${Date.now()}`);
      if (!commandsFromModule.commands) continue;
      allCommands.push(...commandsFromModule.commands);
      Logging.info(`Successfully prepared commands for module: ${module}`);
    } catch (error) {
      Logging.warn(`Failed to load commands for module: ${module} - ${error}`);
    }
  }

  try {
    // First, clear all global commands
    await rest.put(Routes.applicationCommands(getEnv("CLIENT_ID")!), { body: [] });
    Logging.info("Cleared all global commands");

    // Then, clear all guild commands
    const guilds = await rest.get(Routes.userGuilds()) as { id: string }[];
    for (const guild of guilds) {
      await rest.put(Routes.applicationGuildCommands(getEnv("CLIENT_ID")!, guild.id), { body: [] });
      Logging.info(`Cleared all commands for guild: ${guild.id}`);
    }

    // Now, set the new commands globally
    if (global) {
      // Sync globally
      await rest.put(Routes.applicationCommands(getEnv("CLIENT_ID")!), { body: allCommands });
      Logging.info("Successfully synced global commands");
    } else {
      // Sync to each guild
      const guilds = await rest.get(Routes.userGuilds()) as { id: string }[];
      await Promise.all(guilds.map(async (guild) => {
        await rest.put(
          Routes.applicationGuildCommands(getEnv("CLIENT_ID")!, guild.id),
          { body: allCommands }
        );
        Logging.info(`Successfully synced new commands for guild: ${guild.id}`);
      }));
    }

  } catch (error) {
    Logging.error(`Failed during command refresh: ${error}`);
  }
}
