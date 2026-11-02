import { describe, expect, it } from 'vitest';
import { en } from './messages/en.ts';
import { fi } from './messages/fi.ts';
import { sv } from './messages/sv.ts';
import { formatMoney, formatPercent } from './format.ts';
import { createTranslator } from './translator.ts';
import { detectLocalePreference, parseLocalePreference } from './preference.ts';
import { DEFAULT_THEME_PREFERENCE, parseThemePreference } from './theme.ts';
import {
  CURRENCIES,
  detectCurrency,
  detectLanguage,
  detectNumberLocale,
  searchCurrencies
} from './locales.ts';

const normalize = (value: string) => value.replace(/[\s\u00a0\u202f]/g, ' ');

describe('dictionaries', () => {
  const keys = Object.keys(en).sort();

  it.each([
    ['fi', fi],
    ['sv', sv]
  ])('%s has exactly the English keys', (_name, messages) => {
    expect(Object.keys(messages).sort()).toEqual(keys);
  });

  it.each([
    ['fi', fi],
    ['sv', sv]
  ])('%s keeps the same placeholders and has no empty values', (_name, messages) => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(messages[key].trim(), key).not.toBe('');
      expect(placeholders(messages[key]), key).toEqual(placeholders(en[key]));
    }
  });
});

describe('default detection', () => {
  it('uses the first supported browser language, otherwise English', () => {
    expect(detectLanguage(['fi-FI', 'en-US'])).toBe('fi');
    expect(detectLanguage(['sv'])).toBe('sv');
    expect(detectLanguage(['de-DE', 'sv-SE'])).toBe('sv');
    expect(detectLanguage(['de-DE'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
  });

  it('derives currency from the browser region, otherwise EUR', () => {
    expect(detectCurrency(['fi-FI'])).toBe('EUR');
    expect(detectCurrency(['sv-SE'])).toBe('SEK');
    expect(detectCurrency(['en-US'])).toBe('USD');
    expect(detectCurrency(['en-GB'])).toBe('GBP');
    expect(detectCurrency(['xx-ZZ'])).toBe('EUR');
    expect(detectCurrency([])).toBe('EUR');
  });

  it('picks the closest number format, otherwise Finnish', () => {
    expect(detectNumberLocale(['en-US'])).toBe('en-US');
    expect(detectNumberLocale(['en-AU'])).toBe('en-GB');
    expect(detectNumberLocale(['sv'])).toBe('sv-SE');
    expect(detectNumberLocale(['ja-JP'])).toBe('fi-FI');
    expect(detectNumberLocale([])).toBe('fi-FI');
  });
});

describe('currency search', () => {
  it('lists every currency for an empty query', () => {
    expect(searchCurrencies('', 'en')).toEqual([...CURRENCIES]);
  });

  it('finds currencies by code case-insensitively, exact match first', () => {
    expect(searchCurrencies('usd', 'en')[0]).toBe('USD');
    expect(searchCurrencies('se', 'en')[0]).toBe('SEK');
    expect(searchCurrencies('xyz', 'en')).toEqual([]);
  });

  it('also matches localized names', () => {
    expect(searchCurrencies('dollar', 'en')).toContain('USD');
    expect(searchCurrencies('kruunu', 'fi')).toEqual(expect.arrayContaining(['SEK', 'NOK', 'DKK']));
  });
});

describe('formatting', () => {
  it('formats money by locale and currency', () => {
    expect(normalize(formatMoney(1234.5, 'fi-FI', 'EUR'))).toBe('1 234,50 €');
    expect(formatMoney(1234.5, 'en-US', 'USD')).toBe('$1,234.50');
    expect(normalize(formatMoney(1234.5, 'sv-SE', 'SEK'))).toContain('1 234,50');
    expect(formatMoney(1234, 'en-US', 'JPY')).toBe('¥1,234');
  });

  it('formats percentages from plain percent values', () => {
    expect(normalize(formatPercent(66.666, 'fi-FI'))).toBe('66,67 %');
    expect(formatPercent(100, 'en-US')).toBe('100.00%');
  });
});

describe('translator', () => {
  const pref = { language: 'fi', currency: 'EUR', numberLocale: 'en-US' } as const;

  it('translates with interpolation and formats with the preference', () => {
    const tr = createTranslator(pref);
    expect(tr.t('person.defaultName', { n: 2 })).toBe(fi['person.defaultName'].replace('{n}', '2'));
    expect(tr.money(1234.5)).toBe('€1,234.50');
    expect(tr.percent(100)).toBe('100.00%');
  });

  it('keeps unknown placeholders and maps stored English names', () => {
    const tr = createTranslator({ ...pref, language: 'sv' });
    expect(tr.t('person.defaultName')).toContain('{n}');
    expect(tr.scenarioName('Default')).toBe(sv['scenario.default']);
    expect(tr.scenarioName('Custom')).toBe('Custom');
    expect(tr.settlementName('Shared expense settlement')).toBe(sv['settlement.entryName']);
  });
});

describe('preference parsing', () => {
  const defaults = detectLocalePreference(['fi-FI']);

  it('validates each field separately and falls back to defaults', () => {
    expect(parseLocalePreference({ language: 'sv', currency: 'XXX', numberLocale: 'en-US' }, defaults)).toEqual({
      language: 'sv',
      currency: defaults.currency,
      numberLocale: 'en-US'
    });
    expect(parseLocalePreference(null, defaults)).toEqual(defaults);
    expect(parseLocalePreference('x', defaults)).toEqual(defaults);
  });
});

describe('theme preference parsing', () => {
  it('accepts valid preferences and defaults otherwise', () => {
    expect(parseThemePreference({ colorScheme: 'ocean', colorMode: 'dark' })).toEqual({
      colorScheme: 'ocean',
      colorMode: 'dark'
    });
    expect(parseThemePreference({ colorScheme: 'nope', colorMode: 'dark' })).toEqual(DEFAULT_THEME_PREFERENCE);
    expect(parseThemePreference(undefined)).toEqual(DEFAULT_THEME_PREFERENCE);
  });

  it('has a translation for every color scheme', async () => {
    const { COLOR_SCHEMES } = await import('./theme.ts');
    for (const { id } of COLOR_SCHEMES) {
      for (const messages of [en, fi, sv]) {
        expect(messages[`theme.${id}` as keyof typeof en], id).toBeTruthy();
      }
    }
  });
});
