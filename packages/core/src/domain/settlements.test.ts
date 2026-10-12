import { describe, expect, it } from 'vitest';
import {
  applySettlementAdjustments,
  hasSettlement,
  removeSettlementAdjustments
} from '../index.js';
import type { Person, ScenarioState } from './models.js';

const alex: Person = { id: 'alex', name: 'Alex' };
const sam: Person = { id: 'sam', name: 'Sam' };

function state(entries: ScenarioState['scenarios'][number]['entries'] = []): ScenarioState {
  return { activeScenarioId: 'active', scenarios: [{ id: 'active', name: 'Current', entries }] };
}

describe('settlement adjustments', () => {
  it('records amounts owed in expenses and amounts owed back in income without mutating input', () => {
    const incomeByPerson = { alex: state([{ name: 'Salary', amount: 1000 }]), sam: state([{ name: 'Salary', amount: 500 }]) };
    const personalExpensesByPerson = { alex: state([{ name: 'Food', amount: 100 }]), sam: state([]) };
    const rows = [
      { person: alex, income: 1000, percent: 2 / 3 * 100, share: 200, paid: 100, balance: 100 },
      { person: sam, income: 500, percent: 1 / 3 * 100, share: 100, paid: 200, balance: -100 }
    ];

    const updated = applySettlementAdjustments(incomeByPerson, personalExpensesByPerson, rows);

    expect(updated.personalExpensesByPerson.alex.scenarios[0].entries).toEqual([
      { name: 'Food', amount: 100 },
      { name: 'Shared expense settlement', amount: 100, isSettlement: true }
    ]);
    expect(updated.incomeByPerson.sam.scenarios[0].entries).toEqual([
      { name: 'Salary', amount: 500 },
      { name: 'Shared expense settlement', amount: 100, isSettlement: true }
    ]);
    expect(incomeByPerson.sam.scenarios[0].entries).toEqual([{ name: 'Salary', amount: 500 }]);
    expect(personalExpensesByPerson.alex.scenarios[0].entries).toEqual([{ name: 'Food', amount: 100 }]);
    expect(hasSettlement(updated.personalExpensesByPerson.alex)).toBe(true);
    expect(hasSettlement(updated.incomeByPerson.sam)).toBe(true);
  });

  it('replaces prior adjustments, rounds to cents, and removes balances within the threshold', () => {
    const incomeByPerson = { alex: state([{ name: 'Salary', amount: 1000 }]) };
    const personalExpensesByPerson = {
      alex: state([
        { name: 'Food', amount: 100 },
        { name: 'Old settlement', amount: 25, isSettlement: true }
      ])
    };
    const updated = applySettlementAdjustments(incomeByPerson, personalExpensesByPerson, [
      { person: alex, income: 1000, percent: 100, share: 125, paid: 0, balance: 25.126 },
      { person: sam, income: 0, percent: 0, share: 0, paid: 0, balance: 0.005 }
    ]);

    const entries = updated.personalExpensesByPerson.alex.scenarios[0].entries;
    expect(entries.filter(({ isSettlement }) => isSettlement)).toEqual([
      { name: 'Shared expense settlement', amount: 25.13, isSettlement: true }
    ]);
    expect(hasSettlement(updated.incomeByPerson.alex)).toBe(false);
  });

  it('removes settlement entries while preserving ordinary entries', () => {
    const incomeByPerson = {
      alex: state([{ name: 'Salary', amount: 1000 }, { name: 'Settlement', amount: 40, isSettlement: true }])
    };
    const personalExpensesByPerson = {
      alex: state([{ name: 'Food', amount: 100 }, { name: 'Settlement', amount: 40, isSettlement: true }])
    };

    const updated = removeSettlementAdjustments(incomeByPerson, personalExpensesByPerson);

    expect(updated.incomeByPerson.alex.scenarios[0].entries).toEqual([{ name: 'Salary', amount: 1000 }]);
    expect(updated.personalExpensesByPerson.alex.scenarios[0].entries).toEqual([{ name: 'Food', amount: 100 }]);
    expect(hasSettlement(updated.incomeByPerson.alex)).toBe(false);
  });
});