import { describe, expect, it } from 'vitest';
import { en } from './en.ts';
import { fi } from './fi.ts';
import { sv } from './sv.ts';
import { formatMoney, formatPercent } from './format.ts';
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
