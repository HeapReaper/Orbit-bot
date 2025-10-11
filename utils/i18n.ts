import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const localesPath = path.join(__dirname, "../src/locales");
const supportedLanguages = fs.readdirSync(localesPath)
  .filter(file => file.endsWith(".json"))
  .map(file => file.replace(".json", ""));

const translations: Record<string, Record<string, string>> = {};

for (const lang of supportedLanguages) {
  translations[lang] = JSON.parse(fs.readFileSync(path.join(localesPath, lang + ".json"), "utf8"));
}

export async function t(guildId: string, key: string, variables?: Record<string, string>) {
  const data = await prisma.bot_settings.findFirst({
    where: {
      guild_id: guildId,
    }
  });

  const lang = data?.language || "en";

  let text = translations[lang]?.[key] || translations["en"][key] || key;

  if (variables) {
    for (const [k, v] of Object.entries(variables)) {
      text = text.replace(`{${k}}`, v);
    }
  }
  return text;
}

export const availableLanguages = supportedLanguages;
