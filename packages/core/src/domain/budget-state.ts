import type {
  BudgetData,
  ContributionMethod,
  Entry,
  Person,
  PersonSavingsData,
  Scenario,
  ScenarioState,
  SharedExpenseEntry
} from './models.js';
import { addPerson, canAddPerson, removePerson, renamePerson } from './persons.js';
import { createDefaultScenario } from './scenarios.js';
import { calculateContributions } from './calculations.js';
import { applySettlementAdjustments, removeSettlementAdjustments } from './settlements.js';
import { createId } from './utils.js';

export function createDefaultPersonScenario(): ScenarioState {
  const scenario = createDefaultScenario(createId('scenario'));
  return { activeScenarioId: scenario.id, scenarios: [scenario] };
}

export function createDefaultSharedExpenseScenario(): Scenario<SharedExpenseEntry> {
  return { id: createId('scenario'), name: 'Default', entries: [] };
}

export function createDefaultSharedScenario(): ScenarioState<SharedExpenseEntry> {
  const scenario = createDefaultSharedExpenseScenario();
  return { activeScenarioId: scenario.id, scenarios: [scenario] };
}

export function createDefaultPersonSavings(): PersonSavingsData {
  return { sharedContributionPercent: 0, items: [] };
}

export function equalPercentByPerson(people: readonly Person[]): Record<string, number> {
  return Object.fromEntries(people.map(({ id }) => [id, 100 / people.length]));
}

export function createDefaultBudgetData(firstPersonName: string): BudgetData {
  return normalizeBudgetData({
    people: [{ id: 'person-1', name: firstPersonName }],
    incomeByPerson: {},
    personalExpensesByPerson: {},
    sharedExpenses: createDefaultSharedScenario(),
    assetsByPerson: {},
    personalSavingsByPerson: {},
    sharedSavings: { items: [] },
    contributionSettings: { method: 'proportional', customPercentByPerson: {} }
  });
}

/** Ensures every person has baseline data and drops contribution entries of removed people. */
export function normalizeBudgetData(data: BudgetData): BudgetData {
  const incomeByPerson = { ...data.incomeByPerson };
  const personalExpensesByPerson = { ...data.personalExpensesByPerson };
  const assetsByPerson = { ...data.assetsByPerson };
  const personalSavingsByPerson = { ...data.personalSavingsByPerson };
  const customPercentByPerson = { ...data.contributionSettings.customPercentByPerson };

  for (const { id } of data.people) {
    incomeByPerson[id] ??= createDefaultPersonScenario();
    personalExpensesByPerson[id] ??= createDefaultPersonScenario();
    assetsByPerson[id] ??= [];
    personalSavingsByPerson[id] ??= createDefaultPersonSavings();
    customPercentByPerson[id] ??= 100 / data.people.length;
  }
  for (const personId of Object.keys(customPercentByPerson)) {
    if (!data.people.some(({ id }) => id === personId)) {
      delete customPercentByPerson[personId];
    }
  }

  return {
    ...data,
    incomeByPerson,
    personalExpensesByPerson,
    assetsByPerson,
    personalSavingsByPerson,
    contributionSettings: { ...data.contributionSettings, customPercentByPerson }
  };
}

/** Returns the next unused default person id, e.g. `person-2`. */
export function nextPersonId(people: readonly Person[]): string {
  return `person-${people.length + 1}`;
}

/** Returns the new budget, or undefined when the person cannot be added. */
export function addPersonToBudget(data: BudgetData, name: string): BudgetData | undefined {
  if (!canAddPerson(data.people)) {
    return undefined;
  }
  const newPerson: Person = { id: nextPersonId(data.people), name };
  const result = addPerson(data.people, newPerson);
  if (result.issues.length > 0) {
    return undefined;
  }
  return {
    ...data,
    people: result.people,
    contributionSettings: {
      ...data.contributionSettings,
      customPercentByPerson: equalPercentByPerson(result.people)
    },
    incomeByPerson: { ...data.incomeByPerson, [newPerson.id]: createDefaultPersonScenario() },
    personalExpensesByPerson: { ...data.personalExpensesByPerson, [newPerson.id]: createDefaultPersonScenario() },
    assetsByPerson: { ...data.assetsByPerson, [newPerson.id]: [] },
    personalSavingsByPerson: { ...data.personalSavingsByPerson, [newPerson.id]: createDefaultPersonSavings() }
  };
}

/** Returns the new budget, or undefined when the person cannot be removed. */
export function removePersonFromBudget(data: BudgetData, personId: string): BudgetData | undefined {
  const result = removePerson(data.people, personId);
  if (result.issues.length > 0) {
    return undefined;
  }
  const { [personId]: _income, ...incomeByPerson } = data.incomeByPerson;
  const { [personId]: _expenses, ...personalExpensesByPerson } = data.personalExpensesByPerson;
  const { [personId]: _assets, ...assetsByPerson } = data.assetsByPerson;
  const { [personId]: _savings, ...personalSavingsByPerson } = data.personalSavingsByPerson;

  // Shared expenses of the removed person move to the first remaining person
  const remainingFirstId = result.people[0]?.id;
  const scenarios = data.sharedExpenses.scenarios.map((scenario) => ({
    ...scenario,
    entries: scenario.entries.map((entry) =>
      entry.personId === personId ? { ...entry, personId: remainingFirstId } : entry
    )
  }));

  return {
    ...data,
    people: result.people,
    incomeByPerson,
    personalExpensesByPerson,
    assetsByPerson,
    personalSavingsByPerson,
    contributionSettings: {
      ...data.contributionSettings,
      customPercentByPerson: { [result.people[0].id]: 100 }
    },
    sharedExpenses: { ...data.sharedExpenses, scenarios }
  };
}

export function renamePersonInBudget(data: BudgetData, personId: string, name: string): BudgetData | undefined {
  const result = renamePerson(data.people, personId, name);
  return result.issues.length > 0 ? undefined : { ...data, people: result.people };
}

export function updateIncome(data: BudgetData, personId: string, state: ScenarioState): BudgetData {
  return { ...data, incomeByPerson: { ...data.incomeByPerson, [personId]: state } };
}

export function updatePersonalExpenses(data: BudgetData, personId: string, state: ScenarioState): BudgetData {
  return { ...data, personalExpensesByPerson: { ...data.personalExpensesByPerson, [personId]: state } };
}

export function updateSharedExpenses(data: BudgetData, state: ScenarioState<SharedExpenseEntry>): BudgetData {
  return { ...data, sharedExpenses: state };
}

export function updateAssets(data: BudgetData, personId: string, entries: Entry[]): BudgetData {
  return { ...data, assetsByPerson: { ...data.assetsByPerson, [personId]: entries } };
}

export function updatePersonalSavings(data: BudgetData, personId: string, savings: PersonSavingsData): BudgetData {
  return { ...data, personalSavingsByPerson: { ...data.personalSavingsByPerson, [personId]: savings } };
}

export function isSettlementApplied(data: BudgetData): boolean {
  const hasSettlement = (state: ScenarioState | undefined): boolean =>
    state?.scenarios
      .find((scenario) => scenario.id === state.activeScenarioId)
      ?.entries.some((entry) => entry.isSettlement) ?? false;
  return data.people.some(
    ({ id }) => hasSettlement(data.incomeByPerson[id]) || hasSettlement(data.personalExpensesByPerson[id])
  );
}

export function applySettlementsToBudget(data: BudgetData): BudgetData {
  const { rows } = calculateContributions(
    data.people,
    data.incomeByPerson,
    data.personalExpensesByPerson,
    data.sharedExpenses,
    data.contributionSettings.method,
    data.contributionSettings.customPercentByPerson
  );
  const updated = applySettlementAdjustments(data.incomeByPerson, data.personalExpensesByPerson, rows);
  return {
    ...data,
    incomeByPerson: updated.incomeByPerson,
    personalExpensesByPerson: updated.personalExpensesByPerson
  };
}

export function removeSettlementsFromBudget(data: BudgetData): BudgetData {
  const updated = removeSettlementAdjustments(data.incomeByPerson, data.personalExpensesByPerson);
  return {
    ...data,
    incomeByPerson: updated.incomeByPerson,
    personalExpensesByPerson: updated.personalExpensesByPerson
  };
}

/** Changing contribution settings invalidates applied settlements, so they are removed first. */
export function setContributionMethod(data: BudgetData, method: ContributionMethod): BudgetData {
  const base = isSettlementApplied(data) ? removeSettlementsFromBudget(data) : data;
  return { ...base, contributionSettings: { ...base.contributionSettings, method } };
}

export function boundPercent(percent: number): number {
  return Math.round(Math.max(0, Math.min(100, percent)) * 100) / 100;
}

/** Sets one person's custom share; the other person gets the remainder. Returns undefined for invalid input. */
export function setCustomContributionPercent(
  data: BudgetData,
  personId: string,
  percent: number
): BudgetData | undefined {
  if (!Number.isFinite(percent) || !data.people.some(({ id }) => id === personId)) {
    return undefined;
  }
  const bounded = boundPercent(percent);
  const customPercentByPerson =
    data.people.length === 1
      ? { [personId]: 100 }
      : Object.fromEntries(
          data.people.map(({ id }) => [id, id === personId ? bounded : Math.round((100 - bounded) * 100) / 100])
        );
  const base = isSettlementApplied(data) ? removeSettlementsFromBudget(data) : data;
  return { ...base, contributionSettings: { ...base.contributionSettings, customPercentByPerson } };
}
