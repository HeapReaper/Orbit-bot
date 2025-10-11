import { createClient } from '@clickhouse/client';
import { getEnv } from '@utils/env';

export const clickhouse = createClient({
  host:     getEnv("CLICKHOUSE_HOST") || 'http://localhost:8123',
  username: getEnv("CLICKHOUSE_USER") || 'default',
  password: getEnv("CLICKHOUSE_PASS") || '',
  database: getEnv("CLICKHOUSE_DB")   || 'default',
});
