import fs from "fs";
import path from "path";
import process from "node:process";

// Root folder of your project (content root)
const rootPath = process.cwd();

// Path to locales folder
const localesPath = path.join(process.env.MODULES_BASE_PATH as string, "locales");

// Get supported languages (folders inside locales)
const supportedLanguages = fs.readdirSync(localesPath)
  .filter((folder) => fs.statSync(path.join(localesPath, folder)).isDirectory());

const translations: Record<string, Record<string, string>> = {};

// Load each language's translation.json
for (const lang of supportedLanguages) {
  const filePath = path.join(localesPath, lang, "translation.json");
  if (fs.existsSync(filePath)) {
    translations[lang] = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } else {
    translations[lang] = {};
  }
}

/**
 * Translate a key
 * @param lang language code e.g. "nl"
 * @param key translation key e.g. "already_registered"
 * @param variables optional replacement variables
 */
export function t(lang: string, key: string, variables?: Record<string, string>) {
  let text = translations[lang]?.[key] || translations["en"]?.[key] || key;

  if (variables) {
    for (const [k, v] of Object.entries(variables)) {
      text = text.replace(new RegExp(`{${k}}`, "g"), v);
    }
  }

  return text;
}

export const availableLanguages = supportedLanguages;