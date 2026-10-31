import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { budgetContext, type BudgetContextValue } from '../context/budget-context.ts';
import { icon } from '../ui/icons.ts';
import { LocalizeController, t } from '../i18n/index.ts';

/** Edits a person's shared display name; consumes budgetContext. */
@customElement('person-editor')
export class PersonEditor extends LitElement {
  static override styles = css`
    :host {
      display: block;
      font-family: var(--font);
    }
    label {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 44px;
      padding: 0 14px;
      color: var(--muted);
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      transition: border-color 0.12s, box-shadow 0.12s;
    }
    label:focus-within {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
    }
    .icon {
      flex: none;
    }
    input {
      flex: 1;
      min-width: 0;
      font: inherit;
      font-weight: 500;
      color: var(--text);
      background: transparent;
      border: none;
      outline: none;
      padding: 0;
    }
  `;

  protected readonly _localize = new LocalizeController(this);

  @property({ type: String, attribute: 'person-id' })
  personId = '';

  @consume({ context: budgetContext, subscribe: true })
  budget?: BudgetContextValue;

  private _onInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (this.personId && this.budget) {
      this.budget.renamePerson(this.personId, input.value);
    }
  }

  override render() {
    const person = this.budget?.data.people.find((p) => p.id === this.personId);
    if (!person) {
      return nothing;
    }

    return html`
      <label>
        ${icon('user', 18)}
        <input
          type="text"
          .value=${person.name}
          placeholder=${t('person.namePlaceholder')}
          aria-label=${t('person.nameLabel')}
          @input=${this._onInput}
        />
      </label>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'person-editor': PersonEditor;
  }
}
