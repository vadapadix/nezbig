import React, { createContext, useContext, useState } from "react";

export type Language = "uk" | "en";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

export const translations = {
  uk: {
    // Header & Nav
    brandTagline: "Немає збігів. Є власний текст.",
    navHome: "Головна",
    navHumanize: "Олюднення тексту",
    navHistory: "Історія перевірок",
    signIn: "Увійти",
    signOut: "Вийти",
    account: "Акаунт",
    
    // Editor & Scan
    editorPlaceholder: "Вставте або почніть вводити текст для перевірки (щонайменше 25 слів)...",
    runScan: "Запустити перевірку",
    scanning: "Перевіряємо...",
    clearText: "Очистити",
    insertSample: "Вставити приклад",
    uploadFile: "Завантажити файл",
    fileReady: "Файл завантажено та готовий до перевірки",
    fileFormats: "Підтримуються формати .docx, .pdf",
    wordsCount: "слів",
    charsCount: "символів",
    scanSettings: "Налаштування перевірки",
    fastMode: "Швидко",
    deepMode: "Глибоко",
    expertMode: "Експертно",
    academicSources: "Наукові бази (Crossref, OpenAlex)",
    chunkSize: "Розмір фрагмента",
    estTime: "Орієнтовно",
    overlap: "Перекриття",
    addTextFirst: "після додавання тексту",
    
    // Humanizer
    humanizeTitle: "Олюднення тексту",
    humanizeSubtitle: "Усунення шаблонів ШІ, регулювання темпоритму та збагачення лексики",
    humanizeBtn: "Олюднити текст",
    humanizing: "Олюднюємо...",
    modeAcademic: "Академічний",
    modeNatural: "Природний",
    modeConcise: "Лаконічний",
    aiRiskBefore: "Ризик ШІ до:",
    aiRiskAfter: "Ризик ШІ після:",
    originalText: "Оригінальний текст",
    humanizedText: "Олюднений результат",
    copyResult: "Скопіювати",
    copied: "Скопійовано!",

    // Report
    reportTitle: "Звіт Незбіг",
    plagiarism: "Плагіат",
    aiAnalysis: "ШІ-аналіз",
    aiOpinion: "AI-думка",
    fragments: "Фрагменти",
    summary: "Підсумок",
    foundSources: "Ймовірні джерела",
    noMatchesFound: "Сильних збігів у відкритих вебджерелах не знайдено.",
    aiSignals: "Маркери штучного інтелекту",
    copyLink: "Копіювати посилання",
    exportPdf: "PDF",
    exportPng: "PNG",
    exportJson: "JSON",
    lowRisk: "Низький",
    moderateRisk: "Помірний",
    highRisk: "Високий",
    risk: "ризик",
    levelFromModel: "рівень від моделі",
    modelThinking: "модель ще думає",
    noModelResponse: "немає відповіді моделі",
    retryModel: "Спробувати ще раз",

    // Footer & Modals
    aboutUs: "Про нас",
    privacy: "Конфіденційність",
    terms: "Умови використання",
    reportBug: "Повідомити про помилку",
    copyright: "© 2026 НЕЗБІГ 2.0. Немає збігів. Є власний текст."
  },
  en: {
    // Header & Nav
    brandTagline: "Original thoughts. Zero matches.",
    navHome: "Plagiarism Checker",
    navHumanize: "Text Humanizer",
    navHistory: "Scan History",
    signIn: "Sign In",
    signOut: "Sign Out",
    account: "Account",

    // Editor & Scan
    editorPlaceholder: "Paste or start typing your text to check (at least 25 words)...",
    runScan: "Run Plagiarism Scan",
    scanning: "Scanning...",
    clearText: "Clear",
    insertSample: "Insert Sample",
    uploadFile: "Upload File",
    fileReady: "File uploaded and ready to scan",
    fileFormats: "Supports .docx and .pdf formats",
    wordsCount: "words",
    charsCount: "characters",
    scanSettings: "Scan Settings",
    fastMode: "Standard Fast",
    deepMode: "Deep Analysis",
    expertMode: "Expert Scan",
    academicSources: "Scholarly databases (Crossref, OpenAlex)",
    chunkSize: "Chunk Size",
    estTime: "Est. Time",
    overlap: "Overlap",
    addTextFirst: "add text first",

    // Humanizer
    humanizeTitle: "AI Text Humanizer",
    humanizeSubtitle: "Remove AI patterns, adjust burstiness pacing, and enrich vocabulary",
    humanizeBtn: "Humanize Text",
    humanizing: "Humanizing...",
    modeAcademic: "Academic",
    modeNatural: "Natural",
    modeConcise: "Concise",
    aiRiskBefore: "AI score before:",
    aiRiskAfter: "AI score after:",
    originalText: "Original text",
    humanizedText: "Humanized output",
    copyResult: "Copy output",
    copied: "Copied!",

    // Report
    reportTitle: "Nezbig Report",
    plagiarism: "Plagiarism",
    aiAnalysis: "AI Detection",
    aiOpinion: "AI Opinion",
    fragments: "Chunks",
    summary: "Executive Summary",
    foundSources: "Discovered Sources",
    noMatchesFound: "No significant matches found in open scholarly and web sources.",
    aiSignals: "AI Stylometry Signals",
    copyLink: "Copy Link",
    exportPdf: "PDF",
    exportPng: "PNG",
    exportJson: "JSON",
    lowRisk: "Low",
    moderateRisk: "Moderate",
    highRisk: "High",
    risk: "risk",
    levelFromModel: "level from model",
    modelThinking: "AI model thinking...",
    noModelResponse: "no model response",
    retryModel: "Retry",

    // Footer & Modals
    aboutUs: "About",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    reportBug: "Report an issue",
    copyright: "© 2026 NEZBIG 2.0. Original thoughts. Zero matches."
  }
} as const;

export type TranslationKey = keyof typeof translations.uk;

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => translations.en[key] || key
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem("nezbig_lang") as Language;
    if (saved === "uk" || saved === "en") return saved;
    // Default to EN for international moderation / global users
    return "en";
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("nezbig_lang", newLang);
  };

  const t = (key: TranslationKey): string => {
    return translations[lang][key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
