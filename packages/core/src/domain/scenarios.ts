import type { Entry, Scenario, ScenarioState } from './models.js';

export function getActiveScenario<TEntry extends Entry>(
  state: ScenarioState<TEntry> | undefined
): Scenario<TEntry> | undefined {
  return state?.scenarios.find((scenario) => scenario.id === state.activeScenarioId);
}

export function createScenario<TEntry extends Entry = Entry>(
  id: string,
  name = 'Default',
  entries: readonly TEntry[] = []
): Scenario<TEntry> {
  return { id, name, entries: entries.map((entry) => ({ ...entry })) };
}

export function createDefaultScenario(id: string, entry: Entry = { name: '', amount: 0 }): Scenario {
  return createScenario(id, 'Default', [entry]);
}

export function createEmptyScenario(id: string): Scenario {
  return createScenario(id, 'Default');
}

export function addScenario<TEntry extends Entry>(
  state: ScenarioState<TEntry>,
  scenario: Scenario<TEntry>
): ScenarioState<TEntry> {
  if (state.scenarios.some((existing) => existing.id === scenario.id)) {
    return state;
  }
  return {
    activeScenarioId: scenario.id,
    scenarios: [...state.scenarios.map(cloneScenario), cloneScenario(scenario)]
  };
}

export function setActiveScenario<TEntry extends Entry>(
  state: ScenarioState<TEntry>,
  scenarioId: string
): ScenarioState<TEntry> {
  if (!state.scenarios.some((scenario) => scenario.id === scenarioId)) {
    return state;
  }
  return { ...state, activeScenarioId: scenarioId, scenarios: state.scenarios.map(cloneScenario) };
}

export function renameScenario<TEntry extends Entry>(
  state: ScenarioState<TEntry>,
  scenarioId: string,
  name: string
): ScenarioState<TEntry> {
  const normalizedName = name.trim();
  if (!normalizedName || !state.scenarios.some((scenario) => scenario.id === scenarioId)) {
    return state;
  }
  return {
    ...state,
    scenarios: state.scenarios.map((scenario) => scenario.id === scenarioId
      ? { ...cloneScenario(scenario), name: normalizedName }
      : cloneScenario(scenario))
  };
}

export function removeScenario<TEntry extends Entry>(
  state: ScenarioState<TEntry>,
  scenarioId: string
): ScenarioState<TEntry> {
  if (state.scenarios.length <= 1 || !state.scenarios.some((scenario) => scenario.id === scenarioId)) {
    return state;
  }
  const scenarios = state.scenarios
    .filter((scenario) => scenario.id !== scenarioId)
    .map(cloneScenario);
  return {
    activeScenarioId: state.activeScenarioId === scenarioId ? scenarios[0].id : state.activeScenarioId,
    scenarios
  };
}

export function replaceActiveScenario<TEntry extends Entry>(
  state: ScenarioState<TEntry>,
  updatedScenario: Scenario<TEntry>
): ScenarioState<TEntry> {
  if (!state.scenarios.some((scenario) => scenario.id === updatedScenario.id)) {
    return state;
  }
  return {
    ...state,
    scenarios: state.scenarios.map((scenario) => scenario.id === updatedScenario.id
      ? cloneScenario(updatedScenario)
      : cloneScenario(scenario))
  };
}

export function addEntry<TEntry extends Entry>(scenario: Scenario<TEntry>, entry: TEntry): Scenario<TEntry> {
  return { ...cloneScenario(scenario), entries: [...scenario.entries.map(cloneEntry), cloneEntry(entry)] };
}

export function removeEntry<TEntry extends Entry>(
  scenario: Scenario<TEntry>,
  index: number,
  minimumEntries = 0
): Scenario<TEntry> {
  if (!Number.isInteger(index) || index < 0 || index >= scenario.entries.length || scenario.entries.length <= minimumEntries) {
    return scenario;
  }
  return {
    ...cloneScenario(scenario),
    entries: scenario.entries.filter((_, entryIndex) => entryIndex !== index).map(cloneEntry)
  };
}

export function setSettlementEntry(
  scenario: Scenario,
  amount: number,
  name = 'Shared expense settlement'
): Scenario {
  if (!Number.isFinite(amount)) {
    return scenario;
  }
  const firstSettlementIndex = scenario.entries.findIndex((entry) => entry.isSettlement);
  const entries = scenario.entries.filter((entry) => !entry.isSettlement).map(cloneEntry);
  const settlement = { name, amount, isSettlement: true };
  entries.splice(firstSettlementIndex < 0 ? entries.length : Math.min(firstSettlementIndex, entries.length), 0, settlement);
  return { ...scenario, entries };
}

export function removeSettlementEntry(scenario: Scenario): Scenario {
  if (!scenario.entries.some((entry) => entry.isSettlement)) {
    return scenario;
  }
  return { ...scenario, entries: scenario.entries.filter((entry) => !entry.isSettlement).map(cloneEntry) };
}

function cloneScenario<TEntry extends Entry>(scenario: Scenario<TEntry>): Scenario<TEntry> {
  return { ...scenario, entries: scenario.entries.map(cloneEntry) };
}

function cloneEntry<TEntry extends Entry>(entry: TEntry): TEntry {
  return { ...entry };
}