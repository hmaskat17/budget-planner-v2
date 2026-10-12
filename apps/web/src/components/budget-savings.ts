import type { Person, PersonSavingsData, SavingsItem, SharedSavingsData } from '@budget-planner/core';
import {
  calculateRemainingBalance,
  calculateSavingsAllocation,
  calculateSavingsPool,
  createId,
  formatAmount
} from '@budget-planner/core';
import { personStore } from '../person-store.ts';
import type { ScenarioBudgetElement } from './scenario-budget.ts';
import type { BudgetSharedExpense } from './budget-shared-expense.ts';

const PERSONAL_STORAGE_KEY = 'budget-planner-personal-savings';
const SHARED_STORAGE_KEY = 'budget-planner-shared-savings';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
    :host {
        display: block;
    }
    .savings-container {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }
    .personal-savings-columns {
        display: flex;
        gap: 20px;
        flex-wrap: wrap;
    }
    .savings-card {
        flex: 1 1 260px;
        min-width: 260px;
        background: #fafafa;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        padding: 14px;
        box-sizing: border-box;
    }
    .savings-card h3 {
        margin: 0 0 10px 0;
        font-size: 1.1em;
    }
    .stat-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 0.95em;
    }
    .stat-row.subtle {
        color: #555;
    }
    .stat-row.highlight {
        font-weight: bold;
        border-top: 1px dashed #ccc;
        padding-top: 6px;
        margin-top: 6px;
    }
    .contribution-section {
        background: #f0f4f8;
        border: 1px solid #d4e2ee;
        border-radius: 4px;
        padding: 8px 10px;
        margin: 10px 0;
    }
    .contribution-label {
        font-size: 0.9em;
        margin-bottom: 6px;
        font-weight: 500;
    }
    .contribution-inputs {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .contribution-inputs input[type="number"] {
        width: 60px;
        padding: 3px 6px;
    }
    .contribution-amount {
        font-size: 0.9em;
        color: #2c5282;
        font-weight: bold;
    }
    .items-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin: 12px 0;
    }
    .savings-item-row {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .savings-item-row input[type="text"] {
        flex: 2;
        min-width: 0;
        padding: 4px 6px;
    }
    .savings-item-row input[type="number"] {
        width: 50px;
        padding: 4px 6px;
    }
    .savings-item-amount {
        flex: 1;
        min-width: 55px;
        text-align: right;
        font-size: 0.9em;
        color: #333;
    }
    .remove-item-btn {
        border: none;
        background: transparent;
        color: #777;
        cursor: pointer;
        padding: 0 4px;
        font-size: 1.1em;
        line-height: 1;
    }
    .remove-item-btn:hover {
        color: #d00;
    }
    .add-item-btn {
        display: inline-block;
        margin-bottom: 10px;
        font-size: 0.9em;
        padding: 4px 10px;
    }
    .allocation-summary {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        padding: 8px 10px;
        font-size: 0.9em;
        margin-top: 8px;
    }
    .summary-bar {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
    }
    .allocation-warning {
        color: #c53030;
        font-weight: bold;
        margin-top: 4px;
        font-size: 0.85em;
    }
    .shared-savings-card {
        background: #fbfbfb;
        border: 1px solid #cbd5e0;
        border-radius: 6px;
        padding: 14px;
        box-sizing: border-box;
    }
    .shared-savings-card h3 {
        margin: 0 0 10px 0;
        font-size: 1.1em;
    }
`);

/**
 * Unified Savings Component holding:
 * 1. Personal savings goals & shared contribution % per person.
 * 2. Shared household savings goals based on pooled contributions.
 */
export class BudgetSavings extends HTMLElement {
  personalData: Record<string, PersonSavingsData>;
  sharedData: SharedSavingsData;
  private _onBudgetChange: () => void;
  private _unsubscribePersons?: () => void;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot!.adoptedStyleSheets = [sheet];
    this.personalData = loadPersonalData();
    this.sharedData = loadSharedData();
    this._onBudgetChange = () => this.updateAmountsOnly();
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

  getRemainingFor(personId: string): number {
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

  ensurePersonData(personId: string): PersonSavingsData {
    if (!this.personalData[personId]) {
      this.personalData[personId] = {
        sharedContributionPercent: 0,
        items: []
      };
    }
    return this.personalData[personId];
  }

  /** Total pooled shared savings across all persons */
  getSharedSavingsPool(): number {
    const people = personStore.getAll();
    return people.reduce((sum, person) => {
      const remaining = this.getRemainingFor(person.id);
      const pData = this.ensurePersonData(person.id);
      const { contribution } = calculateSavingsPool(remaining, pData.sharedContributionPercent || 0);
      return sum + contribution;
    }, 0);
  }

  persist(): void {
    localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(this.personalData));
    localStorage.setItem(SHARED_STORAGE_KEY, JSON.stringify(this.sharedData));
    this.dispatchEvent(new CustomEvent('savings-changed', { bubbles: true, composed: true }));
  }

  render(): void {
    const root = this.shadowRoot!;
    root.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'savings-container';

    // 1. Personal Savings Columns
    const columns = document.createElement('div');
    columns.className = 'personal-savings-columns';

    const people = personStore.getAll();
    people.forEach((person) => {
      columns.appendChild(this.renderPersonSavingsCard(person));
    });
    container.appendChild(columns);

    // 2. Shared Household Savings Card
    container.appendChild(this.renderSharedSavingsCard());

    root.appendChild(container);
  }

  renderPersonSavingsCard(person: Person): HTMLElement {
    const card = document.createElement('div');
    card.className = 'savings-card';
    card.dataset.personId = person.id;

    const heading = document.createElement('h3');
    heading.textContent = `${person.name}'s Savings`;
    card.appendChild(heading);

    const personData = this.ensurePersonData(person.id);
    const remaining = this.getRemainingFor(person.id);
    const { contribution: contribVal, personalPool } = calculateSavingsPool(
      remaining,
      personData.sharedContributionPercent || 0
    );

    // Remaining balance stat
    const remRow = document.createElement('div');
    remRow.className = 'stat-row';
    remRow.innerHTML = `<span>Remaining money:</span><span class="person-remaining-val">${formatAmount(remaining)} €</span>`;
    card.appendChild(remRow);

    // Shared Contribution Box
    const contribBox = document.createElement('div');
    contribBox.className = 'contribution-section';

    const contribTitle = document.createElement('div');
    contribTitle.className = 'contribution-label';
    contribTitle.textContent = 'Contribution to Shared Savings:';
    contribBox.appendChild(contribTitle);

    const contribInputs = document.createElement('div');
    contribInputs.className = 'contribution-inputs';

    const percentInput = document.createElement('input');
    percentInput.type = 'number';
    percentInput.min = '0';
    percentInput.max = '100';
    percentInput.step = 'any';
    percentInput.value = String(personData.sharedContributionPercent ?? 0);
    percentInput.addEventListener('input', () => {
      personData.sharedContributionPercent = Number(percentInput.value) || 0;
      this.persist();
      this.updateAmountsOnly();
    });

    const percentSymbol = document.createElement('span');
    percentSymbol.textContent = '% =';

    const contribAmountBadge = document.createElement('span');
    contribAmountBadge.className = 'contribution-amount person-contrib-amount';
    contribAmountBadge.textContent = `${formatAmount(contribVal)} €`;

    contribInputs.appendChild(percentInput);
    contribInputs.appendChild(percentSymbol);
    contribInputs.appendChild(contribAmountBadge);
    contribBox.appendChild(contribInputs);
    card.appendChild(contribBox);

    // Personal Savings Pool after shared contribution
    const poolRow = document.createElement('div');
    poolRow.className = 'stat-row subtle';
    poolRow.innerHTML = `<span>Personal savings pool:</span><span class="person-pool-val">${formatAmount(personalPool)} €</span>`;
    card.appendChild(poolRow);

    // Personal Items List
    const itemsList = document.createElement('div');
    itemsList.className = 'items-list personal-items-list';

    personData.items.forEach((item, index) => {
      itemsList.appendChild(
        this.renderSavingsItemRow(
          item,
          personalPool,
          () => {
            personData.items.splice(index, 1);
            this.persist();
            this.render();
          },
          () => {
            this.persist();
            this.updateAmountsOnly();
          }
        )
      );
    });
    card.appendChild(itemsList);

    // Add Button
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'add-item-btn';
    addBtn.textContent = '+ Add personal goal';
    addBtn.addEventListener('click', () => {
      personData.items.push({ id: createId('savings'), name: '', percent: 0 });
      this.persist();
      this.render();
    });
    card.appendChild(addBtn);

    // Summary Bar
    const summary = document.createElement('div');
    summary.className = 'allocation-summary person-summary';
    this.updatePersonSummaryContent(summary, personData, personalPool);
    card.appendChild(summary);

    return card;
  }

  renderSharedSavingsCard(): HTMLElement {
    const card = document.createElement('div');
    card.className = 'shared-savings-card';

    const heading = document.createElement('h3');
    heading.textContent = 'Shared Household Savings';
    card.appendChild(heading);

    const sharedPool = this.getSharedSavingsPool();

    const poolRow = document.createElement('div');
    poolRow.className = 'stat-row highlight';
    poolRow.innerHTML = `<span>Total pooled shared savings:</span><span class="shared-pool-val">${formatAmount(sharedPool)} €</span>`;
    card.appendChild(poolRow);

    // Shared Items List
    const itemsList = document.createElement('div');
    itemsList.className = 'items-list shared-items-list';

    this.sharedData.items.forEach((item, index) => {
      itemsList.appendChild(
        this.renderSavingsItemRow(
          item,
          sharedPool,
          () => {
            this.sharedData.items.splice(index, 1);
            this.persist();
            this.render();
          },
          () => {
            this.persist();
            this.updateAmountsOnly();
          }
        )
      );
    });
    card.appendChild(itemsList);

    // Add Button
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'add-item-btn';
    addBtn.textContent = '+ Add shared goal';
    addBtn.addEventListener('click', () => {
      this.sharedData.items.push({ id: createId('savings'), name: '', percent: 0 });
      this.persist();
      this.render();
    });
    card.appendChild(addBtn);

    // Summary Bar
    const summary = document.createElement('div');
    summary.className = 'allocation-summary shared-summary';
    this.updateSharedSummaryContent(summary, sharedPool);
    card.appendChild(summary);

    return card;
  }

  renderSavingsItemRow(
    item: SavingsItem,
    poolAmount: number,
    onRemove: () => void,
    onChange: () => void
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'savings-item-row';
    row.dataset.itemId = item.id;

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Goal name';
    nameInput.value = item.name;
    nameInput.addEventListener('input', () => {
      item.name = nameInput.value;
      onChange();
    });

    const percentInput = document.createElement('input');
    percentInput.type = 'number';
    percentInput.placeholder = '%';
    percentInput.min = '0';
    percentInput.max = '100';
    percentInput.step = 'any';
    percentInput.value = item.percent !== undefined ? String(item.percent) : '';
    percentInput.addEventListener('input', () => {
      item.percent = Number(percentInput.value) || 0;
      onChange();
    });

    const percentSymbol = document.createElement('span');
    percentSymbol.textContent = '%';

    const amountSpan = document.createElement('span');
    amountSpan.className = 'savings-item-amount item-calc-amount';
    const itemVal = (poolAmount > 0 ? poolAmount : 0) * ((item.percent || 0) / 100);
    amountSpan.textContent = `${formatAmount(itemVal)} €`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-item-btn';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove goal';
    removeBtn.addEventListener('click', onRemove);

    row.appendChild(nameInput);
    row.appendChild(percentInput);
    row.appendChild(percentSymbol);
    row.appendChild(amountSpan);
    row.appendChild(removeBtn);

    return row;
  }

  updatePersonSummaryContent(summary: HTMLElement, personData: PersonSavingsData, personalPool: number): void {
    const alloc = calculateSavingsAllocation(personalPool, personData.items);

    summary.innerHTML = `
        <div class="summary-bar">
            <span>Allocated: <strong>${formatAmount(alloc.allocatedPercent)}%</strong></span>
            <span>Unallocated: <strong>${formatAmount(alloc.unallocatedPercent)}%</strong> (${formatAmount(alloc.unallocatedAmount)} €)</span>
        </div>
        ${alloc.isOverallocated ? `<div class="allocation-warning">Total allocated percentage exceeds 100% (${formatAmount(alloc.allocatedPercent)}%)</div>` : ''}
    `;
  }

  updateSharedSummaryContent(summary: HTMLElement, sharedPool: number): void {
    const alloc = calculateSavingsAllocation(sharedPool, this.sharedData.items);

    summary.innerHTML = `
        <div class="summary-bar">
            <span>Allocated: <strong>${formatAmount(alloc.allocatedPercent)}%</strong></span>
            <span>Unallocated: <strong>${formatAmount(alloc.unallocatedPercent)}%</strong> (${formatAmount(alloc.unallocatedAmount)} €)</span>
        </div>
        ${alloc.isOverallocated ? `<div class="allocation-warning">Total allocated percentage exceeds 100% (${formatAmount(alloc.allocatedPercent)}%)</div>` : ''}
    `;
  }

  /**
   * Updates all derived calculations in place without rebuilding the input elements,
   * so typing inside text or number inputs never loses focus.
   */
  updateAmountsOnly(): void {
    const people = personStore.getAll();
    let sharedPool = 0;

    // 1. Update personal cards
    people.forEach((person) => {
      const card = this.shadowRoot?.querySelector(`.savings-card[data-person-id="${person.id}"]`);
      if (!card) return;

      const remaining = this.getRemainingFor(person.id);
      const pData = this.ensurePersonData(person.id);
      const { contribution: contribVal, personalPool } = calculateSavingsPool(
        remaining,
        pData.sharedContributionPercent || 0
      );
      sharedPool += contribVal;

      const remEl = card.querySelector('.person-remaining-val');
      if (remEl) remEl.textContent = `${formatAmount(remaining)} €`;

      const contribEl = card.querySelector('.person-contrib-amount');
      if (contribEl) contribEl.textContent = `${formatAmount(contribVal)} €`;

      const poolEl = card.querySelector('.person-pool-val');
      if (poolEl) poolEl.textContent = `${formatAmount(personalPool)} €`;

      pData.items.forEach((item) => {
        const itemRow = card.querySelector(`.savings-item-row[data-item-id="${item.id}"]`);
        if (itemRow) {
          const amountEl = itemRow.querySelector('.item-calc-amount');
          const itemVal = (personalPool > 0 ? personalPool : 0) * ((item.percent || 0) / 100);
          if (amountEl) amountEl.textContent = `${formatAmount(itemVal)} €`;
        }
      });

      const summaryEl = card.querySelector<HTMLElement>('.person-summary');
      if (summaryEl) this.updatePersonSummaryContent(summaryEl, pData, personalPool);
    });

    // 2. Update shared card
    const sharedCard = this.shadowRoot?.querySelector('.shared-savings-card');
    if (sharedCard) {
      const poolEl = sharedCard.querySelector('.shared-pool-val');
      if (poolEl) poolEl.textContent = `${formatAmount(sharedPool)} €`;

      this.sharedData.items.forEach((item) => {
        const itemRow = sharedCard.querySelector(`.savings-item-row[data-item-id="${item.id}"]`);
        if (itemRow) {
          const amountEl = itemRow.querySelector('.item-calc-amount');
          const itemVal = (sharedPool > 0 ? sharedPool : 0) * ((item.percent || 0) / 100);
          if (amountEl) amountEl.textContent = `${formatAmount(itemVal)} €`;
        }
      });

      const summaryEl = sharedCard.querySelector<HTMLElement>('.shared-summary');
      if (summaryEl) this.updateSharedSummaryContent(summaryEl, sharedPool);
    }
  }
}

customElements.define('budget-savings', BudgetSavings);

function loadPersonalData(): Record<string, PersonSavingsData> {
  const raw = localStorage.getItem(PERSONAL_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, PersonSavingsData>;
    } catch {
      // fallback
    }
  }
  return {};
}

function loadSharedData(): SharedSavingsData {
  const raw = localStorage.getItem(SHARED_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items)) return parsed as SharedSavingsData;
    } catch {
      // fallback
    }
  }
  return { items: [] };
}
