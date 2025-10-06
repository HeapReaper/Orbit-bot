import { Application } from "express";
import { Client, PermissionsBitField } from "discord.js";

export default function registerApi(app: Application, client: Client) {
  app.get("/api/admin-users", async (req, res) => {
    if (!client.isReady()) {
      return res.status(503).json({ error: "Bot not ready" });
    }

    const result: Record<string, { guildName: string; admins: { id: string; tag: string }[] }> = {};

    for (const [guildId, guild] of client.guilds.cache) {
      try {
        const members = await guild.members.fetch();

        const admins = members
          .filter((member) => member.permissions.has(PermissionsBitField.Flags.Administrator))
          .map((member) => ({ id: member.id, tag: member.user.tag }));

        result[guildId] = {
          guildName: guild.name,
          admins,
        };
      } catch (err) {
        console.error(`Failed to fetch members for guild ${guild.name}:`, err);
        result[guildId] = {
          guildName: guild.name,
          admins: [],
        };
      }
    }

    res.json(result);
  });
}