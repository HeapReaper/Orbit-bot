import { createClient } from "@clickhouse/client";
import * as process from "node:process";

let clickhouseClient: any;

try {
  clickhouseClient = createClient({
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASS,
    database: process.env.CLICKHOUSE_DB,
    host: process.env.CLICKHOUSE_HOST,
    url: process.env.CLICKHOUSE_URL,
  });
} catch (err) {
  console.error("Failed to create ClickHouse client:", err);
}

export { clickhouseClient };
