import { Application } from "express";
import { Client } from "discord.js";
import cors from "cors";

export default function registerApi(app: Application, client: Client) {
  const allowedOrigins = ["http://localhost:3000", "https://orbit.heapreaper.nl"];

  app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like Postman or server-side)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    }
  }));

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
