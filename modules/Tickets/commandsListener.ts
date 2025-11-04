import {
  Client,
  Interaction,
  Events,
  MessageFlags,
  TextChannel,
  ChannelType,
  PermissionFlagsBits,
} from "discord.js";
import {Logging} from "@utils/logging";
import { prisma } from "@utils/prisma";
import {GuildLogger} from "@utils/guildLog";

let instance: CommandsListener | null = null;

export default class CommandsListener {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;

    if (instance) return instance;
    instance = this;

    void this.commandsListener();
  }

  async commandsListener(): Promise<void> {
    this.client.on(Events.InteractionCreate, async (interaction: Interaction): Promise<void> => {
      if (!interaction.isCommand()) return;

      if (!interaction.guild) return;

      // TODO: Add caching
      const data= await prisma.ticketSettings.findFirst({
        where: { guildId: interaction.guild.id }
      });

      if (!data) {
        await interaction.reply({
          content: "Tickets module hasn't been configured/disabled yet.",
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (data.enabled !== 1) {
        await interaction.reply({
          content: "Tickets module isn't enabled.",
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const { commandName } = interaction;
      // @ts-ignore
      const subCommandName: string | null = interaction.options.getSubcommand(false); // `false` = required = false

      if (commandName !== 'ticket') return;

      const ticketChannel = await this.client.channels.fetch(data.channel as string) as TextChannel;

      if (!ticketChannel) {
        await interaction.reply({
          content: "Oops, something went wrong!",
          flags: MessageFlags.Ephemeral,
        });
        Logging.error(`Could not find ticketChannel`)
        return;
      }
      const tickedConfidentialChannel = await this.client.channels.fetch(data.channelConf as string) as TextChannel;

      if (!tickedConfidentialChannel) {
        await interaction.reply({
          content: "Oops, something went wrong!",
          flags: MessageFlags.Ephemeral,
        });
        Logging.error(`Could not find ticketChannel`)
        return;
      }

      switch (subCommandName) {
        case 'admins':
          await this.createTicket(interaction, ticketChannel);
          break;
        case 'confidential':
          await this.createTicket(interaction, tickedConfidentialChannel);
          break;
        case 'close':
          await this.closeTicket(interaction, data);
          break;
      }
    });
  }

  async createTicket(interaction: Interaction, ticketChannel: TextChannel): Promise<void> {
    if (!interaction.isCommand()) return;

    // @ts-ignore
    GuildLogger.info(interaction.guild.id, `User ${interaction.user.displayName} ran the command /ticket admins`)

    if (!ticketChannel) {
      await interaction.reply({
        content: "A ticket channel has not been configured/disabled yet.",
        flags: MessageFlags.Ephemeral
      })
    }

    try {
      // @ts-ignore
      const reason: string = interaction.options.getString('reason');

      const thread = await ticketChannel.threads.create({
        name: `${interaction.user.displayName} | ${reason}`,
        autoArchiveDuration: 60,
        reason: `${interaction.user.displayName} | ${reason}`,
        type: ChannelType.PrivateThread,
      })

      await thread.members.add(interaction.user.id);

      await thread.send(`<@${interaction.user.id}> | ${reason}`);

      await interaction.reply({
        content: `Ticket aangemaakt: ${thread.url}`,
        flags: MessageFlags.Ephemeral
      })
    } catch (error) {
      // @ts-ignore
      GuildLogger.error(interaction.guild.id, `Could not make ticket: ${error}`);
      Logging.error(`Error in "ticketManagement": ${error}`);
    }
  }

  async closeTicket(interaction: Interaction, data: any): Promise<void> {
    if (!interaction.isCommand()) return;

    // @ts-ignore
    GuildLogger.info(interaction.guild.id, `User ${interaction.user.displayName} ran the command /ticket close`)

    if (!interaction.channel?.isThread()) {
      await interaction.reply({
        content: "This command can only be executed in threads!",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const thread = interaction.channel;
    const isThreadOwner = thread.ownerId === interaction.user.id;
    const hasManageThreads = interaction.memberPermissions?.has(PermissionFlagsBits.ManageThreads);

    if (!isThreadOwner && !hasManageThreads) {
      Logging.info('Someone tried a ticket close command without being ticket owner and without permissions');

      await interaction.reply({
        content: "You must be the ticket owner or have `Manage Threads` permission to close this ticket",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (interaction.channel.parentId !== data.channel && interaction.channel.parentId !== data.channel_conf) {
      Logging.info('Someone tried a ticket close command in a non ticket thread');

      await interaction.reply({
        content: "This is not a ticket thread.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    try {
      await interaction.reply(`Ticket closed by ${interaction.user.tag}.`);
      await thread.setArchived(true, `Ticket closed by ${interaction.user.tag}`);
    } catch (error) {
      Logging.error(`Error inside "closeTicket": ${error}`);
      await interaction.reply({
        content: "Oops, something went wrong.!",
      });
    }
  }
}