import type { PersonId, ScenarioState } from './models.js';
import type { ProportionalContributionRow } from './calculations.js';
import { getActiveScenario, removeSettlementEntry, replaceActiveScenario, setSettlementEntry } from './scenarios.js';

export const SETTLEMENT_ENTRY_NAME = 'Shared expense settlement';
const DEFAULT_SETTLEMENT_THRESHOLD = 0.005;

export interface SettlementStateUpdate {
  incomeByPerson: Record<PersonId, ScenarioState>;
  personalExpensesByPerson: Record<PersonId, ScenarioState>;
}

export function hasSettlement(state: ScenarioState | undefined): boolean {
  return getActiveScenario(state)?.entries.some((entry) => entry.isSettlement) ?? false;
}

export function applySettlementAdjustments(
  incomeByPerson: Readonly<Record<PersonId, ScenarioState>>,
  personalExpensesByPerson: Readonly<Record<PersonId, ScenarioState>>,
  rows: readonly ProportionalContributionRow[],
  threshold = DEFAULT_SETTLEMENT_THRESHOLD
): SettlementStateUpdate {
  const nextIncome = { ...incomeByPerson };
  const nextExpenses = { ...personalExpensesByPerson };

  rows.forEach(({ person, balance }) => {
    const amount = Number(Math.abs(balance).toFixed(2));
    if (balance > threshold) {
      updatePersonSettlement(nextExpenses, person.id, amount);
      updatePersonSettlement(nextIncome, person.id, null);
    } else if (balance < -threshold) {
      updatePersonSettlement(nextIncome, person.id, amount);
      updatePersonSettlement(nextExpenses, person.id, null);
    } else {
      updatePersonSettlement(nextIncome, person.id, null);
      updatePersonSettlement(nextExpenses, person.id, null);
    }
  });

  return { incomeByPerson: nextIncome, personalExpensesByPerson: nextExpenses };
}

export function removeSettlementAdjustments(
  incomeByPerson: Readonly<Record<PersonId, ScenarioState>>,
  personalExpensesByPerson: Readonly<Record<PersonId, ScenarioState>>
): SettlementStateUpdate {
  const nextIncome = { ...incomeByPerson };
  const nextExpenses = { ...personalExpensesByPerson };
  const personIds = new Set([...Object.keys(nextIncome), ...Object.keys(nextExpenses)]);
  personIds.forEach((personId) => {
    updatePersonSettlement(nextIncome, personId, null);
    updatePersonSettlement(nextExpenses, personId, null);
  });
  return { incomeByPerson: nextIncome, personalExpensesByPerson: nextExpenses };
}

function updatePersonSettlement(
  states: Record<PersonId, ScenarioState>,
  personId: PersonId,
  amount: number | null
): void {
  const state = states[personId];
  const activeScenario = getActiveScenario(state);
  if (!state || !activeScenario) {
    return;
  }
  const updatedScenario = amount === null
    ? removeSettlementEntry(activeScenario)
    : setSettlementEntry(activeScenario, amount, SETTLEMENT_ENTRY_NAME);
  states[personId] = replaceActiveScenario(state, updatedScenario);
}