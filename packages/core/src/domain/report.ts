import type { BudgetData, ContributionMethod, Entry, Person, PersonId, SharedExpenseEntry } from './models.js';
import {
  calculateContributions,
  calculateSavingsPlan,
  entriesTotal,
  type ContributionRow,
  type SavingsPoolSummary
} from './calculations.js';
import { getActiveScenario } from './scenarios.js';
import { calculateBudgetSummary } from './summary.js';

export interface ReportEntry {
  name: string;
  amount: number;
}

export interface ReportSharedEntry extends ReportEntry {
  personId?: PersonId;
}

export interface ReportSavingsItem {
  name: string;
  percent: number;
  amount: number;
}

export interface ReportPool {
  pool: number;
  items: ReportSavingsItem[];
  allocatedPercent: number;
  allocated: number;
  unallocatedPercent: number;
  unallocated: number;
}

export interface ReportPerson {
  person: Person;
  incomeScenario: string;
  incomeEntries: ReportEntry[];
  income: number;
  assetEntries: ReportEntry[];
  assets: number;
  expenseScenario: string;
  personalExpenseEntries: ReportEntry[];
  personalExpenses: number;
  sharedPaid: number;
  remainingBeforeSavings: number;
  sharedContributionPercent: number;
  sharedContribution: number;
  personalSavings: ReportPool;
  /** The part of this person's shared savings contribution that is allocated to shared savings items. */
  sharedSavingsAllocated: number;
  savingsAllocated: number;
  netRemaining: number;
}

export interface ReportContribution {
  person: Person;
  contribution: ContributionRow;
  /** Personal expenses, excluding settlements, as used by the contribution calculation. */
  personalExpenses: number;
}

export interface BudgetReport {
  people: ReportPerson[];
  totalIncome: number;
  totalAssets: number;
  totalIncomeWithAssets: number;
  sharedScenario: string;
  sharedEntries: ReportSharedEntry[];
  sharedExpenses: number;
  totalPersonalExpenses: number;
  totalExpenses: number;
  sharedSavings: ReportPool;
  totalSavingsAllocated: number;
  totalSavingsUnallocated: number;
  netRemaining: number;
  contributionMethod: ContributionMethod;
  contributions: ReportContribution[];
  contributionSharedTotal: number;
}

function visibleEntries(entries: readonly Entry[]): ReportEntry[] {
  return entries.filter((entry) => !entry.isSettlement).map(({ name, amount }) => ({ name, amount: Number(amount) || 0 }));
}

function toPool(summary: SavingsPoolSummary): ReportPool {
  const allocated = summary.allocations.reduce((total, allocation) => total + allocation.amount, 0);
  return {
    pool: summary.pool,
    items: summary.allocations.map((allocation) => ({
      name: allocation.item.name,
      percent: Number(allocation.item.percent) || 0,
      amount: allocation.amount
    })),
    allocatedPercent: summary.allocatedPercent,
    allocated,
    unallocatedPercent: summary.unallocatedPercent,
    unallocated: summary.unallocatedAmount
  };
}

/**
 * Language-neutral report model of the active scenarios. Totals match
 * {@link calculateBudgetSummary}: settlement entries are excluded because they only move money between people.
 */
export function buildBudgetReport(data: BudgetData): BudgetReport {
  const summary = calculateBudgetSummary(data);
  const sharedScenario = getActiveScenario(data.sharedExpenses);
  const sharedEntries = (sharedScenario?.entries ?? []).filter((entry) => !entry.isSettlement);

  const base = data.people.map((person) => {
    const incomeScenario = getActiveScenario(data.incomeByPerson[person.id]);
    const expenseScenario = getActiveScenario(data.personalExpensesByPerson[person.id]);
    const incomeEntries = visibleEntries(incomeScenario?.entries ?? []);
    const personalExpenseEntries = visibleEntries(expenseScenario?.entries ?? []);
    const assetEntries = visibleEntries(data.assetsByPerson[person.id] ?? []);
    const income = entriesTotal(incomeEntries);
    const personalExpenses = entriesTotal(personalExpenseEntries);
    const sharedPaid = entriesTotal(sharedEntries.filter((entry) => entry.personId === person.id));
    return {
      person,
      incomeScenario: incomeScenario?.name ?? '',
      expenseScenario: expenseScenario?.name ?? '',
      incomeEntries,
      income,
      assetEntries,
      assets: entriesTotal(assetEntries),
      personalExpenseEntries,
      personalExpenses,
      sharedPaid,
      remaining: income - personalExpenses - sharedPaid
    };
  });

  const remainingByPerson: Record<PersonId, number> = {};
  base.forEach((row) => {
    remainingByPerson[row.person.id] = row.remaining;
  });
  const plan = calculateSavingsPlan(data.people, remainingByPerson, data.personalSavingsByPerson, data.sharedSavings);
  const sharedSavings = toPool(plan.shared);
  const sharedAllocatedRatio = sharedSavings.pool > 0 ? sharedSavings.allocated / sharedSavings.pool : 0;

  const people = base.map((row, index): ReportPerson => {
    const savings = plan.people[index];
    const personalSavings = toPool(savings);
    const sharedSavingsAllocated = savings.sharedContribution * sharedAllocatedRatio;
    const savingsAllocated = personalSavings.allocated + sharedSavingsAllocated;
    return {
      person: row.person,
      incomeScenario: row.incomeScenario,
      incomeEntries: row.incomeEntries,
      income: row.income,
      assetEntries: row.assetEntries,
      assets: row.assets,
      expenseScenario: row.expenseScenario,
      personalExpenseEntries: row.personalExpenseEntries,
      personalExpenses: row.personalExpenses,
      sharedPaid: row.sharedPaid,
      remainingBeforeSavings: row.remaining,
      sharedContributionPercent: data.personalSavingsByPerson[row.person.id]?.sharedContributionPercent ?? 0,
      sharedContribution: savings.sharedContribution,
      personalSavings,
      sharedSavingsAllocated,
      savingsAllocated,
      netRemaining: row.remaining - savingsAllocated
    };
  });

  const { method, customPercentByPerson } = data.contributionSettings;
  const contributions = calculateContributions(
    data.people,
    data.incomeByPerson,
    data.personalExpensesByPerson,
    data.sharedExpenses,
    method,
    customPercentByPerson
  );

  return {
    people,
    totalIncome: summary.totalIncome,
    totalAssets: summary.assets,
    totalIncomeWithAssets: summary.netWorth,
    sharedScenario: sharedScenario?.name ?? '',
    sharedEntries: sharedEntries.map(({ name, amount, personId }: SharedExpenseEntry): ReportSharedEntry => ({
      name,
      amount: Number(amount) || 0,
      personId
    })),
    sharedExpenses: summary.sharedExpenses,
    totalPersonalExpenses: summary.totalPersonalExpenses,
    totalExpenses: summary.totalExpenses,
    sharedSavings,
    totalSavingsAllocated: summary.totalSavingsAllocated,
    totalSavingsUnallocated: summary.totalSavingsUnallocated,
    netRemaining: summary.remainingAfterSavings,
    contributionMethod: method,
    contributions: contributions.rows.map((contribution) => ({
      person: contribution.person,
      contribution,
      personalExpenses: people.find((row) => row.person.id === contribution.person.id)?.personalExpenses ?? 0
    })),
    contributionSharedTotal: contributions.totalSharedExpenses
  };
}
