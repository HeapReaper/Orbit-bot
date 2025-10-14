import { createClient } from "@clickhouse/client";
import * as process from "node:process";

let clickhouseClient: any;

try {
  clickhouseClient = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    database: process.env.CLICKHOUSE_DB,
    password: process.env.CLICKHOUSE_PASS,
  });
} catch (err) {
  console.error("Failed to create ClickHouse client:", err);
}

export { clickhouseClient };
