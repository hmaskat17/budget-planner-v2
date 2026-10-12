import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import type { Entry } from '@budget-planner/core';
import { entriesTotal, formatAmount } from '@budget-planner/core';
import { scenarioStyles } from './scenario-budget.ts';
import { budgetContext, type BudgetContextValue } from '../context/budget-context.ts';

/**
 * Per-person list of money and assets held elsewhere (other accounts, gold, cash).
 * Purely informational: no other component reads these totals, and it uses no scenarios.
 */
@customElement('budget-unallocated-assets')
export class BudgetUnallocatedAssets extends LitElement {
  static override styles = scenarioStyles;

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
      <h3 class="person-name">${person?.name ?? 'Person'}</h3>

      <div class="entry-inputs">
        ${entries.map(
          (entry, index) => html`
            <div class="entry-row">
              <input
                type="text"
                placeholder="Asset (e.g. cash, gold)"
                .value=${entry.name}
                @input=${(e: Event) =>
                  this.updateEntryName(index, (e.target as HTMLInputElement).value)}
              />
              <input
                type="number"
                placeholder="Amount"
                .value=${String(entry.amount)}
                @input=${(e: Event) =>
                  this.updateEntryAmount(index, (e.target as HTMLInputElement).value)}
              />
              <button
                type="button"
                class="remove-entry-input"
                @click=${() => this.removeEntry(index)}
              >
                Remove
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
        Add new asset
      </button>

      <p class="person-total">
        Total: <span class="total-amount">${formatAmount(this.total())}</span>
      </p>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'budget-unallocated-assets': BudgetUnallocatedAssets;
  }
}
