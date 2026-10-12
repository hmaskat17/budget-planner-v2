import type { Person, ProportionalContributionRow } from '@budget-planner/core';
import { formatAmount } from '@budget-planner/core';
import { personStore } from '../person-store.ts';
import type { ScenarioBudgetElement } from './scenario-budget.ts';
import type { BudgetSharedExpense } from './budget-shared-expense.ts';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
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
`);

/**
 * Calculates proportional shared cost contributions based on each person's income share.
 * Offers options to set the settled balance directly into a person's income or personal expenses.
 */
export class BudgetProportionalContributions extends HTMLElement {
  private _onBudgetChange: () => void;
  private _unsubscribePersons?: () => void;
  private _removing = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot!.adoptedStyleSheets = [sheet];
    this._onBudgetChange = () => this.render();
  }

  connectedCallback(): void {
    this._unsubscribePersons = personStore.subscribe(() => this.render());
    document.addEventListener('income-changed', this._onBudgetChange);
    document.addEventListener('personal-expense-changed', this._onBudgetChange);
    document.addEventListener('shared-expense-changed', this._onBudgetChange);
    this.render();
  }

  disconnectedCallback(): void {
    this._unsubscribePersons?.();
    document.removeEventListener('income-changed', this._onBudgetChange);
    document.removeEventListener('personal-expense-changed', this._onBudgetChange);
    document.removeEventListener('shared-expense-changed', this._onBudgetChange);
  }

  getPersonIncome(personId: string): number {
    const incomeEl = document.querySelector<ScenarioBudgetElement>(`budget-income[person-id="${personId}"]`);
    return typeof incomeEl?.baseTotal === 'function'
      ? incomeEl.baseTotal()
      : typeof incomeEl?.total === 'function'
      ? incomeEl.total()
      : 0;
  }

  getPersonSharedExpensePaid(personId: string): number {
    const sharedExpenseEl = document.querySelector<BudgetSharedExpense>('budget-shared-expense');
    return typeof sharedExpenseEl?.personTotal === 'function' ? sharedExpenseEl.personTotal(personId) : 0;
  }

  getTotalSharedExpenses(): number {
    const sharedExpenseEl = document.querySelector<BudgetSharedExpense>('budget-shared-expense');
    return typeof sharedExpenseEl?.total === 'function' ? sharedExpenseEl.total() : 0;
  }

  /** Each person's proportional share, paid amount and balance, based on settlement-free income. */
  computeRows(): { rows: ProportionalContributionRow[]; totalIncome: number; totalSharedExpenses: number } {
    const people = personStore.getAll();
    const totalIncome = people.reduce((sum, person) => sum + this.getPersonIncome(person.id), 0);
    const totalSharedExpenses = this.getTotalSharedExpenses();

    const rows: ProportionalContributionRow[] = people.map((person: Person) => {
      const income = this.getPersonIncome(person.id);
      const percent = totalIncome > 0 ? (income / totalIncome) * 100 : people.length ? 100 / people.length : 0;
      const share = totalSharedExpenses * (percent / 100);
      const paid = this.getPersonSharedExpensePaid(person.id);
      return { person, income, percent, share, paid, balance: share - paid };
    });
    return { rows, totalIncome, totalSharedExpenses };
  }

  getBudgetElements(personId: string): {
    income: ScenarioBudgetElement | null;
    expense: ScenarioBudgetElement | null;
  } {
    return {
      income: document.querySelector<ScenarioBudgetElement>(`budget-income[person-id="${personId}"]`),
      expense: document.querySelector<ScenarioBudgetElement>(`budget-personal-expense[person-id="${personId}"]`)
    };
  }

  isApplied(): boolean {
    return personStore.getAll().some((person) => {
      const { income, expense } = this.getBudgetElements(person.id);
      return income?.hasSettlement() || expense?.hasSettlement();
    });
  }

  /** Owed amounts go to income, owing amounts to personal expenses; the household pot is unchanged. */
  applySettlements(rows: ProportionalContributionRow[]): void {
    rows.forEach(({ person, balance }) => {
      const { income, expense } = this.getBudgetElements(person.id);
      const amount = Number(Math.abs(balance).toFixed(2));
      if (balance > 0.005) {
        expense?.setSettlement(amount);
        income?.removeSettlement();
      } else if (balance < -0.005) {
        income?.setSettlement(amount);
        expense?.removeSettlement();
      } else {
        income?.removeSettlement();
        expense?.removeSettlement();
      }
    });
  }

  removeSettlements(): void {
    this._removing = true;
    try {
      personStore.getAll().forEach((person) => {
        const { income, expense } = this.getBudgetElements(person.id);
        income?.removeSettlement();
        expense?.removeSettlement();
      });
    } finally {
      this._removing = false;
    }
    this.render();
  }

  render(): void {
    const { rows, totalIncome, totalSharedExpenses } = this.computeRows();
    const applied = this.isApplied();
    // Keep applied settlements in sync when shared expenses or base incomes change.
    if (applied && !this._removing) {
      this.applySettlements(rows);
    }
    const root = this.shadowRoot!;
    root.innerHTML = '';

    // 1. Household Summary Row
    const summary = document.createElement('div');
    summary.className = 'household-summary';

    const incomeStat = document.createElement('div');
    incomeStat.className = 'summary-stat';
    incomeStat.innerHTML = `<span>Total household income:</span><strong>${formatAmount(totalIncome)} €</strong>`;
    summary.appendChild(incomeStat);

    const expensesStat = document.createElement('div');
    expensesStat.className = 'summary-stat';
    expensesStat.innerHTML = `<span>Total household expenses:</span><strong>${formatAmount(totalSharedExpenses)} €</strong>`;
    summary.appendChild(expensesStat);

    root.appendChild(summary);

    // 2. People Columns
    const columns = document.createElement('div');
    columns.className = 'people-columns';

    rows.forEach(({ person, income, percent: propContributionPercent, share: expenseShare, paid: alreadyPaid, balance }) => {
      const card = document.createElement('div');
      card.className = 'person-card';

      const title = document.createElement('h3');
      title.textContent = person.name;
      card.appendChild(title);

      // Metrics
      const mIncome = document.createElement('div');
      mIncome.className = 'metric-row';
      mIncome.innerHTML = `<span>Person's income:</span><span>${formatAmount(income)} €</span>`;
      card.appendChild(mIncome);

      const mProp = document.createElement('div');
      mProp.className = 'metric-row';
      mProp.innerHTML = `<span>Proportional contribution:</span><span>${formatAmount(propContributionPercent)} %</span>`;
      card.appendChild(mProp);

      const mShare = document.createElement('div');
      mShare.className = 'metric-row';
      mShare.innerHTML = `<span>Share of expenses:</span><span>${formatAmount(expenseShare)} €</span>`;
      card.appendChild(mShare);

      const mPaid = document.createElement('div');
      mPaid.className = 'metric-row';
      mPaid.innerHTML = `<span>Already paid expenses:</span><span>${formatAmount(alreadyPaid)} €</span>`;
      card.appendChild(mPaid);

      const mBalance = document.createElement('div');
      mBalance.className = 'metric-row highlight';
      mBalance.innerHTML = `<span>Balance to be settled:</span><span>${formatAmount(balance)} €</span>`;
      card.appendChild(mBalance);

      // Settlement status badge
      const actionSection = document.createElement('div');
      actionSection.className = 'settlement-action';

      const badge = document.createElement('span');
      if (balance > 0.005) {
        badge.className = 'status-badge owes';
        badge.textContent = `Owes ${formatAmount(balance)} €${applied ? ' (in personal expenses)' : ''}`;
      } else if (balance < -0.005) {
        badge.className = 'status-badge owed';
        badge.textContent = `Owed ${formatAmount(Math.abs(balance))} €${applied ? ' (in income)' : ''}`;
      } else {
        badge.className = 'status-badge settled';
        badge.textContent = 'Settled (0.00 €)';
      }
      actionSection.appendChild(badge);

      card.appendChild(actionSection);
      columns.appendChild(card);
    });

    root.appendChild(columns);

    const hasBalance = rows.some(({ balance }) => Math.abs(balance) > 0.005);
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'apply-btn toggle-settlement';
    toggleBtn.textContent = applied
      ? 'Remove settlement from income and personal expenses'
      : 'Add settlement to income and personal expenses';
    toggleBtn.disabled = !applied && !hasBalance;
    toggleBtn.addEventListener('click', () => {
      if (applied) {
        this.removeSettlements();
      } else {
        this.applySettlements(rows);
      }
    });
    root.appendChild(toggleBtn);
  }
}

customElements.define('budget-proportional-contributions', BudgetProportionalContributions);
