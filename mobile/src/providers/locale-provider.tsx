import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  getInitialLocale,
  translate,
  type Locale,
  type TranslationKey,
} from '@/lib/i18n';

export const localeStorageKey = 'scio:locale';

type LocaleContextValue = {
  locale: Locale;
  ready: boolean;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fr');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(localeStorageKey)
      .then((storedLocale) => {
        if (!active) return;
        const languageTags = getLocales().map(({ languageTag }) => languageTag);
        setLocaleState(getInitialLocale(storedLocale, languageTags));
      })
      .catch(() => {
        if (!active) return;
        const languageTags = getLocales().map(({ languageTag }) => languageTag);
        setLocaleState(getInitialLocale(null, languageTags));
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setLocale = useCallback(async (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    await AsyncStorage.setItem(localeStorageKey, nextLocale).catch(() => undefined);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      ready,
      setLocale,
      t: (key, variables) => translate(locale, key, variables),
    }),
    [locale, ready, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used inside LocaleProvider');
  }
  return context;
}
