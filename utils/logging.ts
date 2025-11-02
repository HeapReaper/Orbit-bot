import { getEnv } from "@utils/env";
import chalk from "chalk";
import { appendFileSync } from "fs";
import { LogToServer } from "@utils/logToServer";
import { prisma } from "@utils/prisma";

export class Logging {
	private static now(): Date {
		return new Date;
	}

	static info(message: string | number): void {
		console.log(`[${this.formatDate(this.now())}] [${chalk.green("INFO")}]  ${message}`);

		void this.saveToDB("INFO", message )

		if (getEnv("LOG_LEVEL") === "info" || getEnv("LOG_LEVEL") === "all") {
			this.writeToLogFile("INFO", message, this.now());
		}
	}

	static warn(message: string | number): void {
		console.log(`[${this.formatDate(this.now())}] [${chalk.yellow("WARN")}]  ${message}`);

		void this.saveToDB("WARN", message )

		if (getEnv("LOG_LEVEL") === "warn" || getEnv("LOG_LEVEL") === "all") {
			this.writeToLogFile("WARN", message, this.now());
		}
	}

	static error(message: string | number): void {
		console.log(`[${this.formatDate(this.now())}] [${chalk.red("ERROR")}] ${message}`);

		void this.saveToDB("ERROR", message )

		if (getEnv("LOG_LEVEL") === "error" || getEnv("LOG_LEVEL") === "all") {
			this.writeToLogFile("ERROR", message, this.now());
		}

		if (getEnv("LOG_DISCORD")) {
			void this.sendLogToDiscord(message);
		}
	}

	static debug(message: string | number): void {
		if (getEnv("ENVIRONMENT") !== "debug" && getEnv("ENVIRONMENT") !== "development") return;

		console.log(`[${this.formatDate(this.now())}] [${chalk.blue("DEBUG")}] ${message}`);

		if (getEnv("LOG_LEVEL") === "debug" || getEnv("LOG_LEVEL") === "all") {
			this.writeToLogFile("DEBUG", message, this.now());
		}
	}

	static trace(message: string | number): void {
		if (getEnv("ENVIRONMENT") !== "trace"
			  && getEnv("ENVIRONMENT") !== "debug"
			  &&getEnv("ENVIRONMENT") !== "development") return;

		console.log(`[${this.formatDate(this.now())}] [${chalk.grey("TRACE")}] ${message}`);

		if (getEnv("LOG_LEVEL") === "trace" || getEnv("LOG_LEVEL") === "all") {
			this.writeToLogFile("TRACE", message, this.now());
		}
	}

	private static writeToLogFile(level: string, message: string | number, now: Date): void {
		const logLine = `[${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getUTCSeconds()).padStart(2, "0")}] [${level.toUpperCase()}] ${message}\n`;
		appendFileSync(`${<string>getEnv("MODULES_BASE_PATH")}logs/app.log`, logLine, "utf-8");
	}

	private static async sendLogToDiscord(error: string | number): Promise<void> {
		// if (getEnv("ENVIRONMENT") === "development") return;
		//
		// const webhookURL: string = <string>getEnv("LOG_DISCORD_WEBHOOK");
		//
		// if (!webhookURL) {
		// 	Logging.error(`Could not find webhook URL in "sendLogToDiscord"`);
		// 	return;
		// }
		//
		// try {
		// 	await fetch(webhookURL, {
		// 		method: "POST",
		// 		headers: { "Content-Type": "application/json" },
		// 		body: JSON.stringify({
		// 			content: `${<string>getEnv("LOG_DISCORD_TAG")}Bot error: ${error}`,
		// 		}),
		// 	});
		// } catch (error: any) {
		// 	Logging.error(error);
		// }

		await LogToServer.error(error as string)
	}

	private static formatDate(now: Date): string {
		return `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getUTCSeconds()).padStart(2, "0")}`;
	}

	private static async saveToDB(type: string, message: string | number): Promise<void> {
		await prisma.botLog.create({
			data: {
				type: type,
				message: `${message}`,
			}
		})
	}
}

