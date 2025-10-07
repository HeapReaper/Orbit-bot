import { SlashCommandBuilder } from "discord.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("birthday")
    .setDescription("Add your birthday to the server!")
    .addSubcommand(add =>
      add
        .setName("add")
        .setDescription("Add a new birthday to the server!")
        .addIntegerOption(option =>
          option
            .setName("day")
            .setDescription("Like 11")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(31)
        )
        .addIntegerOption(option =>
          option
            .setName("month")
            .setDescription("Like 05")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(12)
        )
        .addIntegerOption(option =>
          option
            .setName("year")
            .setDescription("Like 2001")
            .setRequired(true)
        )
    )
    .addSubcommand(remove =>
      remove
        .setName("delete")
        .setDescription("Delete your birthday!")
    )
    .addSubcommand(list =>
      list
        .setName("list")
        .setDescription("birthday list (admin only)")
    )
].map(commands => commands.toJSON());