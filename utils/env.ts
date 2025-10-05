import * as process from "node:process";

export const getEnv = (key: string, fallback: string = ""): string|undefined => {
	const envValue: string | number | boolean | undefined = process.env[key];

	return envValue ? envValue : fallback;
}