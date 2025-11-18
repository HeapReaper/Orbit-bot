import { SlashCommandBuilder } from "discord.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("status")
    .setDescription("See the status of this bot and the dashboard")
].map(commands => commands.toJSON());
