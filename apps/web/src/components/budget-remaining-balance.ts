import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { calculateRemainingBalances, formatAmount } from '@budget-planner/core';
import { budgetContext, type BudgetContextValue } from '../context/budget-context.ts';
import { baseStyles } from '../ui/shared-styles.ts';
import { icon } from '../ui/icons.ts';

/**
 * Read-only view of each person's remaining money (income minus personal expenses minus their
 * shared-expense share) and the household total. Derived reactively via budgetContext.
 */
@customElement('budget-remaining-balance')
export class BudgetRemainingBalance extends LitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        padding: 18px;
        background: var(--surface-2);
        border: 1px solid var(--border-soft);
        border-radius: var(--radius);
      }
      .balance-row {
        padding: 6px 0;
      }
      .balance-row .name {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .balance-row .name .icon {
        color: var(--muted);
      }
      .balance-row .amount {
        font-weight: 500;
        color: var(--text);
      }
      .household-total {
        margin-top: 10px;
      }
    `
  ];

  @consume({ context: budgetContext, subscribe: true })
  budget?: BudgetContextValue;

  override render() {
    if (!this.budget) {
      return html``;
    }

    const { people, incomeByPerson, personalExpensesByPerson, sharedExpenses } = this.budget.data;
    const balances = calculateRemainingBalances(
      people,
      incomeByPerson,
      personalExpensesByPerson,
      sharedExpenses
    );

    return html`
      ${balances.rows.map(
        (row) => html`
          <div class="balance-row">
            <span class="name">${icon('user', 16)}${row.person.name}</span>
            <span class="amount ${row.remaining < 0 ? 'negative' : ''}">${formatAmount(row.remaining)} €</span>
          </div>
        `
      )}
      <p class="household-total">
        <span>Household remaining</span>
        <span class="total-amount ${balances.householdTotal < 0 ? 'negative' : ''}">${formatAmount(balances.householdTotal)} €</span>
      </p>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'budget-remaining-balance': BudgetRemainingBalance;
  }
}
