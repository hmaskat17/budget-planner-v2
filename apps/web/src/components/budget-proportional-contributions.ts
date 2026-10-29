import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { calculateProportionalContributions, formatAmount } from '@budget-planner/core';
import { budgetContext, type BudgetContextValue } from '../context/budget-context.ts';
import { baseStyles } from '../ui/shared-styles.ts';
import { icon } from '../ui/icons.ts';

/**
 * Calculates proportional shared cost contributions based on each person's income share.
 * Offers options to set the settled balance directly into a person's income or personal expenses.
 */
@customElement('budget-proportional-contributions')
export class BudgetProportionalContributions extends LitElement {
  static override styles = [
    baseStyles,
    css`
      .household-summary {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 24px;
        margin-bottom: 20px;
        padding: 14px 18px;
        background: color-mix(in srgb, var(--accent) 6%, var(--surface));
        border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--border));
        border-radius: var(--radius);
      }
      .summary-stat {
        flex: 1 1 200px;
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 0.9rem;
        color: var(--muted);
      }
      .summary-stat strong {
        color: var(--text);
        font-variant-numeric: tabular-nums;
      }
      .people-columns {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 20px;
      }
      .person-card {
        padding: 18px;
        background: var(--surface-2);
        border: 1px solid var(--border-soft);
        border-radius: var(--radius);
      }
      .metric-row {
        margin-bottom: 6px;
      }
      .metric-row.highlight {
        margin-bottom: 0;
      }
      .settlement-action {
        margin-top: 14px;
      }
      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        width: fit-content;
        padding: 4px 10px;
        font-size: 0.8125rem;
        font-weight: 600;
        border-radius: 999px;
      }
      .status-badge.owes {
        background: var(--negative-bg);
        color: var(--negative);
      }
      .status-badge.owed {
        background: var(--positive-bg);
        color: var(--positive);
      }
      .status-badge.settled {
        background: var(--border-soft);
        color: var(--muted);
      }
      .apply-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 20px;
        padding: 8px 14px;
        font-size: 0.875rem;
        font-weight: 500;
        color: #fff;
        background: var(--accent);
        border: 1px solid var(--accent);
        border-radius: var(--radius-sm);
      }
      .apply-btn:hover:not(:disabled) {
        filter: brightness(1.08);
      }
      .apply-btn.applied {
        color: var(--accent);
        background: transparent;
      }
      .apply-btn.applied:hover:not(:disabled) {
        filter: none;
        background: color-mix(in srgb, var(--accent) 8%, transparent);
      }
    `
  ];

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
          <span>Total household income</span>
          <strong>${formatAmount(totalIncome)} €</strong>
        </div>
        <div class="summary-stat">
          <span>Total household expenses</span>
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
                <h3>${icon('user', 16)}${person.name}</h3>
                <div class="metric-row">
                  <span>Person's income</span>
                  <span>${formatAmount(income)} €</span>
                </div>
                <div class="metric-row">
                  <span>Proportional contribution</span>
                  <span>${formatAmount(propContributionPercent)} %</span>
                </div>
                <div class="metric-row">
                  <span>Share of expenses</span>
                  <span>${formatAmount(expenseShare)} €</span>
                </div>
                <div class="metric-row">
                  <span>Already paid expenses</span>
                  <span>${formatAmount(alreadyPaid)} €</span>
                </div>
                <div class="metric-row highlight">
                  <span>Balance to be settled</span>
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
        class="apply-btn toggle-settlement ${applied ? 'applied' : ''}"
        ?disabled=${!applied && !hasBalance}
        @click=${() => {
          if (applied) {
            this.budget?.removeSettlements();
          } else {
            this.budget?.applySettlements();
          }
        }}
      >
        ${applied ? icon('x', 16) : icon('arrowsLeftRight', 16)}${applied
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
