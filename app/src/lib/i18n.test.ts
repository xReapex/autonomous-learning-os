import { describe, expect, it } from "vitest";

import {
  LOCALE_STORAGE_KEY,
  dictionaries,
  resolveLocale,
  translate,
  type LocaleKey,
} from "./i18n";

describe("i18n SCIO", () => {
  it("donne la priorité au choix explicite stocké", () => {
    expect(resolveLocale("en", ["fr-FR"])).toBe("en");
    expect(resolveLocale("fr", ["en-US"])).toBe("fr");
    expect(LOCALE_STORAGE_KEY).toBe("scio:locale");
  });

  it("détecte la première langue navigateur prise en charge puis retombe sur le français", () => {
    expect(resolveLocale(null, ["de-DE", "en-GB", "fr-FR"])).toBe("en");
    expect(resolveLocale(null, ["fr-CA", "en-US"])).toBe("fr");
    expect(resolveLocale("invalid", ["de-DE"])).toBe("fr");
  });

  it("maintient des dictionnaires FR/EN exhaustifs, non vides et de même forme", () => {
    const frenchKeys = Object.keys(dictionaries.fr).sort();
    expect(Object.keys(dictionaries.en).sort()).toEqual(frenchKeys);
    expect(frenchKeys.length).toBeGreaterThan(100);
    for (const locale of ["fr", "en"] as const) {
      for (const key of frenchKeys as LocaleKey[]) {
        expect(dictionaries[locale][key].trim(), `${locale}.${key}`).not.toBe("");
      }
    }
  });

  it("interpole les valeurs dynamiques sans toucher au contenu curriculum", () => {
    expect(translate("en", "dashboard.session.steps", { minutes: 30, count: 4 })).toBe("30 min · 4 steps");
    expect(translate("fr", "shell.activeCurriculum")).toBe("Parcours actif");
  });
});
