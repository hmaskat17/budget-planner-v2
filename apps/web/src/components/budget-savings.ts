import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { consume } from '@lit/context';
import type { PersonSavingsData, SharedSavingsData } from '@budget-planner/core';
import {
  calculateRemainingBalances,
  calculateSavingsAllocation,
  calculateSavingsPool,
  createId
} from '@budget-planner/core';
import { budgetContext, type BudgetContextValue } from '../context/budget-context.ts';
import { baseStyles } from '../ui/shared-styles.ts';
import { icon } from '../ui/icons.ts';
import { LocalizeController, money, percent, t } from '../i18n/index.ts';

/**
 * Unified Savings Component holding:
 * 1. Personal savings goals & shared contribution % per person.
 * 2. Shared household savings goals based on pooled contributions.
 * Implemented with Lit and consumes budgetContext.
 */
@customElement('budget-savings')
export class BudgetSavings extends LitElement {
  static override styles = [
    baseStyles,
    css`
      .savings-container {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .personal-savings-columns {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
      }
      .savings-card,
      .shared-savings-card {
        padding: 18px;
        background: var(--surface-2);
        border: 1px solid var(--border-soft);
        border-radius: var(--radius);
      }
      .shared-savings-card {
        background: color-mix(in srgb, var(--accent) 5%, var(--surface));
        border-color: color-mix(in srgb, var(--accent) 22%, var(--border));
      }
      .stat-row {
        margin-bottom: 8px;
      }
      .stat-row.subtle {
        color: var(--muted);
      }
      .stat-row.highlight {
        margin-top: 0;
        margin-bottom: 14px;
      }
      .contribution-section {
        margin: 12px 0;
        padding: 10px 12px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
      }
      .contribution-label {
        margin-bottom: 8px;
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--muted);
      }
      .contribution-inputs {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--muted);
      }
      .contribution-inputs input[type='number'] {
        width: 72px;
      }
      .contribution-amount {
        margin-left: auto;
        font-weight: 600;
        color: var(--accent);
        font-variant-numeric: tabular-nums;
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
        flex-wrap: wrap;
        gap: 6px;
        color: var(--muted);
      }
      .savings-item-row input[type='text'] {
        flex: 1 1 120px;
      }
      .savings-item-row input[type='number'] {
        flex: none;
        width: 68px;
      }
      .savings-item-amount {
        flex: 0 0 auto;
        min-width: 72px;
        text-align: right;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--text);
        font-variant-numeric: tabular-nums;
      }
      .add-item-btn {
        margin-bottom: 12px;
      }
      .allocation-summary {
        padding: 10px 12px;
        margin-top: 4px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        font-size: 0.8125rem;
        color: var(--muted);
      }
      .summary-bar {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 4px 12px;
      }
      .summary-bar strong {
        color: var(--text);
        font-weight: 600;
      }
      .allocation-warning {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
        color: var(--negative);
        font-weight: 500;
      }
    `
  ];

  @consume({ context: budgetContext, subscribe: true })
  budget?: BudgetContextValue;

  protected readonly _localize = new LocalizeController(this);

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
                <h3>${icon('user', 16)}${t('savings.personTitle', { name: person.name })}</h3>

                <div class="stat-row">
                  <span>${t('savings.remainingMoney')}</span>
                  <span class="person-remaining-val">${money(remaining)}</span>
                </div>

                <div class="contribution-section">
                  <div class="contribution-label">${t('savings.sharedContribution')}</div>
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
                      ${money(contribution)}
                    </span>
                  </div>
                </div>

                <div class="stat-row subtle">
                  <span>${t('savings.personalPool')}</span>
                  <span class="person-pool-val">${money(personalPool)}</span>
                </div>

                <div class="items-list personal-items-list">
                  ${pData.items.map((item, index) => {
                    const itemVal =
                      (personalPool > 0 ? personalPool : 0) * ((item.percent || 0) / 100);
                    return html`
                      <div class="savings-item-row" data-item-id=${item.id}>
                        <input
                          type="text"
                          placeholder=${t('savings.goalName')}
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
                          ${money(itemVal)}
                        </span>
                        <button
                          type="button"
                          class="remove-item-btn"
                          title=${t('savings.removeGoal')}
                          aria-label=${t('savings.removeGoal')}
                          @click=${() => this.removePersonalGoal(person.id, index)}
                        >
                          ${icon('trash', 16)}
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
                  ${icon('plus', 14)}${t('savings.addPersonalGoal')}
                </button>

                <div class="allocation-summary person-summary">
                  <div class="summary-bar">
                    <span>${t('savings.allocated')} <strong>${percent(allocation.allocatedPercent)}</strong></span>
                    <span>
                      ${t('savings.unallocated')}
                      <strong>${percent(allocation.unallocatedPercent)}</strong>
                      (${money(allocation.unallocatedAmount)})
                    </span>
                  </div>
                  ${allocation.isOverallocated
                    ? html`
                        <div class="allocation-warning">
                          ${icon('alert', 14)}${t('savings.overallocated', {
                            percent: percent(allocation.allocatedPercent)
                          })}
                        </div>
                      `
                    : ''}
                </div>
              </div>
            `
          )}
        </div>

        <div class="shared-savings-card">
          <h3>${icon('users', 16)}${t('savings.sharedTitle')}</h3>

          <div class="stat-row highlight">
            <span>${t('savings.pooled')}</span>
            <span class="shared-pool-val">${money(sharedPool)}</span>
          </div>

          <div class="items-list shared-items-list">
            ${sharedSavingsData.items.map((item, index) => {
              const itemVal = (sharedPool > 0 ? sharedPool : 0) * ((item.percent || 0) / 100);
              return html`
                <div class="savings-item-row" data-item-id=${item.id}>
                  <input
                    type="text"
                    placeholder=${t('savings.goalName')}
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
                    ${money(itemVal)}
                  </span>
                  <button
                    type="button"
                    class="remove-item-btn"
                    title=${t('savings.removeGoal')}
                    aria-label=${t('savings.removeGoal')}
                    @click=${() => this.removeSharedGoal(index)}
                  >
                    ${icon('trash', 16)}
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
            ${icon('plus', 14)}${t('savings.addSharedGoal')}
          </button>

          <div class="allocation-summary shared-summary">
            <div class="summary-bar">
              <span>${t('savings.allocated')} <strong>${percent(sharedAllocation.allocatedPercent)}</strong></span>
              <span>
                ${t('savings.unallocated')}
                <strong>${percent(sharedAllocation.unallocatedPercent)}</strong>
                (${money(sharedAllocation.unallocatedAmount)})
              </span>
            </div>
            ${sharedAllocation.isOverallocated
              ? html`
                  <div class="allocation-warning">
                    ${icon('alert', 14)}${t('savings.overallocated', {
                      percent: percent(sharedAllocation.allocatedPercent)
                    })}
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
