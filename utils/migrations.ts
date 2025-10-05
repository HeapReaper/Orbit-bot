import fs from "fs";
import path from "path";
import QueryBuilder from "@utils/database.ts";
import { getEnv } from "@utils/env";
import { Logging } from "@utils/logging";

export async function runMigrations(): Promise<void> {
    await QueryBuilder
        .raw(fs.readFileSync(`${<string>getEnv("MODULES_BASE_PATH")}migrations/1745528207-create_migrations_table.sql`, "utf-8"))
        .execute();

    const rows: any[] = await QueryBuilder
        .select("migrations")
        .columns(["name"])
        .execute();

    const appliedMigrations = new Set((rows as any[]).map(row => row.name));

    const migrationFiles = fs
        .readdirSync(`${<string>getEnv("MODULES_BASE_PATH")}migrations`)
        .filter((file: string) => file.endsWith(".sql"))
        .sort((a: string, b: string): number => {
            const aTime: number = parseInt(a.split("-")[0], 10);
            const bTime: number = parseInt(b.split("-")[1], 10);
            return aTime - bTime;
        });

    for (const file of migrationFiles) {
        if (appliedMigrations.has(file)) continue;

        try {
            const migrationFile: string = fs.readFileSync(`${<string>getEnv("MODULES_BASE_PATH")}migrations/${file}`, "utf-8");
            await QueryBuilder
                .raw(migrationFile)
                .execute();

            await QueryBuilder
                .insert("migrations")
                .values({name: `${file}`})
                .execute();

            Logging.info(`Migration ${file} successfully executed!`);
        } catch (error) {
            Logging.error(`Error in migration file: ${file}: ${error}`);
        }
    }
}