import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { baseStyles } from '../ui/shared-styles.ts';
import { icon } from '../ui/icons.ts';
import {
  LocalizeController,
  getLocalePreference,
  setLocalePreference,
  t
} from '../i18n/index.ts';
import {
  LANGUAGES,
  NUMBER_LOCALES,
  getCurrencyName,
  isLanguage,
  isNumberLocale,
  searchCurrencies,
  type CurrencyCode
} from '../i18n/locales.ts';
import { formatMoney } from '../i18n/format.ts';

function numberLocaleLabel(locale: string, language: string): string {
  try {
    return new Intl.DisplayNames([language], { type: 'language' }).of(locale) ?? locale;
  } catch {
    return locale;
  }
}

/** Language, currency and number-format preferences. Currency is display-only: no conversion. */
@customElement('locale-settings')
export class LocaleSettings extends LitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        position: relative;
        display: inline-block;
      }
      .toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 36px;
        padding: 0 12px;
        font-size: 0.85rem;
        color: var(--text);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
      }
      .toggle:focus-visible,
      .currency-option:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      .panel {
        position: absolute;
        right: 0;
        z-index: 20;
        display: flex;
        flex-direction: column;
        gap: 14px;
        width: min(320px, calc(100vw - 32px));
        margin-top: 8px;
        padding: 16px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        box-shadow: 0 8px 24px rgb(0 0 0 / 0.15);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .field label {
        font-size: 0.8125rem;
        color: var(--muted);
      }
      .field select,
      .field input {
        width: 100%;
      }
      .currency-list {
        max-height: 168px;
        margin: 0;
        padding: 0;
        overflow-y: auto;
        list-style: none;
        border: 1px solid var(--border-soft);
        border-radius: var(--radius-sm);
      }
      .currency-option {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 6px 10px;
        text-align: left;
        font-size: 0.85rem;
        color: var(--text);
        background: transparent;
        border: 0;
      }
      .currency-option:hover {
        background: var(--border-soft);
      }
      .currency-option[aria-selected='true'] {
        font-weight: 600;
        color: var(--accent);
      }
      .currency-code {
        min-width: 3ch;
        font-variant-numeric: tabular-nums;
      }
      .currency-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--muted);
      }
      .empty,
      .hint {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--muted);
      }
      .empty {
        padding: 8px 10px;
      }
    `
  ];

  protected readonly _localize = new LocalizeController(this);

  @state()
  private _open = false;

  @state()
  private _query = '';

  private readonly _onDocumentPointerDown = (event: PointerEvent): void => {
    if (this._open && !event.composedPath().includes(this)) {
      this._open = false;
    }
  };

  private readonly _onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (this._open && event.key === 'Escape') {
      this._open = false;
    }
  };

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('pointerdown', this._onDocumentPointerDown);
    document.addEventListener('keydown', this._onDocumentKeyDown);
  }

  override disconnectedCallback(): void {
    document.removeEventListener('pointerdown', this._onDocumentPointerDown);
    document.removeEventListener('keydown', this._onDocumentKeyDown);
    super.disconnectedCallback();
  }

  private _selectCurrency(currency: CurrencyCode): void {
    setLocalePreference({ currency });
    this._query = '';
  }

  private _onCurrencyKeyDown(event: KeyboardEvent, matches: CurrencyCode[]): void {
    if (event.key === 'Enter' && matches.length > 0) {
      event.preventDefault();
      this._selectCurrency(matches[0]);
    }
  }

  override render() {
    const preference = getLocalePreference();
    const matches = searchCurrencies(this._query, preference.language);

    return html`
      <button
        type="button"
        id="locale-toggle"
        class="toggle"
        aria-expanded=${this._open ? 'true' : 'false'}
        aria-controls="locale-panel"
        aria-label=${t('settings.regional')}
        @click=${() => (this._open = !this._open)}
      >
        ${icon('globe', 16)}${preference.language.toUpperCase()} · ${preference.currency}
      </button>

      ${this._open
        ? html`
            <div id="locale-panel" class="panel" role="group" aria-label=${t('settings.regional')}>
              <div class="field">
                <label for="language-select">${t('settings.language')}</label>
                <select
                  id="language-select"
                  @change=${(e: Event) => {
                    const value = (e.target as HTMLSelectElement).value;
                    if (isLanguage(value)) setLocalePreference({ language: value });
                  }}
                >
                  ${LANGUAGES.map(
                    ({ id, label }) =>
                      html`<option value=${id} ?selected=${preference.language === id}>${label}</option>`
                  )}
                </select>
              </div>

              <div class="field">
                <label for="number-format-select">${t('settings.numberFormat')}</label>
                <select
                  id="number-format-select"
                  @change=${(e: Event) => {
                    const value = (e.target as HTMLSelectElement).value;
                    if (isNumberLocale(value)) setLocalePreference({ numberLocale: value });
                  }}
                >
                  ${NUMBER_LOCALES.map(
                    (locale) => html`
                      <option value=${locale} ?selected=${preference.numberLocale === locale}>
                        ${numberLocaleLabel(locale, preference.language)} —
                        ${formatMoney(1234.56, locale, preference.currency)}
                      </option>
                    `
                  )}
                </select>
              </div>

              <div class="field">
                <label for="currency-search">${t('settings.currency')}</label>
                <input
                  id="currency-search"
                  type="search"
                  autocomplete="off"
                  placeholder=${t('settings.currencySearch')}
                  .value=${this._query}
                  @input=${(e: Event) => (this._query = (e.target as HTMLInputElement).value)}
                  @keydown=${(e: KeyboardEvent) => this._onCurrencyKeyDown(e, matches)}
                />
                ${matches.length
                  ? html`
                      <ul class="currency-list" role="listbox" aria-label=${t('settings.currency')}>
                        ${matches.map(
                          (code) => html`
                            <li role="presentation">
                              <button
                                type="button"
                                role="option"
                                class="currency-option"
                                data-currency=${code}
                                aria-selected=${preference.currency === code ? 'true' : 'false'}
                                @click=${() => this._selectCurrency(code)}
                              >
                                <span class="currency-code">${code}</span>
                                <span class="currency-name">${getCurrencyName(code, preference.language)}</span>
                                ${preference.currency === code ? icon('check', 14) : ''}
                              </button>
                            </li>
                          `
                        )}
                      </ul>
                    `
                  : html`<p class="empty">${t('settings.currencyNoMatch')}</p>`}
                <p class="hint">${t('settings.currencyHint')}</p>
              </div>
            </div>
          `
        : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'locale-settings': LocaleSettings;
  }
}
