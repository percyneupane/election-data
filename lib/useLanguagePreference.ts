"use client";

import { useEffect, useState } from "react";
import {
  AppLanguage,
  LANGUAGE_COOKIE_KEY,
  LANGUAGE_STORAGE_KEY,
  normalizeLanguage
} from "@/lib/i18n";

export function useLanguagePreference(): {
  language: AppLanguage;
  isReady: boolean;
  hasSelection: boolean;
  setLanguagePreference: (next: AppLanguage) => void;
} {
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [isReady, setIsReady] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(LANGUAGE_STORAGE_KEY) : null;
    const normalized = normalizeLanguage(stored);
    if (stored === "en" || stored === "ne") {
      setLanguage(normalized);
      setHasSelection(true);
    }
    setIsReady(true);
  }, []);

  const setLanguagePreference = (next: AppLanguage): void => {
    setLanguage(next);
    setHasSelection(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      document.cookie = `${LANGUAGE_COOKIE_KEY}=${next}; path=/; max-age=31536000; samesite=lax`;
    }
  };

  return { language, isReady, hasSelection, setLanguagePreference };
}
