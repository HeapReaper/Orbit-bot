import { mkdirSync, existsSync, writeFileSync } from "fs";
import * as process from "node:process";

export async function makeNewModule(name: string) {
  const modulesDir = `./modules`;
  const moduleNameToCreate = name;

  console.log(`Making module named ${moduleNameToCreate} inside ${modulesDir}/`);

  if (existsSync(`${modulesDir}/${moduleNameToCreate}`)) {
    console.error(`Module named ${moduleNameToCreate} already exists!`);
    process.exit();
  }

  // Making module folder
  mkdirSync(`${modulesDir}/${moduleNameToCreate}`);

  const commandsFileWrite = `import { SlashCommandBuilder } from "discord.js";

export const commands = [

].map(commands => commands.toJSON());
`;

  const commandsListenerFileWrite = `import { Client, Interaction, Events, MessageFlags } from "discord.js";

let instance: CommandsListener | null = null;

export default class CommandsListener {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
    
    if (instance) return instance;
    instance = this;
  }
}
`;

  const eventsFileWrite = `import {
  Client,
  Events as DiscordEvents, 
} from "discord.js";

let instance: Events | null = null;

export default class Events {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
    
    if (instance) return instance;
    instance = this;
  }
}
`;

  const tasksFileWrite = `import { Client, TextChannel } from "discord.js";

let instance: Tasks | null = null;

export default class Tasks {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
    if (instance) return instance;
    instance = this;
  }
}
`;

  const apiFileWrite = `import { Application } from "express";
import { Client } from "discord.js";

export default function registerApi(app: Application, client: Client) {
  // app.get("/api/${moduleNameToCreate}", (req, res) => {
  //   res.json({ message: "Hello from ${moduleNameToCreate}!" });
  // });
}
`;

  // Writing module files
  writeFileSync(`${modulesDir}/${moduleNameToCreate}/commands.ts`, commandsFileWrite);
  writeFileSync(`${modulesDir}/${moduleNameToCreate}/commandsListener.ts`, commandsListenerFileWrite);
  writeFileSync(`${modulesDir}/${moduleNameToCreate}/events.ts`, eventsFileWrite);
  writeFileSync(`${modulesDir}/${moduleNameToCreate}/tasks.ts`, tasksFileWrite);
  writeFileSync(`${modulesDir}/${moduleNameToCreate}/api.ts`, apiFileWrite);

console.log(`I created the module with the name: ${moduleNameToCreate}`);
}
