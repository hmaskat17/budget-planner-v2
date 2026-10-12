import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import type { PersonSavingsData, SharedSavingsData } from '@budget-planner/core';
import {
  calculateRemainingBalances,
  calculateSavingsAllocation,
  calculateSavingsPool,
  createId,
  formatAmount
} from '@budget-planner/core';
import { budgetContext, type BudgetContextValue } from '../context/budget-context.ts';

/**
 * Unified Savings Component holding:
 * 1. Personal savings goals & shared contribution % per person.
 * 2. Shared household savings goals based on pooled contributions.
 * Implemented with Lit and consumes budgetContext.
 */
@customElement('budget-savings')
export class BudgetSavings extends LitElement {
  static override styles = css`
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
  `;

  @consume({ context: budgetContext, subscribe: true })
  budget?: BudgetContextValue;

  private _getPersonSavingsData(personId: string): PersonSavingsData {
    return (
      this.budget?.data.personalSavingsByPerson[personId] ?? {
        sharedContributionPercent: 0,
        items: []
      }
    );
  }

  private _getSharedSavingsData(): SharedSavingsData {
    return this.budget?.data.sharedSavings ?? { items: [] };
  }

  private _updatePersonSavings(personId: string, data: PersonSavingsData): void {
    this.budget?.updatePersonalSavings(personId, data);
  }

  private _updateSharedSavings(data: SharedSavingsData): void {
    this.budget?.updateSharedSavings(data);
  }

  addPersonalGoal(personId: string): void {
    const current = this._getPersonSavingsData(personId);
    this._updatePersonSavings(personId, {
      ...current,
      items: [...current.items, { id: createId('savings'), name: '', percent: 0 }]
    });
  }

  removePersonalGoal(personId: string, index: number): void {
    const current = this._getPersonSavingsData(personId);
    this._updatePersonSavings(personId, {
      ...current,
      items: current.items.filter((_, idx) => idx !== index)
    });
  }

  updatePersonalGoalName(personId: string, index: number, name: string): void {
    const current = this._getPersonSavingsData(personId);
    this._updatePersonSavings(personId, {
      ...current,
      items: current.items.map((item, idx) => (idx === index ? { ...item, name } : item))
    });
  }

  updatePersonalGoalPercent(personId: string, index: number, percentStr: string): void {
    const percent = Number(percentStr) || 0;
    const current = this._getPersonSavingsData(personId);
    this._updatePersonSavings(personId, {
      ...current,
      items: current.items.map((item, idx) => (idx === index ? { ...item, percent } : item))
    });
  }

  updateSharedContributionPercent(personId: string, percentStr: string): void {
    const percent = Number(percentStr) || 0;
    const current = this._getPersonSavingsData(personId);
    this._updatePersonSavings(personId, {
      ...current,
      sharedContributionPercent: percent
    });
  }

  addSharedGoal(): void {
    const current = this._getSharedSavingsData();
    this._updateSharedSavings({
      ...current,
      items: [...current.items, { id: createId('savings'), name: '', percent: 0 }]
    });
  }

  removeSharedGoal(index: number): void {
    const current = this._getSharedSavingsData();
    this._updateSharedSavings({
      ...current,
      items: current.items.filter((_, idx) => idx !== index)
    });
  }

  updateSharedGoalName(index: number, name: string): void {
    const current = this._getSharedSavingsData();
    this._updateSharedSavings({
      ...current,
      items: current.items.map((item, idx) => (idx === index ? { ...item, name } : item))
    });
  }

  updateSharedGoalPercent(index: number, percentStr: string): void {
    const percent = Number(percentStr) || 0;
    const current = this._getSharedSavingsData();
    this._updateSharedSavings({
      ...current,
      items: current.items.map((item, idx) => (idx === index ? { ...item, percent } : item))
    });
  }

  override render() {
    if (!this.budget) {
      return html``;
    }

    const { people, incomeByPerson, personalExpensesByPerson, sharedExpenses } = this.budget.data;
    const remainingBalances = calculateRemainingBalances(
      people,
      incomeByPerson,
      personalExpensesByPerson,
      sharedExpenses
    );

    const remainingMap = new Map<string, number>();
    remainingBalances.rows.forEach((r) => remainingMap.set(r.person.id, r.remaining));

    let sharedPool = 0;
    const personCalcs = people.map((person) => {
      const remaining = remainingMap.get(person.id) ?? 0;
      const pData = this._getPersonSavingsData(person.id);
      const { contribution, personalPool } = calculateSavingsPool(
        remaining,
        pData.sharedContributionPercent
      );
      sharedPool += contribution;
      const allocation = calculateSavingsAllocation(personalPool, pData.items);
      return { person, pData, remaining, contribution, personalPool, allocation };
    });

    const sharedSavingsData = this._getSharedSavingsData();
    const sharedAllocation = calculateSavingsAllocation(sharedPool, sharedSavingsData.items);

    return html`
      <div class="savings-container">
        <div class="personal-savings-columns">
          ${personCalcs.map(
            ({ person, pData, remaining, contribution, personalPool, allocation }) => html`
              <div class="savings-card" data-person-id=${person.id}>
                <h3>${person.name}'s Savings</h3>

                <div class="stat-row">
                  <span>Remaining money:</span>
                  <span class="person-remaining-val">${formatAmount(remaining)} €</span>
                </div>

                <div class="contribution-section">
                  <div class="contribution-label">Contribution to Shared Savings:</div>
                  <div class="contribution-inputs">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      .value=${String(pData.sharedContributionPercent ?? 0)}
                      @input=${(e: Event) =>
                        this.updateSharedContributionPercent(
                          person.id,
                          (e.target as HTMLInputElement).value
                        )}
                    />
                    <span>% =</span>
                    <span class="contribution-amount person-contrib-amount">
                      ${formatAmount(contribution)} €
                    </span>
                  </div>
                </div>

                <div class="stat-row subtle">
                  <span>Personal savings pool:</span>
                  <span class="person-pool-val">${formatAmount(personalPool)} €</span>
                </div>

                <div class="items-list personal-items-list">
                  ${pData.items.map((item, index) => {
                    const itemVal =
                      (personalPool > 0 ? personalPool : 0) * ((item.percent || 0) / 100);
                    return html`
                      <div class="savings-item-row" data-item-id=${item.id}>
                        <input
                          type="text"
                          placeholder="Goal name"
                          .value=${item.name}
                          @input=${(e: Event) =>
                            this.updatePersonalGoalName(
                              person.id,
                              index,
                              (e.target as HTMLInputElement).value
                            )}
                        />
                        <input
                          type="number"
                          placeholder="%"
                          min="0"
                          max="100"
                          step="any"
                          .value=${item.percent !== undefined ? String(item.percent) : ''}
                          @input=${(e: Event) =>
                            this.updatePersonalGoalPercent(
                              person.id,
                              index,
                              (e.target as HTMLInputElement).value
                            )}
                        />
                        <span>%</span>
                        <span class="savings-item-amount item-calc-amount">
                          ${formatAmount(itemVal)} €
                        </span>
                        <button
                          type="button"
                          class="remove-item-btn"
                          title="Remove goal"
                          @click=${() => this.removePersonalGoal(person.id, index)}
                        >
                          &times;
                        </button>
                      </div>
                    `;
                  })}
                </div>

                <button
                  type="button"
                  class="add-item-btn"
                  @click=${() => this.addPersonalGoal(person.id)}
                >
                  + Add personal goal
                </button>

                <div class="allocation-summary person-summary">
                  <div class="summary-bar">
                    <span>Allocated: <strong>${formatAmount(allocation.allocatedPercent)}%</strong></span>
                    <span>
                      Unallocated:
                      <strong>${formatAmount(allocation.unallocatedPercent)}%</strong>
                      (${formatAmount(allocation.unallocatedAmount)} €)
                    </span>
                  </div>
                  ${allocation.isOverallocated
                    ? html`
                        <div class="allocation-warning">
                          Total allocated percentage exceeds 100%
                          (${formatAmount(allocation.allocatedPercent)}%)
                        </div>
                      `
                    : ''}
                </div>
              </div>
            `
          )}
        </div>

        <div class="shared-savings-card">
          <h3>Shared Household Savings</h3>

          <div class="stat-row highlight">
            <span>Total pooled shared savings:</span>
            <span class="shared-pool-val">${formatAmount(sharedPool)} €</span>
          </div>

          <div class="items-list shared-items-list">
            ${sharedSavingsData.items.map((item, index) => {
              const itemVal = (sharedPool > 0 ? sharedPool : 0) * ((item.percent || 0) / 100);
              return html`
                <div class="savings-item-row" data-item-id=${item.id}>
                  <input
                    type="text"
                    placeholder="Goal name"
                    .value=${item.name}
                    @input=${(e: Event) =>
                      this.updateSharedGoalName(index, (e.target as HTMLInputElement).value)}
                  />
                  <input
                    type="number"
                    placeholder="%"
                    min="0"
                    max="100"
                    step="any"
                    .value=${item.percent !== undefined ? String(item.percent) : ''}
                    @input=${(e: Event) =>
                      this.updateSharedGoalPercent(index, (e.target as HTMLInputElement).value)}
                  />
                  <span>%</span>
                  <span class="savings-item-amount item-calc-amount">
                    ${formatAmount(itemVal)} €
                  </span>
                  <button
                    type="button"
                    class="remove-item-btn"
                    title="Remove goal"
                    @click=${() => this.removeSharedGoal(index)}
                  >
                    &times;
                  </button>
                </div>
              `;
            })}
          </div>

          <button
            type="button"
            class="add-item-btn"
            @click=${() => this.addSharedGoal()}
          >
            + Add shared goal
          </button>

          <div class="allocation-summary shared-summary">
            <div class="summary-bar">
              <span>Allocated: <strong>${formatAmount(sharedAllocation.allocatedPercent)}%</strong></span>
              <span>
                Unallocated:
                <strong>${formatAmount(sharedAllocation.unallocatedPercent)}%</strong>
                (${formatAmount(sharedAllocation.unallocatedAmount)} €)
              </span>
            </div>
            ${sharedAllocation.isOverallocated
              ? html`
                  <div class="allocation-warning">
                    Total allocated percentage exceeds 100%
                    (${formatAmount(sharedAllocation.allocatedPercent)}%)
                  </div>
                `
              : ''}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'budget-savings': BudgetSavings;
  }
}
