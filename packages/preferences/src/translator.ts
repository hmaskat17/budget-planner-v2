import { en, type MessageKey, type Messages } from './messages/en.ts';
import { fi } from './messages/fi.ts';
import { sv } from './messages/sv.ts';
import { formatMoney, formatPercent } from './format.ts';
import type { LocalePreference } from './preference.ts';
import type { Language } from './locales.ts';

const MESSAGES: Record<Language, Messages> = { en, fi, sv };

export type TranslationParams = Record<string, string | number>;

export interface Translator {
  t(key: MessageKey, params?: TranslationParams): string;
  money(amount: number): string;
  /** `value` is a plain percentage such as 66.67. */
  percent(value: number): string;
  /** Stored scenario and settlement names are English; show them in the current language. */
  scenarioName(name: string): string;
  settlementName(name: string): string;
}

export function createTranslator(preference: LocalePreference): Translator {
  const t: Translator['t'] = (key, params) => {
    const template = MESSAGES[preference.language][key] ?? en[key];
    if (!params) {
      return template;
    }
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match
    );
  };

  return {
    t,
    money: (amount) => formatMoney(amount, preference.numberLocale, preference.currency),
    percent: (value) => formatPercent(value, preference.numberLocale),
    scenarioName: (name) => (name === en['scenario.default'] ? t('scenario.default') : name),
    settlementName: (name) => (name === en['settlement.entryName'] ? t('settlement.entryName') : name)
  };
}
