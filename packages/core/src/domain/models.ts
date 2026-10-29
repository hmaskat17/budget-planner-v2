export type PersonId = string;

export interface Person {
  id: PersonId;
  name: string;
}

export interface Entry {
  name: string;
  amount: number;
  isSettlement?: boolean;
}

export interface SharedExpenseEntry extends Entry {
  personId?: PersonId;
}

export interface Scenario<TEntry extends Entry = Entry> {
  id: string;
  name: string;
  entries: TEntry[];
}

export interface ScenarioState<TEntry extends Entry = Entry> {
  activeScenarioId: string;
  scenarios: Scenario<TEntry>[];
}

export interface SavingsItem {
  id: string;
  name: string;
  percent: number;
}

export interface PersonSavingsData {
  sharedContributionPercent: number;
  items: SavingsItem[];
}

export interface SharedSavingsData {
  items: SavingsItem[];
}

export type ContributionMethod = 'equal' | 'proportional' | 'equal-leftover' | 'fully-pooled' | 'custom';

export interface ContributionSettings {
  method: ContributionMethod;
  customPercentByPerson: Record<PersonId, number>;
}

export interface BudgetData {
  people: Person[];
  incomeByPerson: Record<PersonId, ScenarioState>;
  personalExpensesByPerson: Record<PersonId, ScenarioState>;
  sharedExpenses: ScenarioState<SharedExpenseEntry>;
  assetsByPerson: Record<PersonId, Entry[]>;
  personalSavingsByPerson: Record<PersonId, PersonSavingsData>;
  sharedSavings: SharedSavingsData;
  contributionSettings: ContributionSettings;
}

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}