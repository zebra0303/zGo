import path from "path";
import fs from "fs";

type Translations = Record<string, unknown>;

// Strictly allowlist supported locales to prevent path traversal via req.body.language
const SUPPORTED_LANGS = new Set(["ko", "en"]);
const translations = new Map<string, Translations>();

function normalizeLang(lang: string): string {
  return SUPPORTED_LANGS.has(lang) ? lang : "ko";
}

/**
 * Loads translation file for a specific allowlisted language if not already loaded.
 */
const loadLocale = (rawLang: string): Translations => {
  const lang = normalizeLang(rawLang);
  const cached = translations.get(lang);
  if (cached) return cached;

  try {
    const possiblePaths = [
      path.join(__dirname, `../config/locales/${lang}/translation.json`),
      path.join(
        process.cwd(),
        `src/shared/config/locales/${lang}/translation.json`,
      ),
      path.join(
        process.cwd(),
        `dist/shared/config/locales/${lang}/translation.json`,
      ),
    ];

    let filePath = "";
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        filePath = p;
        break;
      }
    }

    if (filePath) {
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content) as Translations;
      translations.set(lang, parsed);
      return parsed;
    } else {
      console.error(
        `Locale file not found for: ${lang}. Checked paths:`,
        possiblePaths,
      );
    }
  } catch (err) {
    console.error(`Failed to load locale: ${lang}`, err);
  }

  return {};
};

function resolveKey(obj: Translations, keys: string[]): unknown {
  let current: unknown = obj;
  for (const k of keys) {
    if (
      typeof current !== "object" ||
      current === null ||
      !Object.prototype.hasOwnProperty.call(current, k)
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[k];
  }
  return current;
}

/**
 * Simple t function to get translated text by dot-notated key.
 */
export const t = (
  lang: string,
  key: string,
  params?: Record<string, string>,
): string => {
  const safeLang = normalizeLang(lang);
  const locale = loadLocale(safeLang);
  const fallbackLocale = safeLang !== "ko" ? loadLocale("ko") : {};

  const keys = key.split(".");
  const result = resolveKey(locale, keys);
  const fallbackResult = resolveKey(fallbackLocale, keys);

  let text = typeof result === "string" ? result : fallbackResult;
  if (typeof text !== "string") return key;

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = (text as string).replaceAll(`{{${k}}}`, v);
    });
  }

  return text;
};
