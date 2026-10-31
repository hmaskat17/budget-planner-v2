import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import type { ContributionMethod } from '@budget-planner/core';
import { calculateContributions } from '@budget-planner/core';
import { budgetContext, type BudgetContextValue } from '../context/budget-context.ts';
import { baseStyles } from '../ui/shared-styles.ts';
import { icon } from '../ui/icons.ts';
import { LocalizeController, money, percent, t } from '../i18n/index.ts';

const CONTRIBUTION_METHODS: ContributionMethod[] = [
  'equal',
  'proportional',
  'equal-leftover',
  'fully-pooled',
  'custom'
];

/**
 * Calculates household shared-expense contributions using the selected contribution method.
 */
@customElement('budget-contributions')
export class BudgetContributions extends LitElement {
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
      .method-picker {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 20px;
      }
      .method-picker label {
        font-weight: 600;
      }
      .method-picker select {
        width: min(100%, 280px);
      }
      .pooled-note {
        padding: 18px;
        color: var(--muted);
        background: var(--surface-2);
        border: 1px solid var(--border-soft);
        border-radius: var(--radius);
      }
      .custom-percent {
        width: 96px;
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

  protected readonly _localize = new LocalizeController(this);

  override render() {
    if (!this.budget) {
      return html``;
    }

    const {
      people,
      incomeByPerson,
      personalExpensesByPerson,
      sharedExpenses,
      contributionSettings
    } = this.budget.data;
    const { rows, totalIncome, totalSharedExpenses } = calculateContributions(
      people,
      incomeByPerson,
      personalExpensesByPerson,
      sharedExpenses,
      contributionSettings.method,
      contributionSettings.customPercentByPerson
    );

    const applied = this.budget.isSettlementApplied();
    const hasBalance = rows.some(({ balance }) => Math.abs(balance) > 0.005);
    return html`
      <div class="method-picker">
        <label for="contribution-method">${t('contributions.method')}</label>
        <select
          id="contribution-method"
          @change=${(event: Event) => {
            const value = (event.currentTarget as HTMLSelectElement).value;
            const method = CONTRIBUTION_METHODS.find((optionValue) => optionValue === value);
            if (method) {
              this.budget?.setContributionMethod(method);
            }
          }}
        >
          ${CONTRIBUTION_METHODS.map(
            (value) => html`
              <option value=${value} .selected=${contributionSettings.method === value}>${t(`method.${value}`)}</option>
            `
          )}
        </select>
      </div>

      <div class="household-summary">
        <div class="summary-stat">
          <span>${t('contributions.totalIncome')}</span>
          <strong>${money(totalIncome)}</strong>
        </div>
        <div class="summary-stat">
          <span>${t('contributions.totalExpenses')}</span>
          <strong>${money(totalSharedExpenses)}</strong>
        </div>
      </div>

      ${contributionSettings.method === 'fully-pooled'
        ? html`<p class="pooled-note">${t('contributions.pooledNote')}</p>`
        : html`<div class="people-columns">
        ${rows.map(
          ({ person, income, percent: propContributionPercent, share: expenseShare, paid: alreadyPaid, balance }) => {
            let badgeClass = 'status-badge settled';
            let badgeText = t('contributions.settled', { amount: money(0) });

            if (balance > 0.005) {
              badgeClass = 'status-badge owes';
              badgeText = t(applied ? 'contributions.owesApplied' : 'contributions.owes', {
                amount: money(balance)
              });
            } else if (balance < -0.005) {
              badgeClass = 'status-badge owed';
              badgeText = t(applied ? 'contributions.owedApplied' : 'contributions.owed', {
                amount: money(Math.abs(balance))
              });
            }

            return html`
              <div class="person-card">
                <h3>${icon('user', 16)}${person.name}</h3>
                <div class="metric-row">
                  <span>${t('contributions.personIncome')}</span>
                  <span>${money(income)}</span>
                </div>
                <div class="metric-row">
                  ${contributionSettings.method === 'custom'
                    ? html`<label for="custom-percent-${person.id}">
                        ${t(`contribution.label.${contributionSettings.method}`)}
                      </label>`
                    : html`<span>${t(`contribution.label.${contributionSettings.method}`)}</span>`}
                  <span>
                    ${contributionSettings.method === 'custom'
                      ? html`<input
                          id="custom-percent-${person.id}"
                          class="custom-percent"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          .value=${String(contributionSettings.customPercentByPerson[person.id] ?? 0)}
                          aria-label=${t('contributions.customPercentLabel', { name: person.name })}
                          @change=${(event: Event) =>
                            this.budget?.setCustomContributionPercent(
                              person.id,
                              (event.currentTarget as HTMLInputElement).valueAsNumber
                            )}
                        /> %`
                      : html`${percent(propContributionPercent)}`}
                  </span>
                </div>
                <div class="metric-row">
                  <span>${t('contributions.expenseShare')}</span>
                  <span>${money(expenseShare)}</span>
                </div>
                <div class="metric-row">
                  <span>${t('contributions.alreadyPaid')}</span>
                  <span>${money(alreadyPaid)}</span>
                </div>
                <div class="metric-row highlight">
                  <span>${t('contributions.balance')}</span>
                  <span>${money(balance)}</span>
                </div>
                <div class="settlement-action">
                  <span class=${badgeClass}>${badgeText}</span>
                </div>
              </div>
            `;
          }
        )}
      </div>`}

      ${contributionSettings.method !== 'fully-pooled'
        ? html`<button
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
          ? t('contributions.removeSettlement')
          : t('contributions.applySettlement')}
      </button>`
        : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'budget-contributions': BudgetContributions;
  }
}
