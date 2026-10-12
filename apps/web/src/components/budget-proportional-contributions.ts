import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { calculateProportionalContributions, formatAmount } from '@budget-planner/core';
import { budgetContext, type BudgetContextValue } from '../context/budget-context.ts';

/**
 * Calculates proportional shared cost contributions based on each person's income share.
 * Offers options to set the settled balance directly into a person's income or personal expenses.
 */
@customElement('budget-proportional-contributions')
export class BudgetProportionalContributions extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
    .household-summary {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
    }
    .summary-stat {
      flex: 1 1 200px;
      display: flex;
      justify-content: space-between;
      font-size: 0.95em;
    }
    .summary-stat strong {
      color: #1e293b;
    }
    .people-columns {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    .person-card {
      flex: 1 1 260px;
      min-width: 260px;
      background: #fafafa;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 14px;
      box-sizing: border-box;
    }
    .person-card h3 {
      margin: 0 0 10px 0;
      font-size: 1.1em;
    }
    .metric-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 0.9em;
    }
    .metric-row.highlight {
      font-weight: bold;
      border-top: 1px dashed #ccc;
      padding-top: 6px;
      margin-top: 6px;
    }
    .settlement-action {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .status-badge {
      font-size: 0.85em;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      display: inline-block;
      width: fit-content;
    }
    .status-badge.owes {
      background: #fee2e2;
      color: #991b1b;
    }
    .status-badge.owed {
      background: #dcfce7;
      color: #166534;
    }
    .status-badge.settled {
      background: #f1f5f9;
      color: #475569;
    }
    .apply-btn {
      margin-top: 12px;
      font-size: 0.85em;
      padding: 5px 10px;
      cursor: pointer;
      background: #fff;
      border: 1px solid #94a3b8;
      border-radius: 4px;
      text-align: left;
      color: #334155;
    }
    .apply-btn:hover {
      background: #f8fafc;
      border-color: #64748b;
    }
  `;

  @consume({ context: budgetContext, subscribe: true })
  budget?: BudgetContextValue;

  override render() {
    if (!this.budget) {
      return html``;
    }

    const { people, incomeByPerson, sharedExpenses } = this.budget.data;
    const { rows, totalIncome, totalSharedExpenses } = calculateProportionalContributions(
      people,
      incomeByPerson,
      sharedExpenses
    );

    const applied = this.budget.isSettlementApplied();
    const hasBalance = rows.some(({ balance }) => Math.abs(balance) > 0.005);

    return html`
      <div class="household-summary">
        <div class="summary-stat">
          <span>Total household income:</span>
          <strong>${formatAmount(totalIncome)} €</strong>
        </div>
        <div class="summary-stat">
          <span>Total household expenses:</span>
          <strong>${formatAmount(totalSharedExpenses)} €</strong>
        </div>
      </div>

      <div class="people-columns">
        ${rows.map(
          ({ person, income, percent: propContributionPercent, share: expenseShare, paid: alreadyPaid, balance }) => {
            let badgeClass = 'status-badge settled';
            let badgeText = 'Settled (0.00 €)';

            if (balance > 0.005) {
              badgeClass = 'status-badge owes';
              badgeText = `Owes ${formatAmount(balance)} €${applied ? ' (in personal expenses)' : ''}`;
            } else if (balance < -0.005) {
              badgeClass = 'status-badge owed';
              badgeText = `Owed ${formatAmount(Math.abs(balance))} €${applied ? ' (in income)' : ''}`;
            }

            return html`
              <div class="person-card">
                <h3>${person.name}</h3>
                <div class="metric-row">
                  <span>Person's income:</span>
                  <span>${formatAmount(income)} €</span>
                </div>
                <div class="metric-row">
                  <span>Proportional contribution:</span>
                  <span>${formatAmount(propContributionPercent)} %</span>
                </div>
                <div class="metric-row">
                  <span>Share of expenses:</span>
                  <span>${formatAmount(expenseShare)} €</span>
                </div>
                <div class="metric-row">
                  <span>Already paid expenses:</span>
                  <span>${formatAmount(alreadyPaid)} €</span>
                </div>
                <div class="metric-row highlight">
                  <span>Balance to be settled:</span>
                  <span>${formatAmount(balance)} €</span>
                </div>
                <div class="settlement-action">
                  <span class=${badgeClass}>${badgeText}</span>
                </div>
              </div>
            `;
          }
        )}
      </div>

      <button
        type="button"
        class="apply-btn toggle-settlement"
        ?disabled=${!applied && !hasBalance}
        @click=${() => {
          if (applied) {
            this.budget?.removeSettlements();
          } else {
            this.budget?.applySettlements();
          }
        }}
      >
        ${applied
          ? 'Remove settlement from income and personal expenses'
          : 'Add settlement to income and personal expenses'}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'budget-proportional-contributions': BudgetProportionalContributions;
  }
}
