import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  applyLocalePreference,
  loadLocalePreference,
  saveLocalePreference,
  type LocalePreference
} from '../adapters/locale-preference.ts';
import { en, type MessageKey, type Messages } from './en.ts';
import { fi } from './fi.ts';
import { sv } from './sv.ts';
import { formatMoney, formatPercent } from './format.ts';
import type { Language } from './locales.ts';

const MESSAGES: Record<Language, Messages> = { en, fi, sv };

type Params = Record<string, string | number>;
type Listener = () => void;

let preference: LocalePreference = loadLocalePreference();
const listeners = new Set<Listener>();

applyLocalePreference(preference);

export function getLocalePreference(): LocalePreference {
  return preference;
}

export function setLocalePreference(update: Partial<LocalePreference>): void {
  preference = { ...preference, ...update };
  saveLocalePreference(preference);
  applyLocalePreference(preference);
  listeners.forEach((listener) => listener());
}

export function subscribeLocale(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(key: MessageKey, params?: Params): string {
  const template = MESSAGES[preference.language][key] ?? en[key];
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

export function money(amount: number): string {
  return formatMoney(amount, preference.numberLocale, preference.currency);
}

/** `value` is a plain percentage such as 66.67. */
export function percent(value: number): string {
  return formatPercent(value, preference.numberLocale);
}

/** Stored scenario and settlement names are English; show them in the current language. */
export function scenarioName(name: string): string {
  return name === en['scenario.default'] ? t('scenario.default') : name;
}

export function settlementName(name: string): string {
  return name === en['settlement.entryName'] ? t('settlement.entryName') : name;
}

/** Re-renders the host whenever the locale preference changes. */
export class LocalizeController implements ReactiveController {
  private unsubscribe?: () => void;

  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this);
  }

  hostConnected(): void {
    this.unsubscribe = subscribeLocale(() => this.host.requestUpdate());
  }

  hostDisconnected(): void {
    this.unsubscribe?.();
  }
}
