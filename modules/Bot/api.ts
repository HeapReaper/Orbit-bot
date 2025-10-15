import { Application } from "express";
import { Client } from "discord.js";
import cors from "cors";
import { refreshSlashCommands } from "@utils/refreshSlashCommands";
import { getEnv } from "@utils/env";
import {Logging} from "@utils/logging.ts";

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

  // TODO: Add checkApiKey
  app.post("/api/refresh-commands", async (req, res) => {
    try {
      const guildId = req.query.guildId as string | undefined;
      console.log("[refresh-commands] Received request", { guildId });

      await refreshSlashCommands(guildId);

      res.json({
        success: true,
        message: guildId
          ? `Slash commands refreshed for guild ${guildId}`
          : "Slash commands refreshed for all guilds",
      });
    } catch (error) {
      console.error("[refresh-commands] ERROR:", error);
      res.status(500).json({
        success: false,
        error: "Failed to refresh slash commands",
        details: error instanceof Error ? error.message : error,
      });
    }
  });

  app.get("/api/fetch-info", async (req, res) => {
    Logging.debug("API call /api/fetch-info");

    try {
      const type = req.query.type as "user" | "channel";
      const idsParam = req.query.ids as string;
      if (!type || !idsParam) {
        return res.status(400).json({ error: "Missing required query params: type, ids" });
      }

      const ids = idsParam.split(",").map((id) => id.trim());

      if (!client.isReady()) {
        return res.status(503).json({ error: "Bot not ready" });
      }

      const results: Record<string, string> = {};

      if (type === "user") {
        for (const id of ids) {
          try {
            const user =
              client.users.cache.get(id) ||
              (await client.users.fetch(id).catch(() => null));
            if (user) results[id] = user.tag || user.username;
          } catch {
            results[id] = "Unknown User";
          }
        }
      } else if (type === "channel") {
        for (const id of ids) {
          try {
            const channel =
              client.channels.cache.get(id) ||
              (await client.channels.fetch(id).catch(() => null));
            // @ts-ignore
            if (channel && "name" in channel) results[id] = channel.name;
          } catch {
            results[id] = "Unknown Channel";
          }
        }
      } else {
        return res.status(400).json({ error: "Invalid type. Must be 'user' or 'channel'." });
      }

      res.json({ type, results });
    } catch (error) {
      console.error("[fetch-info] ERROR:", error);
      res.status(500).json({
        error: "Failed to fetch info",
        details: error instanceof Error ? error.message : error,
      });
    }
  });

}
