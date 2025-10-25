import { SlashCommandBuilder } from "discord.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("minecraft")
    .setDescription("The Minecraft commands")
    .addSubcommand(add =>
      add
        .setName("list")
        .setDescription("See who's online")
    )
].map(commands => commands.toJSON());