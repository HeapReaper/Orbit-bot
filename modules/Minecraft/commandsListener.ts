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
import { prisma } from "@utils/prisma";
import { status } from "minecraft-server-util";

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

    if (!data) {
      await interaction.reply({
        content: "Module hasn't been configured/enabled yet.",
        flags: MessageFlags.Ephemeral
      });
      return
    }

    if (!data.enabled) {
      await interaction.reply({
        content: "Module hasn't been enabled yet.",
        flags: MessageFlags.Ephemeral
      });
      return
    }

    const mcData = await this.getMinecraftPlayers(data.ip, data.port);

    if (!mcData) {
      await interaction.reply({
        content: "Something went wrong!",
        flags: MessageFlags.Ephemeral
      });
      return
    }

    await interaction.reply(`🟢 **Online:** ${mcData.online}/${mcData.max}\n👥 **Players:** ${mcData.list.join(", ") || "Hidden"}`);
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