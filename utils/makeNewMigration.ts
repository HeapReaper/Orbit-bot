import { writeFileSync } from "fs";
import * as process from "node:process";
import { getEnv } from "@utils/env";

export async function makeNewMigration(name: string): Promise<void> {
    try {
        const migrationDir: string = `${getEnv("MODULES_BASE_PATH") as string}migrations`;
        const migrationFileName: string = `${Math.floor(Date.now() / 1000)}-${name}.sql`;

        console.info(`Creating migration ${migrationDir}/${migrationFileName}`);

        writeFileSync(`${migrationDir}/${migrationFileName}`, "");
    } catch (error) {
        console.error(error);
    }
}
