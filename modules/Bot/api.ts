import { Application } from "express";
import { Client } from "discord.js";
import cors from "cors";

export default function registerApi(app: Application, client: Client) {
  const allowedOrigins = ["http://localhost:3000", "https://orbit.heapreaper.nl"];

  app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
    })
  );

  app.get("/api/bot-info", (req, res) => {
    if (!client.isReady()) {
      return res.status(503).json({ error: "Bot not ready" });
    }

    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);

    res.json({
      status: client.isReady() ? "Online" : "Offline",
      uptime: `${hours}h ${minutes}m`,
      ping: client.ws.ping,
      guilds: client.guilds.cache.size,
      users: client.users.cache.size,
      channels: client.channels.cache.size,
      nodeVersion: process.version,
      memoryUsageMB: (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2),
      platform: process.platform,
    });
  });
}
