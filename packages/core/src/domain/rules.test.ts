import { describe, expect, it } from 'vitest';
import {
  addPerson,
  addScenario,
  createScenario,
  isEntry,
  removeEntry,
  removePerson,
  removeScenario,
  renamePerson,
  renameScenario,
  validateBudgetData,
  validatePeople,
  validateScenarioState
} from '../index.js';
import type { Entry, Person, ScenarioState } from './models.js';

const onePerson: Person = { id: 'person-1', name: 'Alex' };
const twoPeople: Person[] = [onePerson, { id: 'person-2', name: 'Sam' }];

function scenarioState<TEntry extends Entry = Entry>(entries: TEntry[] = []): ScenarioState<TEntry> {
  return {
    activeScenarioId: 'current',
    scenarios: [{ id: 'current', name: 'Current', entries }]
  };
}

describe('person validation and rules', () => {
  it('requires one or two people with unique ids and non-empty names', () => {
    expect(validatePeople([onePerson])).toEqual([]);
    expect(validatePeople(twoPeople)).toEqual([]);
    expect(validatePeople([]).map(({ code }) => code)).toContain('invalid-count');
    expect(validatePeople([...twoPeople, { id: 'person-3', name: 'Taylor' }]).map(({ code }) => code))
      .toContain('invalid-count');
    expect(validatePeople([onePerson, { ...onePerson, name: 'Other' }]).map(({ code }) => code))
      .toContain('duplicate');
    expect(validatePeople([{ id: 'person-1', name: '  ' }]).map(({ code }) => code))
      .toContain('required');
  });

  it('adds up to the household limit and preserves valid state on rejection', () => {
    const added = addPerson([onePerson], { id: 'person-2', name: ' Sam ' });
    expect(added.issues).toEqual([]);
    expect(added.people).toEqual(twoPeople);

    const rejected = addPerson(added.people, { id: 'person-3', name: 'Taylor' });
    expect(rejected.people).toEqual(twoPeople);
    expect(rejected.issues.map(({ code }) => code)).toContain('invalid-count');
  });

  it('trims renamed names and refuses blank names or removal of the last person', () => {
    expect(renamePerson([onePerson], onePerson.id, '  Alex Morgan  ').people[0].name)
      .toBe('Alex Morgan');
    expect(renamePerson([onePerson], onePerson.id, ' ').issues.map(({ code }) => code))
      .toContain('required');
    expect(removePerson([onePerson], onePerson.id).people).toEqual([onePerson]);
    expect(removePerson([onePerson], onePerson.id).issues.map(({ code }) => code))
      .toContain('minimum-count');
    expect(removePerson(twoPeople, onePerson.id).people).toEqual([twoPeople[1]]);
  });
});

describe('scenario validation and rules', () => {
  it('rejects missing active scenarios and non-finite entry amounts', () => {
    expect(validateScenarioState({ activeScenarioId: 'missing', scenarios: [] }).length).toBeGreaterThan(0);
    expect(isEntry({ name: 'Income', amount: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isEntry({ name: 'Income', amount: '100' })).toBe(false);
    expect(isEntry({ name: 'Income', amount: 100 })).toBe(true);
  });

  it('keeps at least one scenario and chooses a remaining active scenario after deletion', () => {
    const first = createScenario('first', 'First', [{ name: 'Rent', amount: 50 }]);
    const second = createScenario('second', 'Second', [{ name: 'Food', amount: 25 }]);
    const state: ScenarioState = { activeScenarioId: 'first', scenarios: [first, second] };
    const rejected = removeScenario(state, 'first');
    expect(rejected.activeScenarioId).toBe('second');
    expect(rejected.scenarios.map(({ id }) => id)).toEqual(['second']);
    expect(removeScenario(rejected, 'second')).toBe(rejected);
    expect(addScenario(state, second)).toBe(state);
    expect(renameScenario(state, 'first', '   ')).toBe(state);
  });

  it('validates references from shared expenses back to household people', () => {
    const budget = {
      people: [onePerson],
      incomeByPerson: { [onePerson.id]: scenarioState([{ name: 'Salary', amount: 100 }]) },
      personalExpensesByPerson: { [onePerson.id]: scenarioState() },
      sharedExpenses: scenarioState([{ name: 'Rent', amount: 30, personId: 'unknown' }]),
      assetsByPerson: { [onePerson.id]: [] },
      personalSavingsByPerson: { [onePerson.id]: { sharedContributionPercent: 0, items: [] } },
      sharedSavings: { items: [] },
      contributionSettings: { method: 'proportional', customPercentByPerson: { [onePerson.id]: 100 } }
    };
    expect(validateBudgetData(budget).map(({ code }) => code)).toContain('unknown-person');
    expect(
      validateBudgetData({
        ...budget,
        contributionSettings: { method: 'custom', customPercentByPerson: { [onePerson.id]: 75 } }
      }).map(({ code }) => code)
    ).toContain('invalid-total');
  });

  it('does not remove the final required entry when a minimum is configured', () => {
    const scenario = createScenario('only', 'Only', [{ name: 'Salary', amount: 100 }]);
    expect(removeEntry(scenario, 0, 1)).toBe(scenario);
  });
});