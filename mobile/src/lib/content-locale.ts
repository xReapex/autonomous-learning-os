import type { Locale } from './i18n';

export function resolveContentLocale(
  courseLocale: Locale | undefined,
  interfaceLocale: Locale,
): Locale {
  return courseLocale ?? interfaceLocale;
}
