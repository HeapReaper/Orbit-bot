import { createClient } from "@clickhouse/client";
import * as process from "node:process";

let clickhouseClient;

try {
  clickhouseClient = createClient({
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASS,
    database: process.env.CLICKHOUSE_DB,
    url: process.env.CLICKHOUSE_HOST,
  });
} catch (err) {
  console.error("Failed to create ClickHouse client:", err);
}

export { clickhouseClient };
