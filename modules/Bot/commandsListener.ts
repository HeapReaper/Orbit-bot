import {
  Client,
  Interaction,
  Events,
  MessageFlags, EmbedBuilder
} from "discord.js";
import getGuildSettings from "@utils/getGuildSettings";
import { t } from "@utils/i18n";

let instance: CommandsListener | null = null;

export default class CommandsListener {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;

    if (instance) return instance;
    instance = this;

    this.client.on(Events.InteractionCreate, async (interaction) => {
      await this.commandsListener(interaction);
    })
  }

  async commandsListener(interaction: Interaction): Promise<void> {
    if (!interaction.isCommand()) return;
    if (!interaction) return;
    if (!interaction.guild) return;

    const guildSettings = await getGuildSettings(interaction.guild.id);

    const { commandName } = interaction;

    if (commandName !== "status") return;

    const start: number = Date.now();
    const dashboardStatus = await fetch("https://botinorbit.com");
    const ping: number = Date.now() - start;

    const embed = new EmbedBuilder()
      .setTitle("Orbit Status")
      .setDescription(t(guildSettings.language ?? "en", "our_state_for_bot_and_dashboard"))
      .setColor(guildSettings?.primaryColor || "#2F3136")
      .addFields(
        { name: "Bot", value: "Online"},
        { name: "Bot ping", value: `${this.client.ws.ping}ms` },
        { name: "Dashboard", value: dashboardStatus.ok ? "Online" : "Offline"},
        { name: "Dashboard ping", value: `${ping}ms`}
      );

    await interaction.reply({ embeds: [embed] });
  }
}
