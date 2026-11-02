import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  createTranslator,
  type LocalePreference,
  type Translator
} from '@budget-planner/preferences';
import {
  applyLocalePreference,
  loadLocalePreference,
  saveLocalePreference
} from '../adapters/locale-preference.ts';

type Listener = () => void;

let preference: LocalePreference = loadLocalePreference();
let translator: Translator = createTranslator(preference);
const listeners = new Set<Listener>();

applyLocalePreference(preference);

export function getLocalePreference(): LocalePreference {
  return preference;
}

export function setLocalePreference(update: Partial<LocalePreference>): void {
  preference = { ...preference, ...update };
  translator = createTranslator(preference);
  saveLocalePreference(preference);
  applyLocalePreference(preference);
  listeners.forEach((listener) => listener());
}

export function subscribeLocale(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const t: Translator['t'] = (key, params) => translator.t(key, params);
export const money: Translator['money'] = (amount) => translator.money(amount);
export const percent: Translator['percent'] = (value) => translator.percent(value);
export const scenarioName: Translator['scenarioName'] = (name) => translator.scenarioName(name);
export const settlementName: Translator['settlementName'] = (name) => translator.settlementName(name);

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
