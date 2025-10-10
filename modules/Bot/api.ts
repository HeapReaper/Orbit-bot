import { Application } from "express";
import { Client } from "discord.js";
import cors from "cors";
import { refreshSlashCommands } from "@utils/refreshSlashCommands";
import { getEnv } from "@utils/env";

export default function registerApi(app: Application, client: Client) {
  const allowedOrigins = ["http://localhost:3000", "https://botinorbit.com"];

  app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
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
      status: "Online",
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

  function checkApiKey(req: any, res: any, next: any ) {
    const apiKey = req.headers["x-api-key"];
    const validKey = getEnv("API_KEY");

    if (!apiKey || apiKey !== validKey) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    next();
  }

  app.post("/api/refresh-commands", checkApiKey, async (req, res) => {
    try {
      const guildId = req.query.guildId as string | undefined;

      await refreshSlashCommands(guildId);

      res.json({
        success: true,
        message: guildId
          ? `Slash commands refreshed for guild ${guildId}`
          : "Slash commands refreshed for all guilds",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        error: "Failed to refresh slash commands",
        // @ts-ignore
        details: error.message,
      });
    }
  });
}
