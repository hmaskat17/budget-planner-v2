import type { CurrencyCode, NumberLocale } from './locales.ts';

export function formatMoney(amount: number, locale: NumberLocale, currency: CurrencyCode): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}

export function formatNumber(value: number, locale: NumberLocale, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits }).format(value);
}

/** `percent` is a plain percentage value such as 66.67, not a fraction. */
export function formatPercent(percent: number, locale: NumberLocale): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(percent / 100);
}
