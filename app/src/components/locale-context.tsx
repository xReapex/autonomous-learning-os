"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  LOCALE_STORAGE_KEY,
  resolveLocale,
  translate,
  type Locale,
  type LocaleKey,
} from "@/lib/i18n";

type TranslationValues = Record<string, string | number>;
export type Translate = (key: LocaleKey, values?: TranslationValues) => string;

type LocaleValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
  formatDate: (value: string | Date | null | undefined) => string;
  formatDateTime: (value: string | Date | null | undefined) => string;
};

const LocaleContext = createContext<LocaleValue | null>(null);

function validDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>("fr");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      // Le navigateur peut bloquer localStorage ; la détection reste disponible.
    }
    const detected = resolveLocale(stored, navigator.languages?.length ? navigator.languages : [navigator.language]);
    document.documentElement.lang = detected;
    globalThis.queueMicrotask(() => updateLocale(detected));
  }, []);

  const value = useMemo<LocaleValue>(() => ({
    locale,
    setLocale(next) {
      updateLocale(next);
      document.documentElement.lang = next;
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      } catch {
        // Le choix reste actif pour la session si le stockage est indisponible.
      }
    },
    t: (key, values) => translate(locale, key, values),
    formatDate(input) {
      const date = validDate(input);
      return date ? new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", { dateStyle: "medium" }).format(date) : "—";
    },
    formatDateTime(input) {
      const date = validDate(input);
      return date ? new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(date) : "—";
    },
  }), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside LocaleProvider");
  return value;
}
