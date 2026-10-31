import { LitElement, html, css, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { calculateBudgetSummary } from '@budget-planner/core';
import { budgetContext, type BudgetContextValue } from '../context/budget-context.ts';
import { baseStyles } from '../ui/shared-styles.ts';
import { LocalizeController, money, percent, t } from '../i18n/index.ts';

type Operator = '+' | '−' | '';

/**
 * Compact vertical "calculation" ledger of the key household figures.
 * Uses settlement-free totals, so applying settlements never changes it.
 */
@customElement('budget-summary')
export class BudgetSummary extends LitElement {
  static override styles = [
    baseStyles,
    css`
      .ledgers {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
      }
      .ledger {
        display: flex;
        flex-direction: column;
        padding: 16px 18px;
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        font-variant-numeric: tabular-nums;
      }
      .ledger h3 {
        margin-bottom: 8px;
      }
      .ledger h3 a {
        color: inherit;
        text-decoration: none;
        border-bottom: 1px dashed var(--muted);
      }
      .ledger h3 a:hover,
      .ledger h3 a:focus-visible {
        color: var(--primary);
        border-bottom-color: var(--primary);
      }
      .ledger.highlight {
        border: 2px solid var(--positive);
      }
      .ledger.highlight.negative {
        border-color: var(--negative);
      }
      .line {
        display: grid;
        grid-template-columns: 1.1em 1fr auto;
        gap: 6px;
        padding: 3px 0;
        font-size: 0.9rem;
        color: var(--text-2);
      }
      .op {
        color: var(--muted);
        text-align: center;
      }
      .value {
        text-align: right;
      }
      .line.muted {
        color: var(--muted);
        font-size: 0.82rem;
      }
      .line.result {
        margin-top: 6px;
        padding-top: 8px;
        border-top: 1px solid var(--text-2);
        color: var(--text);
        font-weight: 600;
      }
      .line.result strong {
        font-size: 1.05rem;
      }
      .line.result.negative strong {
        color: var(--negative);
      }
      .line.result.positive strong {
        color: var(--positive);
      }
      .line.gap {
        margin-top: 10px;
      }
      .pooled-note {
        margin: 0;
        font-size: 0.85rem;
        color: var(--muted);
      }
    `
  ];

  @consume({ context: budgetContext, subscribe: true })
  budget?: BudgetContextValue;

  protected readonly _localize = new LocalizeController(this);

  private _heading(label: string, sectionId: string) {
    return html`
      <h3>
        <a
          href="#${sectionId}"
          title=${t('summary.goTo', { section: label })}
          @click=${(e: Event) => {
            e.preventDefault();
            this.dispatchEvent(
              new CustomEvent('navigate-section', { detail: sectionId, bubbles: true, composed: true })
            );
          }}
          >${label}</a
        >
      </h3>
    `;
  }

  private _amount(value: number): string {
    return money(value);
  }

  private _line(label: string, value: number, op: Operator = '', extraClass = '') {
    return html`
      <div class="line ${extraClass}">
        <span class="op">${op}</span>
        <span class="label">${label}</span>
        <span class="value">${this._amount(value)}</span>
      </div>
    `;
  }

  private _result(label: string, value: number, id: string, tone = '') {
    return html`
      <div class="line result ${tone}">
        <span class="op">=</span>
        <span class="label">${label}</span>
        <span class="value"><strong id=${id}>${this._amount(value)}</strong></span>
      </div>
    `;
  }

  override render() {
    if (!this.budget) {
      return html``;
    }
    const s = calculateBudgetSummary(this.budget.data);
    const afterTone = s.remainingAfterSavings < 0 ? 'negative' : 'positive';
    const beforeTone = s.remainingBeforeSavings < 0 ? 'negative' : '';

    return html`
      <div class="ledgers">
        <div class="ledger" id="summary-income">
          ${this._heading(t('summary.totalIncome'), 'income-section')}
          ${s.people.map((row, i) => this._line(row.person.name, row.income, i === 0 ? '' : '+'))}
          ${this._result(t('summary.householdIncome'), s.totalIncome, 'summary-income-total')}
          ${this._line(t('summary.assets'), s.assets, '+', 'gap')}
          ${this._result(t('summary.netWorth'), s.netWorth, 'summary-networth-total')}
        </div>

        <div class="ledger" id="summary-expenses">
          ${this._heading(t('summary.totalExpenses'), 'personal-expense-section')}
          ${s.people.map((row, i) =>
            this._line(t('summary.personal', { name: row.person.name }), row.personalExpenses, i === 0 ? '' : '+')
          )}
          ${this._line(t('summary.sharedExpenses'), s.sharedExpenses, '+')}
          ${this._result(t('summary.totalExpenses'), s.totalExpenses, 'summary-expenses-total')}
        </div>

        <div class="ledger" id="summary-savings">
          ${this._heading(t('summary.totalSavings'), 'savings-section')}
          <p class="hint">${t('summary.allocatedOnly')}</p>
          ${s.people.map((row, i) =>
            this._line(t('summary.personSavings', { name: row.person.name }), row.savingsAllocated, i === 0 ? '' : '+')
          )}
          ${this._line(t('summary.sharedSavings'), s.sharedSavingsAllocated, '+')}
          ${this._result(t('summary.totalSavings'), s.totalSavingsAllocated, 'summary-savings-total')}
          <div class="line muted gap">
            <span class="op"></span>
            <span class="label">${t('summary.unallocated')}</span>
            <span class="value" id="summary-savings-unallocated">${this._amount(s.totalSavingsUnallocated)}</span>
          </div>
        </div>

        <div class="ledger" id="summary-contribution">
          ${this._heading(t('summary.contribution'), 'proportional-contributions-section')}
          <p class="hint">
            ${t('summary.method')} <span id="summary-contribution-method">${t(`method.${s.contributionMethod}`)}</span>
          </p>
          ${s.contributions.length
            ? s.contributions.map(
                (row) => html`
                  <div class="line" data-person-id=${row.person.id}>
                    <span class="op"></span>
                    <span class="label">${row.person.name} (${percent(row.percent)})</span>
                    <span class="value">${this._amount(row.share)}</span>
                  </div>
                `
              )
            : html`<p class="pooled-note">${t('summary.pooledNote')}</p>`}
        </div>

        <div class="ledger highlight ${afterTone}" id="summary-remaining">
          ${this._heading(t('summary.netRemaining'), 'remaining-balance-section')}
          ${this._line(t('summary.householdIncome'), s.totalIncome)}
          ${this._line(t('summary.totalExpenses'), s.totalExpenses, '−')}
          ${this._result(t('summary.beforeSavings'), s.remainingBeforeSavings, 'summary-remaining-before', beforeTone)}
          ${this._line(t('summary.totalSavings'), s.totalSavingsAllocated, '−', 'gap')}
          ${this._result(t('summary.afterSavings'), s.remainingAfterSavings, 'summary-remaining-after', afterTone)}
          ${s.remainingAfterSavings < 0 ? html`<p class="hint" id="summary-shortfall">${t('summary.shortfall')}</p>` : nothing}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'budget-summary': BudgetSummary;
  }
}
