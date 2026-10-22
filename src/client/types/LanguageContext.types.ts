import type { translations } from "../context/LanguageContext";

export type Language = "uk" | "en";

export interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

export type TranslationKey = keyof typeof translations.uk;
