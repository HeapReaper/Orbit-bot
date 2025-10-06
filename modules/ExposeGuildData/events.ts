import { Client, TextChannel } from "discord.js";

let instance: Events | null = null;

export default class Events {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
    if (instance) return instance;
    instance = this;
  }
}
