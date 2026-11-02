import type {
  BudgetData,
  ContributionSettings,
  Entry,
  Person,
  PersonSavingsData,
  ScenarioState,
  SharedExpenseEntry,
  SharedSavingsData
} from '../domain/models.js';
import { createDefaultSharedScenario, normalizeBudgetData } from '../domain/budget-state.js';

/** Minimal synchronous key-value store; implemented by localStorage on web and app settings on mobile. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const STORAGE_KEYS = {
  people: 'budget-planner-persons',
  income: 'budget-planner-income',
  personalExpenses: 'budget-planner-personal-expense',
  sharedExpenses: 'budget-planner-shared-expense',
  personalSavings: 'budget-planner-personal-savings',
  sharedSavings: 'budget-planner-shared-savings',
  assets: 'budget-planner-unallocated-assets',
  contributionSettings: 'budget-planner-contribution-settings'
} as const;

export interface BudgetStorage {
  loadBudgetData(): Promise<BudgetData>;
  savePeople(people: Person[]): void;
  saveIncome(incomeByPerson: Record<string, ScenarioState>): void;
  savePersonalExpenses(personalExpensesByPerson: Record<string, ScenarioState>): void;
  saveSharedExpenses(sharedExpenses: ScenarioState<SharedExpenseEntry>): void;
  saveAssets(assetsByPerson: Record<string, Entry[]>): void;
  savePersonalSavings(personalSavingsByPerson: Record<string, PersonSavingsData>): void;
  saveSharedSavings(sharedSavings: SharedSavingsData): void;
  saveContributionSettings(settings: ContributionSettings): void;
  saveAll(data: BudgetData): void;
}

export function loadJson<T>(store: KeyValueStore, key: string, fallback: T): T {
  const raw = store.getItem(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(store: KeyValueStore, key: string, value: unknown): void {
  store.setItem(key, JSON.stringify(value));
}

/** Platform-independent budget persistence on top of any KeyValueStore. */
export function createBudgetStorage(store: KeyValueStore, defaultPersonName: () => string): BudgetStorage {
  const storage: BudgetStorage = {
    async loadBudgetData() {
      const people = loadJson<Person[]>(store, STORAGE_KEYS.people, [{ id: 'person-1', name: defaultPersonName() }]);
      return normalizeBudgetData({
        people,
        incomeByPerson: loadJson(store, STORAGE_KEYS.income, {}),
        personalExpensesByPerson: loadJson(store, STORAGE_KEYS.personalExpenses, {}),
        sharedExpenses: loadJson(store, STORAGE_KEYS.sharedExpenses, createDefaultSharedScenario()),
        assetsByPerson: loadJson(store, STORAGE_KEYS.assets, {}),
        personalSavingsByPerson: loadJson(store, STORAGE_KEYS.personalSavings, {}),
        sharedSavings: loadJson(store, STORAGE_KEYS.sharedSavings, { items: [] }),
        contributionSettings: loadJson<ContributionSettings>(store, STORAGE_KEYS.contributionSettings, {
          method: 'proportional',
          customPercentByPerson: {}
        })
      });
    },
    savePeople: (people) => saveJson(store, STORAGE_KEYS.people, people),
    saveIncome: (value) => saveJson(store, STORAGE_KEYS.income, value),
    savePersonalExpenses: (value) => saveJson(store, STORAGE_KEYS.personalExpenses, value),
    saveSharedExpenses: (value) => saveJson(store, STORAGE_KEYS.sharedExpenses, value),
    saveAssets: (value) => saveJson(store, STORAGE_KEYS.assets, value),
    savePersonalSavings: (value) => saveJson(store, STORAGE_KEYS.personalSavings, value),
    saveSharedSavings: (value) => saveJson(store, STORAGE_KEYS.sharedSavings, value),
    saveContributionSettings: (value) => saveJson(store, STORAGE_KEYS.contributionSettings, value),
    saveAll(data) {
      storage.savePeople(data.people);
      storage.saveIncome(data.incomeByPerson);
      storage.savePersonalExpenses(data.personalExpensesByPerson);
      storage.saveSharedExpenses(data.sharedExpenses);
      storage.saveAssets(data.assetsByPerson);
      storage.savePersonalSavings(data.personalSavingsByPerson);
      storage.saveSharedSavings(data.sharedSavings);
      storage.saveContributionSettings(data.contributionSettings);
    }
  };
  return storage;
}
