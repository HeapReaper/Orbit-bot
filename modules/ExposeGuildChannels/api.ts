import { Application } from "express";
import { Client } from "discord.js";
import cors from "cors";

export default function registerApi(app: Application, client: Client) {
  app.use(cors({ origin: "*" }));

  app.get("/api/ExposeGuildChannels", (req, res) => {
    if (!client.isReady()) {
      return res.status(503).json({ error: "Bot not ready" });
    }

    const guildsChannels = client.guilds.cache.map(guild => ({
      id: guild.id,
      name: guild.name,
      channels: guild.channels.cache.map(channel => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
      })),
    }));

    res.json({ guilds: guildsChannels });
  });
}
