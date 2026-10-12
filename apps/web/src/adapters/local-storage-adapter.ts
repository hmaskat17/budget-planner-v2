import type {
  BudgetData,
  Entry,
  Person,
  PersonSavingsData,
  ScenarioState,
  SharedExpenseEntry,
  SharedSavingsData
} from '@budget-planner/core';
import { createDefaultScenario, createId } from '@budget-planner/core';

const PERSONS_STORAGE_KEY = 'budget-planner-persons';
const INCOME_STORAGE_KEY = 'budget-planner-income';
const PERSONAL_EXPENSE_STORAGE_KEY = 'budget-planner-personal-expense';
const SHARED_EXPENSE_STORAGE_KEY = 'budget-planner-shared-expense';
const PERSONAL_SAVINGS_STORAGE_KEY = 'budget-planner-personal-savings';
const SHARED_SAVINGS_STORAGE_KEY = 'budget-planner-shared-savings';
const UNALLOCATED_ASSETS_STORAGE_KEY = 'budget-planner-unallocated-assets';

function loadJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function createDefaultSharedScenario(): ScenarioState<SharedExpenseEntry> {
  const scenario = { id: createId('scenario'), name: 'Default', entries: [] };
  return { activeScenarioId: scenario.id, scenarios: [scenario] };
}

function createDefaultPersonScenario(): ScenarioState {
  const scenario = createDefaultScenario(createId('scenario'));
  return { activeScenarioId: scenario.id, scenarios: [scenario] };
}

export const localStorageAdapter = {
  /**
   * Asynchronously loads the complete BudgetData from localStorage.
   * Useful with @lit/task for asynchronous data initialization.
   */
  async loadBudgetData(): Promise<BudgetData> {
    // Simulate brief async tick for task lifecycle
    await Promise.resolve();

    const people = loadJson<Person[]>(PERSONS_STORAGE_KEY, [{ id: 'person-1', name: 'Person 1' }]);

    const incomeByPerson = loadJson<Record<string, ScenarioState>>(INCOME_STORAGE_KEY, {});
    const personalExpensesByPerson = loadJson<Record<string, ScenarioState>>(PERSONAL_EXPENSE_STORAGE_KEY, {});
    const sharedExpenses = loadJson<ScenarioState<SharedExpenseEntry>>(
      SHARED_EXPENSE_STORAGE_KEY,
      createDefaultSharedScenario()
    );
    const assetsByPerson = loadJson<Record<string, Entry[]>>(UNALLOCATED_ASSETS_STORAGE_KEY, {});
    const personalSavingsByPerson = loadJson<Record<string, PersonSavingsData>>(PERSONAL_SAVINGS_STORAGE_KEY, {});
    const sharedSavings = loadJson<SharedSavingsData>(SHARED_SAVINGS_STORAGE_KEY, { items: [] });

    // Ensure all people have baseline scenarios in memory
    people.forEach((p) => {
      if (!incomeByPerson[p.id]) {
        incomeByPerson[p.id] = createDefaultPersonScenario();
      }
      if (!personalExpensesByPerson[p.id]) {
        personalExpensesByPerson[p.id] = createDefaultPersonScenario();
      }
      if (!assetsByPerson[p.id]) {
        assetsByPerson[p.id] = [];
      }
      if (!personalSavingsByPerson[p.id]) {
        personalSavingsByPerson[p.id] = { sharedContributionPercent: 0, items: [] };
      }
    });

    return {
      people,
      incomeByPerson,
      personalExpensesByPerson,
      sharedExpenses,
      assetsByPerson,
      personalSavingsByPerson,
      sharedSavings
    };
  },

  savePeople(people: Person[]): void {
    localStorage.setItem(PERSONS_STORAGE_KEY, JSON.stringify(people));
  },

  saveIncome(incomeByPerson: Record<string, ScenarioState>): void {
    localStorage.setItem(INCOME_STORAGE_KEY, JSON.stringify(incomeByPerson));
  },

  savePersonalExpenses(personalExpensesByPerson: Record<string, ScenarioState>): void {
    localStorage.setItem(PERSONAL_EXPENSE_STORAGE_KEY, JSON.stringify(personalExpensesByPerson));
  },

  saveSharedExpenses(sharedExpenses: ScenarioState<SharedExpenseEntry>): void {
    localStorage.setItem(SHARED_EXPENSE_STORAGE_KEY, JSON.stringify(sharedExpenses));
  },

  saveAssets(assetsByPerson: Record<string, Entry[]>): void {
    localStorage.setItem(UNALLOCATED_ASSETS_STORAGE_KEY, JSON.stringify(assetsByPerson));
  },

  savePersonalSavings(personalSavingsByPerson: Record<string, PersonSavingsData>): void {
    localStorage.setItem(PERSONAL_SAVINGS_STORAGE_KEY, JSON.stringify(personalSavingsByPerson));
  },

  saveSharedSavings(sharedSavings: SharedSavingsData): void {
    localStorage.setItem(SHARED_SAVINGS_STORAGE_KEY, JSON.stringify(sharedSavings));
  },

  saveAll(data: BudgetData): void {
    this.savePeople(data.people);
    this.saveIncome(data.incomeByPerson);
    this.savePersonalExpenses(data.personalExpensesByPerson);
    this.saveSharedExpenses(data.sharedExpenses);
    this.saveAssets(data.assetsByPerson);
    this.savePersonalSavings(data.personalSavingsByPerson);
    this.saveSharedSavings(data.sharedSavings);
  }
};
