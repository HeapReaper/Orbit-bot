import fs from "fs";
import path from "path";
import process from "node:process";
import {getEnv} from "@utils/env.ts";

let translations: Record<string, Record<string, string>> | null = null;

function loadTranslations() {
  if (translations) return translations; // already loaded

  const localesPath = path.join(getEnv("MODULES_BASE_PATH") as string, "locales");

  const supportedLanguages = fs.readdirSync(localesPath)
    .filter((folder) => fs.statSync(path.join(localesPath, folder)).isDirectory());

  const result: Record<string, Record<string, string>> = {};

  for (const lang of supportedLanguages) {
    const filePath = path.join(localesPath, lang, "translation.json");
    if (fs.existsSync(filePath)) {
      result[lang] = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } else {
      result[lang] = {};
    }
  }

  translations = result;
  return translations;
}

export function t(lang: string, key: string, variables?: Record<string, string>) {
  const translations = loadTranslations(); // ensure loaded
  let text = translations[lang]?.[key] || translations["en"]?.[key] || key;

  if (variables) {
    for (const [k, v] of Object.entries(variables)) {
      text = text.replace(new RegExp(`{${k}}`, "g"), v);
    }
  }

  return text;
}