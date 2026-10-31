import { describe, expect, it } from 'vitest';
import { calculateBudgetSummary } from '../index.js';
import type { BudgetData, Entry, ScenarioState, SharedExpenseEntry } from './models.js';

function state<TEntry extends Entry>(entries: TEntry[]): ScenarioState<TEntry> {
  return { activeScenarioId: 'active', scenarios: [{ id: 'active', name: 'Current', entries }] };
}

function makeData(overrides: Partial<BudgetData> = {}): BudgetData {
  return {
    people: [
      { id: 'p1', name: 'Alex' },
      { id: 'p2', name: 'Sam' }
    ],
    incomeByPerson: {
      p1: state([{ name: 'Salary', amount: 3000 }]),
      p2: state([{ name: 'Salary', amount: 1500 }])
    },
    personalExpensesByPerson: {
      p1: state([{ name: 'Phone', amount: 200 }]),
      p2: state([{ name: 'Gym', amount: 100 }])
    },
    sharedExpenses: state<SharedExpenseEntry>([{ name: 'Rent', amount: 900, personId: 'p1' }]),
    assetsByPerson: { p1: [{ name: 'Cash', amount: 1000 }], p2: [] },
    personalSavingsByPerson: {
      p1: { sharedContributionPercent: 50, items: [{ id: 'a', name: 'Trip', percent: 50 }] },
      p2: { sharedContributionPercent: 0, items: [{ id: 'b', name: 'Fund', percent: 100 }] }
    },
    sharedSavings: { items: [{ id: 'c', name: 'House', percent: 25 }] },
    contributionSettings: { method: 'proportional', customPercentByPerson: {} },
    ...overrides
  };
}

describe('calculateBudgetSummary', () => {
  it('builds the income, expense, savings and remaining flow', () => {
    const s = calculateBudgetSummary(makeData());
    expect(s.totalIncome).toBe(4500);
    expect(s.netWorth).toBe(5500);
    expect(s.totalExpenses).toBe(1200);
    expect(s.remainingBeforeSavings).toBe(3300);
    // p1 remaining 1900 -> shared 950, personal pool 950 -> 475 allocated
    // p2 remaining 1400 -> personal pool 1400 -> 1400 allocated
    // shared pool 950 -> 25% = 237.5
    expect(s.people.map((p) => p.savingsAllocated)).toEqual([475, 1400]);
    expect(s.sharedSavingsAllocated).toBe(237.5);
    expect(s.totalSavingsAllocated).toBe(2112.5);
    expect(s.totalSavingsUnallocated).toBe(475 + 0 + 712.5);
    expect(s.remainingAfterSavings).toBe(3300 - 2112.5);
    expect(s.contributions.map((c) => Math.round(c.percent))).toEqual([67, 33]);
  });

  it('ignores settlements', () => {
    const base = calculateBudgetSummary(makeData());
    const settled = calculateBudgetSummary(
      makeData({
        incomeByPerson: {
          p1: state([{ name: 'Salary', amount: 3000 }, { name: 'Settlement', amount: 100, isSettlement: true }]),
          p2: state([{ name: 'Salary', amount: 1500 }])
        }
      })
    );
    expect(settled.totalIncome).toBe(base.totalIncome);
  });

  it('reports a negative remaining on shortfall and no rows when fully pooled', () => {
    const s = calculateBudgetSummary(
      makeData({
        sharedExpenses: state<SharedExpenseEntry>([{ name: 'Rent', amount: 6000, personId: 'p1' }]),
        contributionSettings: { method: 'fully-pooled', customPercentByPerson: {} }
      })
    );
    expect(s.remainingBeforeSavings).toBe(4500 - 300 - 6000);
    expect(s.contributions).toEqual([]);
  });
});
