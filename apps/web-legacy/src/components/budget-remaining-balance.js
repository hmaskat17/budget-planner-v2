import { personStore } from '../person-store.js';

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
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.adoptedStyleSheets = [sheet];
        this._onBudgetChange = () => this.render();
    }

    connectedCallback() {
        this._unsubscribePersons = personStore.subscribe(() => this.render());
        document.addEventListener('income-changed', this._onBudgetChange);
        document.addEventListener('personal-expense-changed', this._onBudgetChange);
        document.addEventListener('shared-expense-changed', this._onBudgetChange);
        this.render();
    }

    disconnectedCallback() {
        this._unsubscribePersons?.();
        document.removeEventListener('income-changed', this._onBudgetChange);
        document.removeEventListener('personal-expense-changed', this._onBudgetChange);
        document.removeEventListener('shared-expense-changed', this._onBudgetChange);
    }

    /** @param {string} personId @returns {number} */
    remainingFor(personId) {
        const income = document.querySelector(`budget-income[person-id="${personId}"]`);
        const personalExpense = document.querySelector(`budget-personal-expense[person-id="${personId}"]`);
        const sharedExpense = document.querySelector('budget-shared-expense');

        const incomeTotal = typeof income?.total === 'function' ? income.total() : 0;
        const personalExpenseTotal = typeof personalExpense?.total === 'function' ? personalExpense.total() : 0;
        const sharedExpenseShare = typeof sharedExpense?.personTotal === 'function' ? sharedExpense.personTotal(personId) : 0;

        return incomeTotal - personalExpenseTotal - sharedExpenseShare;
    }

    render() {
        const people = personStore.getAll();
        const root = this.shadowRoot;
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

function formatAmount(amount) {
    return amount.toFixed(2);
}
