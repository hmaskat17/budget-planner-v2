import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { provide } from '@lit/context';
import { Task } from '@lit/task';
import type {
  BudgetData,
  Entry,
  PersonSavingsData,
  ScenarioState,
  SharedExpenseEntry,
  SharedSavingsData
} from '@budget-planner/core';
import {
  addPerson as coreAddPerson,
  applySettlementAdjustments,
  calculateHouseholdTotals,
  calculateProportionalContributions,
  canAddPerson as coreCanAddPerson,
  createDefaultScenario,
  createId,
  formatAmount,
  removePerson as coreRemovePerson,
  removeSettlementAdjustments,
  renamePerson as coreRenamePerson
} from '@budget-planner/core';
import { budgetContext, type BudgetContextValue } from '../context/budget-context.ts';
import { localStorageAdapter } from '../adapters/local-storage-adapter.ts';

// Import child components
import './person-editor.ts';
import './budget-income.ts';
import './budget-personal-expense.ts';
import './budget-shared-expense.ts';
import './budget-remaining-balance.ts';
import './budget-savings.ts';
import './budget-proportional-contributions.ts';
import './budget-unallocated-assets.ts';

/**
 * Root Application Component for Budget Planner.
 * Loads initial data with @lit/task, manages reactive application state,
 * and provides state across the web component tree with @lit/context.
 */
@customElement('budget-planner-app')
export class BudgetPlannerApp extends LitElement {
  static override styles = css`
    :host {
      display: block;
      font-family: Arial, sans-serif;
    }
    .budget-section {
      background-color: #fff;
      padding: 20px;
      margin: 20px auto;
      width: 90%;
      max-width: 640px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    }
    .budget-section h2 {
      margin-top: 0;
    }
    .budget-columns {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    .budget-columns > * {
      flex: 1 1 260px;
      min-width: 260px;
    }
    .person-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    #household-total,
    #household-expense-total,
    #household-assets-total {
      font-weight: bold;
      margin-top: 20px;
      border-top: 1px solid #ddd;
      padding-top: 10px;
    }
    .loading-container {
      text-align: center;
      padding: 40px;
      font-size: 1.1em;
      color: #555;
    }
    .error-container {
      color: #d00;
      padding: 20px;
      text-align: center;
    }
  `;

  @state()
  private _budgetData: BudgetData = {
    people: [{ id: 'person-1', name: 'Person 1' }],
    incomeByPerson: {},
    personalExpensesByPerson: {},
    sharedExpenses: {
      activeScenarioId: 'default',
      scenarios: [{ id: 'default', name: 'Default', entries: [] }]
    },
    assetsByPerson: {},
    personalSavingsByPerson: {},
    sharedSavings: { items: [] }
  };

  @provide({ context: budgetContext })
  budgetContextValue: BudgetContextValue = this._createContextValue();

  /** Async task for loading budget data on startup */
  private _loadDataTask = new Task(this, {
    task: async () => {
      const data = await localStorageAdapter.loadBudgetData();
      this._budgetData = data;
      this._updateContextValue();
      return data;
    },
    args: () => []
  });

  private _createContextValue(): BudgetContextValue {
    return {
      data: this._budgetData,
      canAddPerson: () => coreCanAddPerson(this._budgetData.people),
      addPerson: () => this._addPerson(),
      removePerson: (id: string) => this._removePerson(id),
      renamePerson: (id: string, name: string) => this._renamePerson(id, name),
      updateIncome: (personId: string, state: ScenarioState) =>
        this._updateIncome(personId, state),
      updatePersonalExpense: (personId: string, state: ScenarioState) =>
        this._updatePersonalExpense(personId, state),
      updateSharedExpenses: (state: ScenarioState<SharedExpenseEntry>) =>
        this._updateSharedExpenses(state),
      updateAssets: (personId: string, entries: Entry[]) =>
        this._updateAssets(personId, entries),
      updatePersonalSavings: (personId: string, savings: PersonSavingsData) =>
        this._updatePersonalSavings(personId, savings),
      updateSharedSavings: (savings: SharedSavingsData) =>
        this._updateSharedSavings(savings),
      applySettlements: () => this._applySettlements(),
      removeSettlements: () => this._removeSettlements(),
      isSettlementApplied: () => this._isSettlementApplied()
    };
  }

  private _updateContextValue(): void {
    this.budgetContextValue = this._createContextValue();
    this.requestUpdate();
  }

  private _addPerson(): void {
    if (!coreCanAddPerson(this._budgetData.people)) {
      return;
    }
    const nextIndex = this._budgetData.people.length + 1;
    const newPerson = { id: `person-${nextIndex}`, name: `Person ${nextIndex}` };
    const result = coreAddPerson(this._budgetData.people, newPerson);
    if (result.issues.length === 0) {
      const newIncomeScenario = createDefaultScenario(createId('scenario'));
      const newExpenseScenario = createDefaultScenario(createId('scenario'));

      this._budgetData = {
        ...this._budgetData,
        people: result.people,
        incomeByPerson: {
          ...this._budgetData.incomeByPerson,
          [newPerson.id]: {
            activeScenarioId: newIncomeScenario.id,
            scenarios: [newIncomeScenario]
          }
        },
        personalExpensesByPerson: {
          ...this._budgetData.personalExpensesByPerson,
          [newPerson.id]: {
            activeScenarioId: newExpenseScenario.id,
            scenarios: [newExpenseScenario]
          }
        },
        assetsByPerson: {
          ...this._budgetData.assetsByPerson,
          [newPerson.id]: []
        },
        personalSavingsByPerson: {
          ...this._budgetData.personalSavingsByPerson,
          [newPerson.id]: { sharedContributionPercent: 0, items: [] }
        }
      };

      localStorageAdapter.saveAll(this._budgetData);
      this._updateContextValue();
    }
  }

  private _removePerson(id: string): void {
    const result = coreRemovePerson(this._budgetData.people, id);
    if (result.issues.length === 0) {
      const { [id]: _removedIncome, ...restIncome } = this._budgetData.incomeByPerson;
      const { [id]: _removedExpense, ...restExpense } = this._budgetData.personalExpensesByPerson;
      const { [id]: _removedAssets, ...restAssets } = this._budgetData.assetsByPerson;
      const { [id]: _removedSavings, ...restSavings } = this._budgetData.personalSavingsByPerson;

      // Reassign any shared expense entries for this person to first remaining person
      const remainingFirstId = result.people[0]?.id;
      const updatedSharedScenarios = this._budgetData.sharedExpenses.scenarios.map((sc) => ({
        ...sc,
        entries: sc.entries.map((entry) =>
          entry.personId === id ? { ...entry, personId: remainingFirstId } : entry
        )
      }));

      this._budgetData = {
        ...this._budgetData,
        people: result.people,
        incomeByPerson: restIncome,
        personalExpensesByPerson: restExpense,
        assetsByPerson: restAssets,
        personalSavingsByPerson: restSavings,
        sharedExpenses: {
          ...this._budgetData.sharedExpenses,
          scenarios: updatedSharedScenarios
        }
      };

      localStorageAdapter.saveAll(this._budgetData);
      this._updateContextValue();
    }
  }

  private _renamePerson(id: string, name: string): void {
    const result = coreRenamePerson(this._budgetData.people, id, name);
    if (result.issues.length === 0) {
      this._budgetData = {
        ...this._budgetData,
        people: result.people
      };
      localStorageAdapter.savePeople(this._budgetData.people);
      this._updateContextValue();
    }
  }

  private _updateIncome(personId: string, state: ScenarioState): void {
    this._budgetData = {
      ...this._budgetData,
      incomeByPerson: {
        ...this._budgetData.incomeByPerson,
        [personId]: state
      }
    };
    localStorageAdapter.saveIncome(this._budgetData.incomeByPerson);
    this._updateContextValue();
  }

  private _updatePersonalExpense(personId: string, state: ScenarioState): void {
    this._budgetData = {
      ...this._budgetData,
      personalExpensesByPerson: {
        ...this._budgetData.personalExpensesByPerson,
        [personId]: state
      }
    };
    localStorageAdapter.savePersonalExpenses(this._budgetData.personalExpensesByPerson);
    this._updateContextValue();
  }

  private _updateSharedExpenses(state: ScenarioState<SharedExpenseEntry>): void {
    this._budgetData = {
      ...this._budgetData,
      sharedExpenses: state
    };
    localStorageAdapter.saveSharedExpenses(this._budgetData.sharedExpenses);
    this._updateContextValue();
  }

  private _updateAssets(personId: string, entries: Entry[]): void {
    this._budgetData = {
      ...this._budgetData,
      assetsByPerson: {
        ...this._budgetData.assetsByPerson,
        [personId]: entries
      }
    };
    localStorageAdapter.saveAssets(this._budgetData.assetsByPerson);
    this._updateContextValue();
  }

  private _updatePersonalSavings(personId: string, savings: PersonSavingsData): void {
    this._budgetData = {
      ...this._budgetData,
      personalSavingsByPerson: {
        ...this._budgetData.personalSavingsByPerson,
        [personId]: savings
      }
    };
    localStorageAdapter.savePersonalSavings(this._budgetData.personalSavingsByPerson);
    this._updateContextValue();
  }

  private _updateSharedSavings(savings: SharedSavingsData): void {
    this._budgetData = {
      ...this._budgetData,
      sharedSavings: savings
    };
    localStorageAdapter.saveSharedSavings(this._budgetData.sharedSavings);
    this._updateContextValue();
  }

  private _isSettlementApplied(): boolean {
    return this._budgetData.people.some((person) => {
      const incState = this._budgetData.incomeByPerson[person.id];
      const activeInc = incState?.scenarios.find((s) => s.id === incState.activeScenarioId);
      const expState = this._budgetData.personalExpensesByPerson[person.id];
      const activeExp = expState?.scenarios.find((s) => s.id === expState.activeScenarioId);
      return (
        activeInc?.entries.some((e) => e.isSettlement) ||
        activeExp?.entries.some((e) => e.isSettlement)
      );
    });
  }

  private _applySettlements(): void {
    const { rows } = calculateProportionalContributions(
      this._budgetData.people,
      this._budgetData.incomeByPerson,
      this._budgetData.sharedExpenses
    );

    const updated = applySettlementAdjustments(
      this._budgetData.incomeByPerson,
      this._budgetData.personalExpensesByPerson,
      rows
    );

    this._budgetData = {
      ...this._budgetData,
      incomeByPerson: updated.incomeByPerson,
      personalExpensesByPerson: updated.personalExpensesByPerson
    };

    localStorageAdapter.saveIncome(this._budgetData.incomeByPerson);
    localStorageAdapter.savePersonalExpenses(this._budgetData.personalExpensesByPerson);
    this._updateContextValue();
  }

  private _removeSettlements(): void {
    const updated = removeSettlementAdjustments(
      this._budgetData.incomeByPerson,
      this._budgetData.personalExpensesByPerson
    );

    this._budgetData = {
      ...this._budgetData,
      incomeByPerson: updated.incomeByPerson,
      personalExpensesByPerson: updated.personalExpensesByPerson
    };

    localStorageAdapter.saveIncome(this._budgetData.incomeByPerson);
    localStorageAdapter.savePersonalExpenses(this._budgetData.personalExpensesByPerson);
    this._updateContextValue();
  }

  override render() {
    return this._loadDataTask.render({
      pending: () => html`<div class="loading-container">Loading budget planner...</div>`,
      error: (e) => html`<div class="error-container">Failed to load budget data: ${String(e)}</div>`,
      complete: () => this._renderApp()
    });
  }

  private _renderApp() {
    const totals = calculateHouseholdTotals({
      people: this._budgetData.people,
      incomeByPerson: this._budgetData.incomeByPerson,
      personalExpensesByPerson: this._budgetData.personalExpensesByPerson,
      sharedExpenses: this._budgetData.sharedExpenses,
      assetsByPerson: this._budgetData.assetsByPerson
    });

    const people = this._budgetData.people;
    const canAdd = coreCanAddPerson(people);

    return html`
      <!-- Household -->
      <div id="household-section" class="budget-section">
        <h2>Household</h2>
        <div id="household-people">
          ${people.map(
            (person) => html`
              <div class="person-row" data-person-id=${person.id}>
                <person-editor .personId=${person.id}></person-editor>
                ${people.length > 1
                  ? html`
                      <button
                        type="button"
                        class="remove-person"
                        @click=${() => this._removePerson(person.id)}
                      >
                        Remove
                      </button>
                    `
                  : ''}
              </div>
            `
          )}
        </div>
        <button
          type="button"
          id="add-person"
          ?hidden=${!canAdd}
          @click=${() => this._addPerson()}
        >
          Add person
        </button>
      </div>

      <!-- Income -->
      <div id="income-section" class="budget-section">
        <h2>Income</h2>
        <div id="income-people" class="budget-columns">
          ${people.map(
            (person) => html`
              <budget-income .personId=${person.id}></budget-income>
            `
          )}
        </div>
        <p id="household-total">
          Household income: <span id="household-total-amount">${formatAmount(totals.income)}</span>
        </p>
      </div>

      <!-- Personal Expenses -->
      <div id="personal-expense-section" class="budget-section">
        <h2>Personal Expenses</h2>
        <div id="personal-expense-people" class="budget-columns">
          ${people.map(
            (person) => html`
              <budget-personal-expense .personId=${person.id}></budget-personal-expense>
            `
          )}
        </div>
        <p id="household-expense-total">
          Household personal expenses:
          <span id="household-expense-total-amount">${formatAmount(totals.personalExpenses)}</span>
        </p>
      </div>

      <!-- Shared Expenses -->
      <div id="shared-expense-section" class="budget-section">
        <h2>Shared Expenses</h2>
        <budget-shared-expense></budget-shared-expense>
      </div>

      <!-- Remaining Balance -->
      <div id="remaining-balance-section" class="budget-section">
        <h2>Remaining Balance</h2>
        <budget-remaining-balance></budget-remaining-balance>
      </div>

      <!-- Savings -->
      <div id="savings-section" class="budget-section">
        <h2>Savings</h2>
        <budget-savings></budget-savings>
      </div>

      <!-- Proportional Contributions -->
      <div id="proportional-contributions-section" class="budget-section">
        <h2>Proportional Contributions</h2>
        <budget-proportional-contributions></budget-proportional-contributions>
      </div>

      <!-- Unallocated Assets -->
      <div id="unallocated-assets-section" class="budget-section">
        <h2>Unallocated Assets</h2>
        <div id="unallocated-assets-people" class="budget-columns">
          ${people.map(
            (person) => html`
              <budget-unallocated-assets .personId=${person.id}></budget-unallocated-assets>
            `
          )}
        </div>
        <p id="household-assets-total">
          Household unallocated assets:
          <span id="household-assets-total-amount">${formatAmount(totals.assets)}</span>
        </p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'budget-planner-app': BudgetPlannerApp;
  }
}
