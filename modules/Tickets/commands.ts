import { SlashCommandBuilder } from 'discord.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Create tickets')
    .addSubcommand(report =>
      report
        .setName('admins')
        .setDescription('Open a ticket for the administration')
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('The reason for the ticket')
            .setRequired(true)
        )
    )
    .addSubcommand(confidential =>
      confidential
        .setName('confidential')
        .setDescription('Open a ticket that only the owner can see')
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('The reason for the ticket')
            .setRequired(true)
        )
    )
    .addSubcommand(close =>
      close
        .setName('close')
        .setDescription('Close a ticket')
    )
].map(commands => commands.toJSON());