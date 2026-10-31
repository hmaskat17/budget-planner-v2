import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import type { Entry } from '@budget-planner/core';
import { entriesTotal } from '@budget-planner/core';
import { scenarioStyles } from './scenario-budget.ts';
import { budgetContext, type BudgetContextValue } from '../context/budget-context.ts';
import { icon } from '../ui/icons.ts';
import { LocalizeController, money, t } from '../i18n/index.ts';

/**
 * Per-person list of money and assets held elsewhere (other accounts, gold, cash).
 * Purely informational: no other component reads these totals, and it uses no scenarios.
 */
@customElement('budget-unallocated-assets')
export class BudgetUnallocatedAssets extends LitElement {
  static override styles = scenarioStyles;

  protected readonly _localize = new LocalizeController(this);

  @property({ type: String, attribute: 'person-id' })
  personId = '';

  @consume({ context: budgetContext, subscribe: true })
  budget?: BudgetContextValue;

  entries(): Entry[] {
    return this.budget?.data.assetsByPerson[this.personId] ?? [];
  }

  total(): number {
    return entriesTotal(this.entries());
  }

  private _commit(entries: Entry[]): void {
    if (this.personId && this.budget) {
      this.budget.updateAssets(this.personId, entries);
    }
  }

  addEntry(): void {
    const list = [...this.entries(), { name: '', amount: 0 }];
    this._commit(list);
  }

  removeEntry(index: number): void {
    const list = this.entries().filter((_, idx) => idx !== index);
    this._commit(list);
  }

  updateEntryName(index: number, name: string): void {
    const list = this.entries().map((item, idx) => (idx === index ? { ...item, name } : item));
    this._commit(list);
  }

  updateEntryAmount(index: number, amountStr: string): void {
    const amount = Number(amountStr) || 0;
    const list = this.entries().map((item, idx) => (idx === index ? { ...item, amount } : item));
    this._commit(list);
  }

  override render() {
    const person = this.budget?.data.people.find((p) => p.id === this.personId);
    const entries = this.entries();

    return html`
      <h3 class="person-name">${icon('user', 16)}${person?.name ?? t('person.fallback')}</h3>

      <div class="entry-inputs">
        ${entries.map(
          (entry, index) => html`
            <div class="entry-row">
              <input
                type="text"
                placeholder=${t('assets.placeholder')}
                .value=${entry.name}
                @input=${(e: Event) =>
                  this.updateEntryName(index, (e.target as HTMLInputElement).value)}
              />
              <input
                type="number"
                placeholder=${t('common.amount')}
                .value=${String(entry.amount)}
                @input=${(e: Event) =>
                  this.updateEntryAmount(index, (e.target as HTMLInputElement).value)}
              />
              <button
                type="button"
                class="remove-entry-input"
                title=${t('common.remove')}
                aria-label=${t('common.remove')}
                @click=${() => this.removeEntry(index)}
              >
                ${icon('trash', 16)}
              </button>
            </div>
          `
        )}
      </div>

      <button
        type="button"
        class="add-entry-button"
        @click=${() => this.addEntry()}
      >
        ${icon('plus', 14)}${t('assets.add')}
      </button>

      <p class="person-total">
        <span>${t('common.total')}</span>
        <span class="total-amount">${money(this.total())}</span>
      </p>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'budget-unallocated-assets': BudgetUnallocatedAssets;
  }
}
