import { Client, TextChannel } from "discord.js";

export default class Tasks {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }
}
