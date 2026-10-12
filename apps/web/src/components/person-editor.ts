import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { budgetContext, type BudgetContextValue } from '../context/budget-context.ts';

/** Edits a person's shared display name; consumes budgetContext. */
@customElement('person-editor')
export class PersonEditor extends LitElement {
  static override styles = css`
    :host {
      display: block;
      margin-bottom: 4px;
    }
    input {
      font: inherit;
      border: none;
      border-bottom: 1px solid transparent;
      background: transparent;
      padding: 0;
    }
    input:focus {
      border-bottom-color: #4a90d9;
      outline: none;
    }
  `;

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
      <input
        type="text"
        .value=${person.name}
        aria-label="Person name"
        @input=${this._onInput}
      />
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'person-editor': PersonEditor;
  }
}
