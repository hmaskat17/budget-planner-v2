import { describe, expect, it } from 'vitest';
import {
  calculateContributions,
  calculateHouseholdTotals,
  calculateProportionalContributions,
  calculateRemainingBalances,
  calculateSavingsAllocation,
  calculateSavingsPlan,
  calculateSavingsPool
} from '../index.js';
import type { Entry, Person, ScenarioState, SharedExpenseEntry } from './models.js';

const people: Person[] = [
  { id: 'person-1', name: 'Alex' },
  { id: 'person-2', name: 'Sam' }
];

function state<TEntry extends Entry>(entries: TEntry[]): ScenarioState<TEntry> {
  return { activeScenarioId: 'active', scenarios: [{ id: 'active', name: 'Current', entries }] };
}

describe('household calculations', () => {
  it('aggregates active scenario totals and excludes settlements from base totals', () => {
    const totals = calculateHouseholdTotals({
      people,
      incomeByPerson: {
        'person-1': state([{ name: 'Salary', amount: 1000 }, { name: 'Settlement', amount: 25, isSettlement: true }]),
        'person-2': state([{ name: 'Salary', amount: 500 }])
      },
      personalExpensesByPerson: {
        'person-1': state([{ name: 'Transport', amount: 100 }, { name: 'Settlement', amount: 10, isSettlement: true }]),
        'person-2': state([{ name: 'Phone', amount: 50 }])
      },
      sharedExpenses: state<SharedExpenseEntry>([
        { name: 'Rent', amount: 300, personId: 'person-1' },
        { name: 'Utilities', amount: 100, personId: 'person-2' }
      ]),
      assetsByPerson: {
        'person-1': [{ name: 'Savings', amount: 20 }, { name: 'Settlement', amount: 5, isSettlement: true }],
        'person-2': []
      }
    });

    expect(totals).toEqual({
      income: 1525,
      baseIncome: 1500,
      personalExpenses: 160,
      basePersonalExpenses: 150,
      sharedExpenses: 400,
      baseSharedExpenses: 400,
      assets: 25,
      baseAssets: 20
    });
  });

  it('calculates remaining balances using the shared expenses paid by each person', () => {
    const balances = calculateRemainingBalances(
      people,
      {
        'person-1': state([{ name: 'Salary', amount: 1000 }]),
        'person-2': state([{ name: 'Salary', amount: 500 }])
      },
      {
        'person-1': state([{ name: 'Personal', amount: 100 }]),
        'person-2': state([{ name: 'Personal', amount: 600 }])
      },
      state<SharedExpenseEntry>([
        { name: 'Rent', amount: 300, personId: 'person-1' },
        { name: 'Utilities', amount: 100, personId: 'person-2' }
      ])
    );

    expect(balances.rows.map(({ remaining }) => remaining)).toEqual([600, -200]);
    expect(balances.householdTotal).toBe(400);
  });

  it('calculates proportional shares from settlement-free income and handles zero income evenly', () => {
    const contributions = calculateProportionalContributions(
      people,
      {
        'person-1': state([{ name: 'Salary', amount: 1000 }, { name: 'Settlement', amount: 50, isSettlement: true }]),
        'person-2': state([{ name: 'Salary', amount: 500 }])
      },
      state<SharedExpenseEntry>([
        { name: 'Rent', amount: 600, personId: 'person-1' },
        { name: 'Utilities', amount: 100, personId: 'person-2' }
      ])
    );
    expect(contributions.totalIncome).toBe(1500);
    expect(contributions.rows[0].percent).toBeCloseTo(200 / 3);
    expect(contributions.rows[1].percent).toBeCloseTo(100 / 3);
    expect(contributions.rows[0].balance).toBeCloseTo(-400 / 3);
    expect(contributions.rows[1].balance).toBeCloseTo(400 / 3);

    const noIncome = calculateProportionalContributions(
      people,
      { 'person-1': state([]), 'person-2': state([]) },
      state<SharedExpenseEntry>([{ name: 'Rent', amount: 100, personId: 'person-1' }])
    );
    expect(noIncome.rows.map(({ percent, share }) => [percent, share])).toEqual([[50, 50], [50, 50]]);
  });

  it('calculates equal, equal-leftover, custom, and pooled contributions', () => {
    const incomeByPerson = {
      'person-1': state([{ name: 'Salary', amount: 3000 }, { name: 'Settlement', amount: 100, isSettlement: true }]),
      'person-2': state([{ name: 'Salary', amount: 1500 }])
    };
    const personalExpensesByPerson = {
      'person-1': state([{ name: 'Phone', amount: 500 }]),
      'person-2': state([{ name: 'Transport', amount: 200 }])
    };
    const sharedExpenses = state<SharedExpenseEntry>([
      { name: 'Rent', amount: 900, personId: 'person-1' }
    ]);

    const equal = calculateContributions(people, incomeByPerson, personalExpensesByPerson, sharedExpenses, 'equal');
    expect(equal.rows.map(({ percent, share, balance }) => [percent, share, balance]))
      .toEqual([[50, 450, -450], [50, 450, 450]]);

    const equalLeftover = calculateContributions(
      people,
      incomeByPerson,
      personalExpensesByPerson,
      sharedExpenses,
      'equal-leftover'
    );
    expect(equalLeftover.rows.map(({ share, balance }) => [share, balance])).toEqual([[1050, 150], [-150, -150]]);

    const custom = calculateContributions(
      people,
      incomeByPerson,
      personalExpensesByPerson,
      sharedExpenses,
      'custom',
      { 'person-1': 70, 'person-2': 30 }
    );
    expect(custom.rows.map(({ percent, share }) => [percent, share])).toEqual([[70, 630], [30, 270]]);

    const pooled = calculateContributions(
      people,
      incomeByPerson,
      personalExpensesByPerson,
      sharedExpenses,
      'fully-pooled'
    );
    expect(pooled).toEqual({ rows: [], totalIncome: 4500, totalSharedExpenses: 900 });
  });
});

describe('savings calculations', () => {
  it('keeps contributions and personal savings pools non-negative', () => {
    expect(calculateSavingsPool(200, 25)).toEqual({ contribution: 50, personalPool: 150 });
    expect(calculateSavingsPool(-20, 50)).toEqual({ contribution: 0, personalPool: 0 });
  });

  it('reports unallocated amounts and over-allocation without changing item percentages', () => {
    const items = [
      { id: 'a', name: 'Emergency', percent: 60 },
      { id: 'b', name: 'Travel', percent: 50 }
    ];
    expect(calculateSavingsAllocation(200, items)).toEqual({
      pool: 200,
      allocations: [{ item: items[0], amount: 120 }, { item: items[1], amount: 100 }],
      allocatedPercent: 110,
      unallocatedPercent: 0,
      unallocatedAmount: 0,
      isOverallocated: true
    });
    expect(calculateSavingsAllocation(-10, []).pool).toBe(0);
  });

  it('pools positive shared contributions and allocates the shared savings pool', () => {
    const plan = calculateSavingsPlan(
      people,
      { 'person-1': 100, 'person-2': -20 },
      {
        'person-1': { sharedContributionPercent: 10, items: [{ id: 'a', name: 'Goal', percent: 50 }] },
        'person-2': { sharedContributionPercent: 80, items: [] }
      },
      { items: [{ id: 'shared', name: 'Household', percent: 75 }] }
    );
    expect(plan.sharedPool).toBe(10);
    expect(plan.people.map(({ sharedContribution, personalPool }) => [sharedContribution, personalPool]))
      .toEqual([[10, 90], [0, 0]]);
    expect(plan.shared.allocations[0].amount).toBe(7.5);
    expect(plan.shared.unallocatedAmount).toBe(2.5);
  });
});