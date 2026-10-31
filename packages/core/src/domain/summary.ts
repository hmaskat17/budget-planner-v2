import type { BudgetData, ContributionMethod, Person, PersonId } from './models.js';
import {
  calculateContributions,
  calculateSavingsPlan,
  entriesTotal,
  scenarioTotal
} from './calculations.js';
import { getActiveScenario } from './scenarios.js';

export interface SummaryPersonRow {
  person: Person;
  income: number;
  personalExpenses: number;
  /** Personal savings allocated from this person's own pool. */
  savingsAllocated: number;
}

export interface SummaryContributionRow {
  person: Person;
  percent: number;
  share: number;
}

export interface BudgetSummary {
  people: SummaryPersonRow[];
  totalIncome: number;
  assets: number;
  /** Informational only: income plus assets. Never used in remaining balances. */
  netWorth: number;
  sharedExpenses: number;
  totalPersonalExpenses: number;
  totalExpenses: number;
  remainingBeforeSavings: number;
  sharedSavingsAllocated: number;
  totalSavingsAllocated: number;
  totalSavingsUnallocated: number;
  remainingAfterSavings: number;
  contributionMethod: ContributionMethod;
  /** Empty for the fully-pooled method. */
  contributions: SummaryContributionRow[];
}

/**
 * Settlement-free household summary: applied settlements move money between people
 * but never change household totals, so they are excluded here.
 */
export function calculateBudgetSummary(data: BudgetData): BudgetSummary {
  const sharedScenario = getActiveScenario(data.sharedExpenses);
  const sharedEntries = (sharedScenario?.entries ?? []).filter((entry) => !entry.isSettlement);

  const rows = data.people.map((person) => {
    const income = scenarioTotal(getActiveScenario(data.incomeByPerson[person.id]), true);
    const personalExpenses = scenarioTotal(getActiveScenario(data.personalExpensesByPerson[person.id]), true);
    const sharedPaid = entriesTotal(sharedEntries.filter((entry) => entry.personId === person.id));
    return { person, income, personalExpenses, remaining: income - personalExpenses - sharedPaid };
  });

  const remainingByPerson: Record<PersonId, number> = {};
  rows.forEach((row) => {
    remainingByPerson[row.person.id] = row.remaining;
  });

  const plan = calculateSavingsPlan(data.people, remainingByPerson, data.personalSavingsByPerson, data.sharedSavings);
  const allocated = (pool: { allocations: { amount: number }[] }) =>
    pool.allocations.reduce((total, allocation) => total + allocation.amount, 0);

  const personSavings = plan.people.map((summary) => allocated(summary));
  const sharedSavingsAllocated = allocated(plan.shared);
  const totalSavingsAllocated = personSavings.reduce((total, amount) => total + amount, sharedSavingsAllocated);
  const totalSavingsUnallocated =
    plan.people.reduce((total, summary) => total + summary.unallocatedAmount, 0) + plan.shared.unallocatedAmount;

  const totalIncome = rows.reduce((total, row) => total + row.income, 0);
  const totalPersonalExpenses = rows.reduce((total, row) => total + row.personalExpenses, 0);
  const sharedExpenses = entriesTotal(sharedEntries);
  const totalExpenses = totalPersonalExpenses + sharedExpenses;
  const remainingBeforeSavings = totalIncome - totalExpenses;
  const assets = data.people.reduce(
    (total, person) => total + entriesTotal(data.assetsByPerson[person.id] ?? [], true),
    0
  );

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
    people: rows.map((row, index) => ({
      person: row.person,
      income: row.income,
      personalExpenses: row.personalExpenses,
      savingsAllocated: personSavings[index]
    })),
    totalIncome,
    assets,
    netWorth: totalIncome + assets,
    sharedExpenses,
    totalPersonalExpenses,
    totalExpenses,
    remainingBeforeSavings,
    sharedSavingsAllocated,
    totalSavingsAllocated,
    totalSavingsUnallocated,
    remainingAfterSavings: remainingBeforeSavings - totalSavingsAllocated,
    contributionMethod: method,
    contributions: contributions.rows.map((row) => ({ person: row.person, percent: row.percent, share: row.share }))
  };
}
