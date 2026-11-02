import { describe, expect, it } from 'vitest';
import {
  addPersonToBudget,
  applySettlementsToBudget,
  createDefaultBudgetData,
  isSettlementApplied,
  normalizeBudgetData,
  removePersonFromBudget,
  removeSettlementsFromBudget,
  renamePersonInBudget,
  setContributionMethod,
  setCustomContributionPercent
} from './budget-state.ts';
import { generateSampleBudget } from './sample-data.ts';
import { addGoal, parseAmount, removeGoal, updateGoalPercent } from './savings-goals.ts';

describe('budget state', () => {
  it('creates a normalized default budget', () => {
    const data = createDefaultBudgetData('Person 1');
    expect(data.people).toEqual([{ id: 'person-1', name: 'Person 1' }]);
    expect(data.incomeByPerson['person-1'].scenarios).toHaveLength(1);
    expect(data.contributionSettings.customPercentByPerson).toEqual({ 'person-1': 100 });
  });

  it('adds and removes a person with their data', () => {
    const base = createDefaultBudgetData('A');
    const two = addPersonToBudget(base, 'B')!;
    expect(two.people.map((p) => p.id)).toEqual(['person-1', 'person-2']);
    expect(two.contributionSettings.customPercentByPerson).toEqual({ 'person-1': 50, 'person-2': 50 });
    expect(two.personalSavingsByPerson['person-2']).toEqual({ sharedContributionPercent: 0, items: [] });
    expect(addPersonToBudget(two, 'C')).toBeUndefined();

    const shared = {
      ...two,
      sharedExpenses: {
        ...two.sharedExpenses,
        scenarios: [{ ...two.sharedExpenses.scenarios[0], entries: [{ name: 'Rent', amount: 10, personId: 'person-2' }] }]
      }
    };
    const one = removePersonFromBudget(shared, 'person-2')!;
    expect(one.incomeByPerson['person-2']).toBeUndefined();
    expect(one.sharedExpenses.scenarios[0].entries[0].personId).toBe('person-1');
    expect(one.contributionSettings.customPercentByPerson).toEqual({ 'person-1': 100 });
    expect(removePersonFromBudget(one, 'person-1')).toBeUndefined();
  });

  it('renames a person and rejects invalid names', () => {
    const base = createDefaultBudgetData('A');
    expect(renamePersonInBudget(base, 'person-1', 'Alex')!.people[0].name).toBe('Alex');
    expect(renamePersonInBudget(base, 'person-1', '   ')).toBeUndefined();
  });

  it('normalizes missing person data and prunes stale contribution entries', () => {
    const base = createDefaultBudgetData('A');
    const data = normalizeBudgetData({
      ...base,
      incomeByPerson: {},
      contributionSettings: { method: 'equal', customPercentByPerson: { ghost: 40 } }
    });
    expect(data.incomeByPerson['person-1']).toBeDefined();
    expect(data.contributionSettings.customPercentByPerson).toEqual({ 'person-1': 100 });
  });

  it('bounds and rebalances custom contribution percent', () => {
    const two = addPersonToBudget(createDefaultBudgetData('A'), 'B')!;
    expect(setCustomContributionPercent(two, 'person-1', 130)!.contributionSettings.customPercentByPerson).toEqual({
      'person-1': 100,
      'person-2': 0
    });
    expect(setCustomContributionPercent(two, 'person-1', Number.NaN)).toBeUndefined();
    expect(setCustomContributionPercent(two, 'nobody', 10)).toBeUndefined();
  });

  it('removes applied settlements when contribution settings change', () => {
    let data = addPersonToBudget(createDefaultBudgetData('A'), 'B')!;
    data = {
      ...data,
      incomeByPerson: {
        ...data.incomeByPerson,
        'person-1': {
          ...data.incomeByPerson['person-1'],
          scenarios: [{ ...data.incomeByPerson['person-1'].scenarios[0], entries: [{ name: 'Salary', amount: 3000 }] }]
        }
      },
      sharedExpenses: {
        ...data.sharedExpenses,
        scenarios: [{ ...data.sharedExpenses.scenarios[0], entries: [{ name: 'Rent', amount: 1000, personId: 'person-1' }] }]
      }
    };
    const settled = applySettlementsToBudget(setContributionMethod(data, 'equal'));
    expect(isSettlementApplied(settled)).toBe(true);
    expect(isSettlementApplied(setContributionMethod(settled, 'proportional'))).toBe(false);
    expect(isSettlementApplied(removeSettlementsFromBudget(settled))).toBe(false);
  });

  it('generates normalized-compatible sample data', () => {
    const sample = generateSampleBudget();
    expect(normalizeBudgetData(sample).people).toEqual(sample.people);
  });
});

describe('savings goals', () => {
  it('adds, updates and removes goals', () => {
    const added = addGoal({ items: [] });
    expect(added.items).toHaveLength(1);
    expect(updateGoalPercent(added, 0, '25').items[0].percent).toBe(25);
    expect(removeGoal(added, 0).items).toEqual([]);
  });

  it('parses invalid amounts as 0', () => {
    expect(parseAmount('abc')).toBe(0);
    expect(parseAmount('12.5')).toBe(12.5);
  });
});
