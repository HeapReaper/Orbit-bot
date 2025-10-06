import { Application } from "express";
import { Client } from "discord.js";
import cors from "cors";

export default function registerApi(app: Application, client: Client) {
  app.use(cors({ origin: "*" }));

  app.get("/api/expose-guild-channels-and-roles", (req, res) => {
    if (!client.isReady()) {
      return res.status(503).json({ error: "Bot not ready" });
    }

    const guildsData = client.guilds.cache.map(guild => ({
      id: guild.id.toString(),
      name: guild.name,
      channels: guild.channels.cache.map(channel => ({
        id: channel.id.toString(),
        name: channel.name,
        type: channel.type,
      })),
      roles: guild.roles.cache.map(role => ({
        id: role.id.toString(),
        name: role.name,
        color: role.color,
        position: role.position,
        hoist: role.hoist,
        permissions: role.permissions.bitfield.toString(),
        managed: role.managed,
      })),
    }));

    res.json({ guilds: guildsData });
  });
}
