import { personStore } from '../person-store.js';
import { formatAmount, SETTLEMENT_ENTRY_NAME } from './scenario-budget.js';

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
    getPersonIncome(personId) {
        const incomeEl = document.querySelector(`budget-income[person-id="${personId}"]`);
        return typeof incomeEl?.baseTotal === 'function'
            ? incomeEl.baseTotal()
            : (typeof incomeEl?.total === 'function' ? incomeEl.total() : 0);
    }

    /** @param {string} personId @returns {number} */
    getPersonSharedExpensePaid(personId) {
        const sharedExpenseEl = document.querySelector('budget-shared-expense');
        return typeof sharedExpenseEl?.personTotal === 'function' ? sharedExpenseEl.personTotal(personId) : 0;
    }

    /** @returns {number} */
    getTotalSharedExpenses() {
        const sharedExpenseEl = document.querySelector('budget-shared-expense');
        return typeof sharedExpenseEl?.total === 'function' ? sharedExpenseEl.total() : 0;
    }

    render() {
        const people = personStore.getAll();
        const root = this.shadowRoot;
        root.innerHTML = '';

        const totalIncome = people.reduce((sum, person) => sum + this.getPersonIncome(person.id), 0);
        const totalSharedExpenses = this.getTotalSharedExpenses();

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

        people.forEach((person) => {
            const income = this.getPersonIncome(person.id);
            const propContributionPercent = totalIncome > 0 ? (income / totalIncome) * 100 : (people.length ? 100 / people.length : 0);
            const expenseShare = totalSharedExpenses * (propContributionPercent / 100);
            const alreadyPaid = this.getPersonSharedExpensePaid(person.id);
            const balance = expenseShare - alreadyPaid;

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

            // Settlement Action Section
            const actionSection = document.createElement('div');
            actionSection.className = 'settlement-action';

            if (balance > 0.005) {
                const badge = document.createElement('span');
                badge.className = 'status-badge owes';
                badge.textContent = `Owes ${formatAmount(balance)} €`;
                actionSection.appendChild(badge);

                const applyBtn = document.createElement('button');
                applyBtn.type = 'button';
                applyBtn.className = 'apply-btn';
                applyBtn.textContent = `+ Add ${formatAmount(balance)} € to Personal Expenses`;
                applyBtn.addEventListener('click', () => {
                    const pe = document.querySelector(`budget-personal-expense[person-id="${person.id}"]`);
                    if (pe && typeof pe.addOrUpdateEntry === 'function') {
                        pe.addOrUpdateEntry(SETTLEMENT_ENTRY_NAME, Number(formatAmount(balance)), true);
                    }
                    const inc = document.querySelector(`budget-income[person-id="${person.id}"]`);
                    if (inc && typeof inc.removeEntryByName === 'function') {
                        inc.removeEntryByName(SETTLEMENT_ENTRY_NAME);
                    }
                });
                actionSection.appendChild(applyBtn);
            } else if (balance < -0.005) {
                const refundAmount = Math.abs(balance);
                const badge = document.createElement('span');
                badge.className = 'status-badge owed';
                badge.textContent = `Owed ${formatAmount(refundAmount)} €`;
                actionSection.appendChild(badge);

                const applyBtn = document.createElement('button');
                applyBtn.type = 'button';
                applyBtn.className = 'apply-btn';
                applyBtn.textContent = `+ Add ${formatAmount(refundAmount)} € to Income`;
                applyBtn.addEventListener('click', () => {
                    const inc = document.querySelector(`budget-income[person-id="${person.id}"]`);
                    if (inc && typeof inc.addOrUpdateEntry === 'function') {
                        inc.addOrUpdateEntry(SETTLEMENT_ENTRY_NAME, Number(formatAmount(refundAmount)), true);
                    }
                    const pe = document.querySelector(`budget-personal-expense[person-id="${person.id}"]`);
                    if (pe && typeof pe.removeEntryByName === 'function') {
                        pe.removeEntryByName(SETTLEMENT_ENTRY_NAME);
                    }
                });
                actionSection.appendChild(applyBtn);
            } else {
                const badge = document.createElement('span');
                badge.className = 'status-badge settled';
                badge.textContent = 'Settled (0.00 €)';
                actionSection.appendChild(badge);
            }

            card.appendChild(actionSection);
            columns.appendChild(card);
        });

        root.appendChild(columns);
    }
}

customElements.define('budget-proportional-contributions', BudgetProportionalContributions);
