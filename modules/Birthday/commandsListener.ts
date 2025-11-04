import {
  Client,
  Interaction,
  Events,
  MessageFlags,
  PermissionsBitField,
  EmbedBuilder,
  ColorResolvable,
  ChatInputCommandInteraction,
} from "discord.js";
import { Logging } from "@utils/logging";
import { formatDate } from "@utils/formatDate";
import { GuildLogger } from "@utils/guildLog";
import { prisma } from "@utils/prisma";

let instance: CommandsListener | null = null;

export default class CommandsListener {
  private client: Client;

  constructor(client: Client) {
    this.client = client;

    if (instance) return;
    instance = this;
    void this.commandListener();
  }

  async commandListener(): Promise<void> {
    this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      if (!interaction.isCommand()) return;

      const { commandName } = interaction;
      let subCommandName: string | null = null;

      if (interaction.isChatInputCommand()) {
        subCommandName = interaction.options.getSubcommand(false);
      }

      if (commandName !== "birthday") return;

      switch (subCommandName) {
        case "add":
          if (interaction.isChatInputCommand()) {
            void this.birthdayAdd(interaction);
          }
          break;
        case "delete":
          void this.birthdayRemove(interaction);
          break;
        case "list":
          void this.birthdayList(interaction);
          break;
      }
    });
  }

  async birthdayAdd(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;

    GuildLogger.info(
      interaction.guild.id,
      `User ${interaction.user.username} ran the command /birthday add`
    );

    try {
      // Check if birthday already exists
      const existingBirthday = await prisma.birthday.findFirst({
        where: {
          userId: interaction.user.id,
          guildId: interaction.guild.id,
        },
      });

      if (existingBirthday) {
        await interaction.reply({
          content: "You already added yourself to the birthday function!",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Get birthdate from options
      const year = interaction.options.getInteger("year");
      const month = interaction.options.getInteger("month");
      const day = interaction.options.getInteger("day");

      if (!year || !month || !day) {
        await interaction.reply({
          content: "Invalid date provided.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const birthdate = new Date(year, month - 1, day);

      await prisma.birthday.create({
        data: {
          guildId: interaction.guild.id,
          userId: interaction.user.id,
          birthdate,
        },
      });

      await interaction.reply({
        content: "Your birthday has been added!",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      Logging.error(`Error adding birthday: ${error}`);
      await interaction.reply({
        content: "Oops, something went wrong...",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  async birthdayRemove(interaction: Interaction): Promise<void> {
    if (!interaction.isCommand() || !interaction.guild) return;

    GuildLogger.info(
      interaction.guild.id,
      `User ${interaction.user.username} ran the command /birthday remove`
    );

    try {
      const existingBirthday = await prisma.birthday.findFirst({
        where: {
          userId: interaction.user.id,
          guildId: interaction.guild.id,
        },
      });

      if (!existingBirthday) {
        await interaction.reply({
          content: "You aren't in our birthday list!",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await prisma.birthday.deleteMany({
        where: {
          userId: interaction.user.id,
          guildId: interaction.guild.id,
        },
      });

      await interaction.reply({
        content: "Your birthday has been deleted!",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      Logging.error(`Error deleting birthday: ${error}`);
      await interaction.reply({
        content: "Oops, something went wrong...",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  async birthdayList(interaction: Interaction): Promise<void> {
    if (!interaction.isCommand() || !interaction.guild) return;

    GuildLogger.info(
      interaction.guild.id,
      `User ${interaction.user.username} ran the command /birthday list`
    );

    // Fetch bot settings (for embed color)
    const res = await prisma.botSettings.findFirst();

    if (!interaction.member) {
      await interaction.reply({
        content: "Oops, something went wrong...",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check permissions
    // @ts-ignore
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      await interaction.reply({
        content: "Oops, you're missing the right permissions!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const birthdays = await prisma.birthday.findMany({
        where: {
          guildId: interaction.guild.id,
        },
      });

      const embed = new EmbedBuilder()
        .setColor((res?.primaryColor as ColorResolvable) ?? "Blue")
        .setTitle("Birthdays");

      for (const birthday of birthdays) {
        const user = await this.client.users.fetch(birthday.userId);
        embed.addFields({
          name: user ? user.username : birthday.userId,
          value: formatDate(birthday.birthdate),
        });
      }

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (error) {
      Logging.error(`Error listing birthdays: ${error}`);
      await interaction.reply({
        content: "Oops, something went wrong...",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}