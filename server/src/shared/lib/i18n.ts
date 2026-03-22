import path from "path";
import fs from "fs";

type Translations = Record<string, any>;

const translations: Record<string, Translations> = {};

/**
 * Loads translation file for a specific language if not already loaded
 */
const loadLocale = (lang: string): Translations => {
  if (translations[lang]) return translations[lang];

  try {
    const filePath = path.join(
      __dirname,
      `../config/locales/${lang}/translation.json`,
    );
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      translations[lang] = JSON.parse(content);
      return translations[lang];
    }
  } catch (err) {
    console.error(`Failed to load locale: ${lang}`, err);
  }

  // Fallback to empty object
  return {};
};

/**
 * Simple t function to get translated text by dot-notated key
 */
export const t = (
  lang: string,
  key: string,
  params?: Record<string, string>,
): string => {
  const locale = loadLocale(lang);
  const fallbackLocale = lang !== "ko" ? loadLocale("ko") : {};

  const keys = key.split(".");
  let result: any = locale;
  let fallbackResult: any = fallbackLocale;

  for (const k of keys) {
    result = result?.[k];
    fallbackResult = fallbackResult?.[k];
  }

  let text = typeof result === "string" ? result : fallbackResult;
  if (typeof text !== "string") return key;

  // Replace parameters {{param}}
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = (text as string).replace(new RegExp(`{{${k}}}`, "g"), v);
    });
  }

  return text;
};
