import { Client, TextChannel } from "discord.js";
import cron from "node-cron";

let instance: Tasks | null = null;

export default class Tasks {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
    if (instance) return instance;
    instance = this;

    cron.schedule("* * * * *", async () => {
      await this.task();
    })
  }

  async task() {
    // Check if there are guilds where the trail/premium has ended

    // Send message to updates channel or server owner if expired or almost expired:

    // Disable premium for guilds where it expired
  }
}
