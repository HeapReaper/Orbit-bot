import chalk from "chalk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class GuildLogger {
  private static now(): Date {
    return new Date;
  }

  static info(guildId: string, message: string | number): void {
    console.log(`[${this.formatDate(this.now())}] [${chalk.green("INFO")}]  ${message}`);

    void this.saveToDB(guildId, "INFO", message )
  }

  static warn(guildId: string, message: string | number): void {
    console.log(`[${this.formatDate(this.now())}] [${chalk.yellow("WARN")}]  ${message}`);

    void this.saveToDB(guildId, "WARN", message )
  }

  static error(guildId: string, message: string | number): void {
    console.log(`[${this.formatDate(this.now())}] [${chalk.red("ERROR")}] ${message}`);

    void this.saveToDB(guildId, "ERROR", message )
  }

  private static formatDate(now: Date): string {
    return `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getUTCSeconds()).padStart(2, "0")}`;
  }

  private static async saveToDB(guild_id: string, type: string, message: string | number): Promise<void> {
    await prisma.guild_log.create({
      data: {
        guild_id: guild_id,
        type: type,
        message: `${message}`,
      }
    })
  }
}

