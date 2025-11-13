import { SlashCommandBuilder } from "discord.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("minecraft")
    .setDescription("See who's online!")
].map(commands => commands.toJSON());
