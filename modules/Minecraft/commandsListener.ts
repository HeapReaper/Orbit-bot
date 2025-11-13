import {
  Client,
  Interaction,
  Events,
  MessageFlags,
  EmbedBuilder,
} from "discord.js";
import { Logging } from "@utils/logging";
import { prisma } from "@utils/prisma";
import { status } from "minecraft-server-util";
import getGuildSettings from "@utils/getGuildSettings";
import { t } from "utils/i18n";

let instance: CommandsListener | null = null;

export default class CommandsListener {
  private client: Client;

  constructor(client: Client) {
    this.client = client;

    if (instance) return;
    instance = this;

    this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      if (!interaction.isCommand()) return;

      const { commandName } = interaction;

      if (commandName !== "minecraft") return;

      await this.handleMinecraftCommand(interaction);
    });
  }

  async handleMinecraftCommand(interaction: Interaction): Promise<void> {
    if (!interaction.isCommand()) return;

    if (!interaction.guild) return;
    if (!interaction.guild.id) return;

    // TODO: Add Redis caching
    const data = await prisma.minecraftSettings.findFirst({
      where: {
        guildId: interaction.guild.id as string,
      }
    });

    console.log(data);
    if (!data) {
      console.log("Heee");
      await interaction.reply({
        content: "Module hasn't been configured yet.",
        flags: MessageFlags.Ephemeral
      });
      return
    }

    console.log(data.enabled)
    if (!data.enabled) {
      console.log("Hoop");

      await interaction.reply({
        content: "Module hasn't been enabled yet.",
        flags: MessageFlags.Ephemeral
      });
      return
    }

    const mcData = await this.getMinecraftPlayers(data.ip, data.port);
    const guildSettings = await getGuildSettings(interaction.guild.id);

    if (!mcData) {
      await interaction.reply({
        content: "Something went wrong!",
        flags: MessageFlags.Ephemeral
      });
      return
    }

    const embed = new EmbedBuilder()
      .setTitle("Minecraft Server Status")
      .setColor(guildSettings?.primaryColor || "#2F3136")
      .addFields(
        { name: t(guildSettings?.language, "online_players"), value: `${mcData.online}/${mcData.max}`, inline: true },
        {
          name: t(guildSettings?.language, "player_list"),
          value: mcData.list.length > 0 ? mcData.list.join(", ") : "Hidden",
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ text: "Minecraft Server Info" });

    await interaction.reply({ embeds: [embed] });
  }

  async getMinecraftPlayers(host: string, port: number = 25565) {
    try {
      const res = await status(host, port);

      return {
        online: res.players.online,
        max: res.players.max,
        list: res.players.sample?.map(player => player.name ) || []
      }
    } catch (err) {
      console.error(err);
      return null;
    }
  }
}