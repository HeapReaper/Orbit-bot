import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import fs from "fs/promises";
import path from "path";
import { Logging } from "@utils/logging";
import { getEnv } from "@utils/env.ts";
import {PrismaClient} from "@prisma/client";

const prisma = new PrismaClient();

export async function refreshSlashCommands(): Promise<void> {
  const modulesPath: string = path.join(process.cwd(), "modules");
  const modulesFolder: string[] = await fs.readdir(modulesPath);
  const rest = new REST({ version: "10" }).setToken(getEnv("DISCORD_TOKEN")!);

  // Fetch all bot settings (one per guild)
  const botSettings: any[] = await prisma.bot_settings.findMany();

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

  // Loop through each guild from bot settings
  for (const setting of botSettings) {
    const guildId = setting.guild_id;

    if (!guildId) continue;

    try {
      await rest.put(Routes.applicationGuildCommands(getEnv("CLIENT_ID")! as string, guildId as string), {
          body: [],
      });

      await rest.put(Routes.applicationGuildCommands(getEnv("CLIENT_ID")! as string, guildId as string), {
          body: allCommands,
      });

      Logging.info(`Successfully synced commands for guild: ${guildId}`);
    } catch (error) {
      Logging.error(`Failed to sync commands for guild ${guildId}: ${error}`);
    }
  }
}
