import { calculateRemainingBalance, formatAmount } from '@budget-planner/core';
import { personStore } from '../person-store.ts';
import type { ScenarioBudgetElement } from './scenario-budget.ts';
import type { BudgetSharedExpense } from './budget-shared-expense.ts';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
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
`);

/**
 * Read-only view of each person's remaining money (income minus personal expenses minus their
 * shared-expense share) and the household total. Holds no data of its own; everything is derived
 * live from the income/personal-expense/shared-expense components already mounted in the page.
 */
export class BudgetRemainingBalance extends HTMLElement {
  private _onBudgetChange: () => void;
  private _unsubscribePersons?: () => void;

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

  remainingFor(personId: string): number {
    const income = document.querySelector<ScenarioBudgetElement>(`budget-income[person-id="${personId}"]`);
    const personalExpense = document.querySelector<ScenarioBudgetElement>(`budget-personal-expense[person-id="${personId}"]`);
    const sharedExpense = document.querySelector<BudgetSharedExpense>('budget-shared-expense');

    return calculateRemainingBalance(
      personId,
      income?.getActiveScenario(),
      personalExpense?.getActiveScenario(),
      sharedExpense?.getActiveScenario()
    );
  }

  render(): void {
    const people = personStore.getAll();
    const root = this.shadowRoot!;
    root.innerHTML = '';

    let householdTotal = 0;
    people.forEach((person) => {
      const remaining = this.remainingFor(person.id);
      householdTotal += remaining;

      const row = document.createElement('div');
      row.className = 'balance-row';

      const label = document.createElement('span');
      label.textContent = `${person.name}:`;

      const amount = document.createElement('span');
      amount.textContent = formatAmount(remaining);

      row.appendChild(label);
      row.appendChild(amount);
      root.appendChild(row);
    });

    const total = document.createElement('p');
    total.className = 'household-total';
    total.textContent = `Household remaining: ${formatAmount(householdTotal)}`;
    root.appendChild(total);
  }
}

customElements.define('budget-remaining-balance', BudgetRemainingBalance);
