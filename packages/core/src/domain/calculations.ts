import type {
  Entry,
  Person,
  PersonId,
  PersonSavingsData,
  Scenario,
  ScenarioState,
  SavingsItem,
  SharedExpenseEntry,
  SharedSavingsData
} from './models.js';
import { getActiveScenario } from './scenarios.js';

export interface HouseholdTotalsInput {
  people: readonly Person[];
  incomeByPerson: Readonly<Record<PersonId, ScenarioState>>;
  personalExpensesByPerson: Readonly<Record<PersonId, ScenarioState>>;
  sharedExpenses?: ScenarioState<SharedExpenseEntry>;
  assetsByPerson?: Readonly<Record<PersonId, readonly Entry[]>>;
}

export interface HouseholdTotals {
  income: number;
  baseIncome: number;
  personalExpenses: number;
  basePersonalExpenses: number;
  sharedExpenses: number;
  baseSharedExpenses: number;
  assets: number;
  baseAssets: number;
}

export interface RemainingBalanceRow {
  person: Person;
  income: number;
  personalExpenses: number;
  sharedExpensesPaid: number;
  remaining: number;
}

export interface RemainingBalances {
  rows: RemainingBalanceRow[];
  householdTotal: number;
}

export interface ProportionalContributionRow {
  person: Person;
  income: number;
  percent: number;
  share: number;
  paid: number;
  balance: number;
}

export interface ProportionalContributions {
  rows: ProportionalContributionRow[];
  totalIncome: number;
  totalSharedExpenses: number;
}

export interface SavingsAllocation {
  item: SavingsItem;
  amount: number;
}

export interface SavingsPoolSummary {
  pool: number;
  allocations: SavingsAllocation[];
  allocatedPercent: number;
  unallocatedPercent: number;
  unallocatedAmount: number;
  isOverallocated: boolean;
}

export interface PersonSavingsSummary extends SavingsPoolSummary {
  person: Person;
  remaining: number;
  sharedContribution: number;
  personalPool: number;
}

export interface SavingsPlan {
  people: PersonSavingsSummary[];
  shared: SavingsPoolSummary;
  sharedPool: number;
}

export function entriesTotal(entries: readonly Entry[], excludeSettlements = false): number {
  return entries.reduce((total, entry) => {
    if (excludeSettlements && entry.isSettlement) {
      return total;
    }
    const amount = Number(entry.amount);
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

export function scenarioTotal(scenario: Scenario | undefined, excludeSettlements = false): number {
  return scenario ? entriesTotal(scenario.entries, excludeSettlements) : 0;
}

export function calculateHouseholdTotals(input: HouseholdTotalsInput): HouseholdTotals {
  const incomeScenarios = input.people.map((person) => getActiveScenario(input.incomeByPerson[person.id]));
  const expenseScenarios = input.people.map((person) => getActiveScenario(input.personalExpensesByPerson[person.id]));
  const sharedExpenses = getActiveScenario(input.sharedExpenses);
  const assets = input.people.flatMap((person) => input.assetsByPerson?.[person.id] ?? []);

  return {
    income: sumScenarios(incomeScenarios),
    baseIncome: sumScenarios(incomeScenarios, true),
    personalExpenses: sumScenarios(expenseScenarios),
    basePersonalExpenses: sumScenarios(expenseScenarios, true),
    sharedExpenses: scenarioTotal(sharedExpenses),
    baseSharedExpenses: scenarioTotal(sharedExpenses, true),
    assets: entriesTotal(assets),
    baseAssets: entriesTotal(assets, true)
  };
}

export function calculateRemainingBalance(
  personId: PersonId,
  income: Scenario | undefined,
  personalExpenses: Scenario | undefined,
  sharedExpenses: Scenario<SharedExpenseEntry> | undefined
): number {
  const incomeTotal = scenarioTotal(income);
  const personalExpenseTotal = scenarioTotal(personalExpenses);
  const sharedExpensePaid = sharedExpenses
    ? entriesTotal(sharedExpenses.entries.filter((entry) => entry.personId === personId))
    : 0;
  return incomeTotal - personalExpenseTotal - sharedExpensePaid;
}

export function calculateRemainingBalances(
  people: readonly Person[],
  incomeByPerson: Readonly<Record<PersonId, ScenarioState>>,
  personalExpensesByPerson: Readonly<Record<PersonId, ScenarioState>>,
  sharedExpenses: ScenarioState<SharedExpenseEntry> | undefined
): RemainingBalances {
  const sharedScenario = getActiveScenario(sharedExpenses);
  const rows = people.map((person): RemainingBalanceRow => {
    const income = getActiveScenario(incomeByPerson[person.id]);
    const personalExpenses = getActiveScenario(personalExpensesByPerson[person.id]);
    const sharedExpensesPaid = sharedScenario
      ? entriesTotal(sharedScenario.entries.filter((entry) => entry.personId === person.id))
      : 0;
    const incomeTotal = scenarioTotal(income);
    const personalExpenseTotal = scenarioTotal(personalExpenses);
    return {
      person,
      income: incomeTotal,
      personalExpenses: personalExpenseTotal,
      sharedExpensesPaid,
      remaining: incomeTotal - personalExpenseTotal - sharedExpensesPaid
    };
  });
  return { rows, householdTotal: rows.reduce((total, row) => total + row.remaining, 0) };
}

export function calculateProportionalContributions(
  people: readonly Person[],
  incomeByPerson: Readonly<Record<PersonId, ScenarioState>>,
  sharedExpenses: ScenarioState<SharedExpenseEntry> | undefined
): ProportionalContributions {
  const incomes = people.map((person) => ({
    person,
    income: scenarioTotal(getActiveScenario(incomeByPerson[person.id]), true)
  }));
  const totalIncome = incomes.reduce((total, item) => total + item.income, 0);
  const sharedScenario = getActiveScenario(sharedExpenses);
  const totalSharedExpenses = scenarioTotal(sharedScenario);
  const rows = incomes.map(({ person, income }): ProportionalContributionRow => {
    const percent = totalIncome > 0 ? income / totalIncome * 100 : people.length ? 100 / people.length : 0;
    const share = totalSharedExpenses * percent / 100;
    const paid = sharedScenario
      ? entriesTotal(sharedScenario.entries.filter((entry) => entry.personId === person.id))
      : 0;
    return { person, income, percent, share, paid, balance: share - paid };
  });
  return { rows, totalIncome, totalSharedExpenses };
}

export function calculateSavingsPool(
  remaining: number,
  sharedContributionPercent: number
): { contribution: number; personalPool: number } {
  const rawContribution = remaining * sharedContributionPercent / 100;
  return {
    contribution: Math.max(0, rawContribution),
    personalPool: Math.max(0, remaining - rawContribution)
  };
}

export function calculateSavingsAllocation(pool: number, items: readonly SavingsItem[]): SavingsPoolSummary {
  const usablePool = Math.max(0, pool);
  const allocatedPercent = items.reduce((total, item) => total + (Number(item.percent) || 0), 0);
  const unallocatedPercent = Math.max(0, 100 - allocatedPercent);
  return {
    pool: usablePool,
    allocations: items.map((item) => ({ item, amount: usablePool * (Number(item.percent) || 0) / 100 })),
    allocatedPercent,
    unallocatedPercent,
    unallocatedAmount: usablePool * unallocatedPercent / 100,
    isOverallocated: allocatedPercent > 100
  };
}

export function calculateSavingsPlan(
  people: readonly Person[],
  remainingByPerson: Readonly<Record<PersonId, number>>,
  personalSavingsByPerson: Readonly<Record<PersonId, PersonSavingsData>>,
  sharedSavings: SharedSavingsData
): SavingsPlan {
  let sharedPool = 0;
  const personSummaries = people.map((person): PersonSavingsSummary => {
    const remaining = remainingByPerson[person.id] ?? 0;
    const savings = personalSavingsByPerson[person.id] ?? { sharedContributionPercent: 0, items: [] };
    const { contribution, personalPool } = calculateSavingsPool(remaining, savings.sharedContributionPercent);
    sharedPool += contribution;
    return {
      person,
      remaining,
      sharedContribution: contribution,
      personalPool,
      ...calculateSavingsAllocation(personalPool, savings.items)
    };
  });

  return {
    people: personSummaries,
    sharedPool,
    shared: calculateSavingsAllocation(sharedPool, sharedSavings.items)
  };
}

function sumScenarios(scenarios: readonly (Scenario | undefined)[], excludeSettlements = false): number {
  return scenarios.reduce((total, scenario) => total + scenarioTotal(scenario, excludeSettlements), 0);
}