import { Client, Interaction, Events, MessageFlags } from "discord.js";

export default class CommandsListener {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
    void this.commandsListener();
  }

  async commandsListener(): Promise<void> {
    //
  }
}
