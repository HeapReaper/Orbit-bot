import { clickhouseClient } from "@utils/clickhouse.ts";

async function insertTestMessage() {
  try {
    const result = await clickhouseClient.insert({
      table: "discord_messages",
      values: [
        {
          guild_id: "123456789012345678",
          channel_id: "987654321098765432",
          user_id: "111111111111111111",
          message_id: "222222222222222222",
          us_command: 1,
          command_name: "ping",
          created_at: new Date().toISOString().replace("T", " ").replace("Z", "").split(".")[0],
        },
      ],
      format: "JSONEachRow",
    });

    console.log("✅ Insert succesvol:", result);
  } catch (error) {
    console.error("❌ Insert mislukt:", error);
  }
}

insertTestMessage();
