import {
  Client,
  Interaction,
  Events,
  MessageFlags,
  PermissionsBitField,
  EmbedBuilder,
} from "discord.js";
import { Logging } from "@utils/logging";
import QueryBuilder from "@utils/database";
import { formatDate } from "@utils/formatDate";

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
    this.client.on(Events.InteractionCreate, async (interaction: Interaction): Promise<void> => {
        if (!interaction.isCommand()) return;

        const { commandName } = interaction;
        // @ts-ignore
        const subCommandName: string | null = interaction.options.getSubcommand(false);

        if (commandName !== "birthday") return;

        switch (subCommandName) {
          case "add":
            void this.birthdayAdd(interaction);
            break;
          case "delete":
            void this.birthdayRemove(interaction);
            break;
          case "list":
            void this.birthdayList(interaction);
            break;
        }
      },
    );
  }

  async birthdayAdd(interaction: Interaction): Promise<void> {
    if (!interaction.isCommand()) return;
    Logging.info("Adding a birthday");

    try {
      // @ts-ignore
      if (
        (await QueryBuilder.select("birthdays")
          .where({ user_id: interaction.user.id })
          .count()
          .get()) !== 0
      ) {
        await interaction.reply({
          content: "You already added yourself to the birthday function!",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await QueryBuilder.insert("birthdays")
        .values({
          user_id: interaction.user.id,
          // @ts-ignore
          birthdate: `${interaction.options.getInteger("year")}-${interaction.options.getInteger("month")}-${interaction.options.getInteger("day")}`,
          // @ts-ignore
          guild_id: interaction.guild.id,
        })
        .execute();

      await interaction.reply({
        content: "Your birthday has been added! ",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      Logging.error(`Error inside commandListener for Birthday: ${error}`);
      await interaction.reply({
        content:
          "Oops, something went wrong...",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  async birthdayRemove(interaction: Interaction): Promise<void> {
    if (!interaction.isCommand()) return;
    Logging.info("Deleted a birthday");

    try {
      // @ts-ignore
      if (
        (await QueryBuilder.select("birthday")
          .where({ user_id: interaction.user.id })
          .count()
          .get()) === 0
      ) {
        await interaction.reply({
          content: "You ain't in our bot!",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await QueryBuilder.delete("birthday")
        .where({ user_id: interaction.user.id })
        .execute();

      await interaction.reply({
        content: "Your birthday has been deleted!",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      Logging.error(`Something went wrong while deleting birthday: ${error}`);
      await interaction.reply({
        content:
          "Oops, something went wrong...",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  async birthdayList(interaction: Interaction): Promise<void> {
    if (!interaction.isCommand()) return;

    const res = await QueryBuilder
      .select("bot_settings")
      .first();

    if (!interaction.member) {
      await interaction.reply({
        content: "Oops, something went wrong...",
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    if (
      // @ts-ignore
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.ManageMessages,
      )
    ) {
      await interaction.reply({
        content: "Oops, you're missing the right permissions!",
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    const birthdays = await QueryBuilder.select("birthday").execute();

    let color = null

    if (res) {
      color = res.primary_color;
    } else {
      color = 0x3498DB
    }

    const embed = new EmbedBuilder()
      .setColor(color.replace("#", "0x"))
      .setTitle("Birthdays");

    for (const birthday of birthdays) {
      const user = await this.client.users.fetch(birthday.user_id);

      embed.addFields({
        name: user ? user.displayName : birthday.user_id,
        value: formatDate(birthday.birthdate),
      });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}