import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { calculateRemainingBalances, formatAmount } from '@budget-planner/core';
import { budgetContext, type BudgetContextValue } from '../context/budget-context.ts';

/**
 * Read-only view of each person's remaining money (income minus personal expenses minus their
 * shared-expense share) and the household total. Derived reactively via budgetContext.
 */
@customElement('budget-remaining-balance')
export class BudgetRemainingBalance extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
    .balance-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .household-total {
      font-weight: bold;
      border-top: 1px solid #ddd;
      padding-top: 10px;
      margin-top: 10px;
    }
  `;

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
            <span>${row.person.name}:</span>
            <span>${formatAmount(row.remaining)}</span>
          </div>
        `
      )}
      <p class="household-total">Household remaining: ${formatAmount(balances.householdTotal)}</p>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'budget-remaining-balance': BudgetRemainingBalance;
  }
}
