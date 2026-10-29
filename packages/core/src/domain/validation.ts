import type {
  BudgetData,
  Entry,
  Person,
  PersonSavingsData,
  Scenario,
  ScenarioState,
  SavingsItem,
  SharedExpenseEntry,
  ValidationIssue
} from './models.js';

const MAX_PERSONS = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidAmount(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validatePerson(value: unknown, path = 'person'): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, code: 'invalid-type', message: 'Person must be an object.' }];
  }

  const issues: ValidationIssue[] = [];
  if (typeof value.id !== 'string' || !value.id.trim()) {
    issues.push({ path: `${path}.id`, code: 'required', message: 'Person id is required.' });
  }
  if (typeof value.name !== 'string' || !value.name.trim()) {
    issues.push({ path: `${path}.name`, code: 'required', message: 'Person name is required.' });
  }
  return issues;
}

export function validatePeople(value: unknown): ValidationIssue[] {
  if (!Array.isArray(value)) {
    return [{ path: 'people', code: 'invalid-type', message: 'People must be an array.' }];
  }

  const issues: ValidationIssue[] = [];
  if (value.length < 1 || value.length > MAX_PERSONS) {
    issues.push({
      path: 'people',
      code: 'invalid-count',
      message: `A household must contain between 1 and ${MAX_PERSONS} people.`
    });
  }

  const ids = new Set<string>();
  value.forEach((person, index) => {
    const path = `people[${index}]`;
    issues.push(...validatePerson(person, path));
    if (isRecord(person) && typeof person.id === 'string') {
      if (ids.has(person.id)) {
        issues.push({ path: `${path}.id`, code: 'duplicate', message: 'Person ids must be unique.' });
      }
      ids.add(person.id);
    }
  });
  return issues;
}

export function validateEntry(value: unknown, path = 'entry'): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, code: 'invalid-type', message: 'Entry must be an object.' }];
  }

  const issues: ValidationIssue[] = [];
  if (typeof value.name !== 'string') {
    issues.push({ path: `${path}.name`, code: 'invalid-type', message: 'Entry name must be text.' });
  }
  if (!isValidAmount(value.amount)) {
    issues.push({ path: `${path}.amount`, code: 'invalid-amount', message: 'Entry amount must be finite.' });
  }
  if (value.isSettlement !== undefined && typeof value.isSettlement !== 'boolean') {
    issues.push({ path: `${path}.isSettlement`, code: 'invalid-type', message: 'Settlement flag must be boolean.' });
  }
  if (value.personId !== undefined && (typeof value.personId !== 'string' || !value.personId.trim())) {
    issues.push({ path: `${path}.personId`, code: 'invalid-id', message: 'Person id must be non-empty text.' });
  }
  return issues;
}

export function validateScenario(value: unknown, path = 'scenario'): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, code: 'invalid-type', message: 'Scenario must be an object.' }];
  }

  const issues: ValidationIssue[] = [];
  if (typeof value.id !== 'string' || !value.id.trim()) {
    issues.push({ path: `${path}.id`, code: 'required', message: 'Scenario id is required.' });
  }
  if (typeof value.name !== 'string' || !value.name.trim()) {
    issues.push({ path: `${path}.name`, code: 'required', message: 'Scenario name is required.' });
  }
  if (!Array.isArray(value.entries)) {
    issues.push({ path: `${path}.entries`, code: 'invalid-type', message: 'Scenario entries must be an array.' });
  } else {
    value.entries.forEach((entry, index) => {
      issues.push(...validateEntry(entry, `${path}.entries[${index}]`));
    });
  }
  return issues;
}

export function validateScenarioState(value: unknown, path = 'scenarioState'): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, code: 'invalid-type', message: 'Scenario state must be an object.' }];
  }

  const issues: ValidationIssue[] = [];
  if (!Array.isArray(value.scenarios) || value.scenarios.length === 0) {
    issues.push({ path: `${path}.scenarios`, code: 'required', message: 'At least one scenario is required.' });
  } else {
    value.scenarios.forEach((scenario, index) => {
      issues.push(...validateScenario(scenario, `${path}.scenarios[${index}]`));
    });
    const scenarioIds = value.scenarios
      .filter(isRecord)
      .map((scenario) => scenario.id)
      .filter((id): id is string => typeof id === 'string');
    if (new Set(scenarioIds).size !== scenarioIds.length) {
      issues.push({ path: `${path}.scenarios`, code: 'duplicate-id', message: 'Scenario ids must be unique.' });
    }
    if (typeof value.activeScenarioId !== 'string' || !scenarioIds.includes(value.activeScenarioId)) {
      issues.push({
        path: `${path}.activeScenarioId`,
        code: 'unknown-scenario',
        message: 'Active scenario id must identify a scenario in the state.'
      });
    }
  }
  return issues;
}

function validateScenarioMap(value: unknown, path: string): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, code: 'invalid-type', message: 'Expected a person-keyed object.' }];
  }
  return Object.entries(value).flatMap(([personId, state]) =>
    validateScenarioState(state, `${path}.${personId}`)
  );
}

function validateSavingsItem(value: unknown, path: string): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, code: 'invalid-type', message: 'Savings item must be an object.' }];
  }
  const issues: ValidationIssue[] = [];
  if (typeof value.id !== 'string' || !value.id.trim()) {
    issues.push({ path: `${path}.id`, code: 'required', message: 'Savings item id is required.' });
  }
  if (typeof value.name !== 'string') {
    issues.push({ path: `${path}.name`, code: 'invalid-type', message: 'Savings item name must be text.' });
  }
  if (typeof value.percent !== 'number' || !Number.isFinite(value.percent) || value.percent < 0 || value.percent > 100) {
    issues.push({ path: `${path}.percent`, code: 'invalid-percent', message: 'Savings percentage must be between 0 and 100.' });
  }
  return issues;
}

function validateSavingsItems(value: unknown, path: string): ValidationIssue[] {
  if (!Array.isArray(value)) {
    return [{ path, code: 'invalid-type', message: 'Savings items must be an array.' }];
  }
  return value.flatMap((item, index) => validateSavingsItem(item, `${path}[${index}]`));
}

function validateContributionSettings(value: unknown, people: readonly Person[]): ValidationIssue[] {
  const path = 'contributionSettings';
  if (!isRecord(value)) {
    return [{ path, code: 'invalid-type', message: 'Contribution settings must be an object.' }];
  }

  const issues: ValidationIssue[] = [];
  const methodIsValid = value.method === 'equal' || value.method === 'proportional' ||
    value.method === 'equal-leftover' || value.method === 'fully-pooled' || value.method === 'custom';
  if (!methodIsValid) {
    issues.push({ path: `${path}.method`, code: 'invalid-method', message: 'Contribution method is not supported.' });
  }
  if (!isRecord(value.customPercentByPerson)) {
    issues.push({
      path: `${path}.customPercentByPerson`,
      code: 'invalid-type',
      message: 'Custom contribution percentages must be person-keyed.'
    });
    return issues;
  }

  let totalPercent = 0;
  for (const person of people) {
    const percent = value.customPercentByPerson[person.id];
    if (typeof percent !== 'number' || !Number.isFinite(percent) || percent < 0 || percent > 100) {
      issues.push({
        path: `${path}.customPercentByPerson.${person.id}`,
        code: 'invalid-percent',
        message: 'Custom contribution percentage must be between 0 and 100.'
      });
    } else {
      totalPercent += percent;
    }
  }
  for (const personId of Object.keys(value.customPercentByPerson)) {
    if (!people.some((person) => person.id === personId)) {
      issues.push({
        path: `${path}.customPercentByPerson.${personId}`,
        code: 'unknown-person',
        message: 'Custom contribution percentage must refer to a household person.'
      });
    }
  }
  if (Math.abs(totalPercent - 100) > 0.01) {
    issues.push({
      path: `${path}.customPercentByPerson`,
      code: 'invalid-total',
      message: 'Custom contribution percentages must total 100.'
    });
  }
  return issues;
}

export function validatePersonSavingsData(value: unknown, path = 'personSavings'): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, code: 'invalid-type', message: 'Personal savings data must be an object.' }];
  }
  const issues: ValidationIssue[] = [];
  const contribution = value.sharedContributionPercent;
  if (typeof contribution !== 'number' || !Number.isFinite(contribution) || contribution < 0 || contribution > 100) {
    issues.push({
      path: `${path}.sharedContributionPercent`,
      code: 'invalid-percent',
      message: 'Shared contribution percentage must be between 0 and 100.'
    });
  }
  issues.push(...validateSavingsItems(value.items, `${path}.items`));
  return issues;
}

export function validateBudgetData(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path: 'budget', code: 'invalid-type', message: 'Budget data must be an object.' }];
  }

  const issues = validatePeople(value.people);
  const validPeople = Array.isArray(value.people)
    ? value.people.filter((person): person is Person => validatePerson(person).length === 0)
    : [];
  issues.push(...validateScenarioMap(value.incomeByPerson, 'incomeByPerson'));
  issues.push(...validateScenarioMap(value.personalExpensesByPerson, 'personalExpensesByPerson'));
  issues.push(...validateScenarioState(value.sharedExpenses, 'sharedExpenses'));
  issues.push(...validateContributionSettings(value.contributionSettings, validPeople));

  if (!isRecord(value.assetsByPerson)) {
    issues.push({ path: 'assetsByPerson', code: 'invalid-type', message: 'Assets must be a person-keyed object.' });
  } else {
    for (const [personId, entries] of Object.entries(value.assetsByPerson)) {
      if (!Array.isArray(entries)) {
        issues.push({ path: `assetsByPerson.${personId}`, code: 'invalid-type', message: 'Assets must be an array.' });
      } else {
        entries.forEach((entry, index) => issues.push(...validateEntry(entry, `assetsByPerson.${personId}[${index}]`)));
      }
    }
  }

  if (!isRecord(value.personalSavingsByPerson)) {
    issues.push({ path: 'personalSavingsByPerson', code: 'invalid-type', message: 'Personal savings must be person-keyed.' });
  } else {
    for (const [personId, savings] of Object.entries(value.personalSavingsByPerson)) {
      issues.push(...validatePersonSavingsData(savings, `personalSavingsByPerson.${personId}`));
    }
  }

  if (!isRecord(value.sharedSavings)) {
    issues.push({ path: 'sharedSavings', code: 'invalid-type', message: 'Shared savings must be an object.' });
  } else {
    issues.push(...validateSavingsItems(value.sharedSavings.items, 'sharedSavings.items'));
  }

  const personIds = new Set(validPeople.map((person) => person.id));
  if (isRecord(value.sharedExpenses) && Array.isArray(value.sharedExpenses.scenarios)) {
    value.sharedExpenses.scenarios.forEach((scenario, scenarioIndex) => {
      if (!isRecord(scenario) || !Array.isArray(scenario.entries)) {
        return;
      }
      scenario.entries.forEach((entry, entryIndex) => {
        if (isRecord(entry) && typeof entry.personId === 'string' && !personIds.has(entry.personId)) {
          issues.push({
            path: `sharedExpenses.scenarios[${scenarioIndex}].entries[${entryIndex}].personId`,
            code: 'unknown-person',
            message: 'Shared expense must refer to a household person.'
          });
        }
      });
    });
  }

  return issues;
}

export function isPerson(value: unknown): value is Person {
  return validatePerson(value).length === 0;
}

export function isEntry(value: unknown): value is Entry {
  return validateEntry(value).length === 0;
}

export function isSharedExpenseEntry(value: unknown): value is SharedExpenseEntry {
  return validateEntry(value).length === 0;
}

export function isScenario(value: unknown): value is Scenario {
  return validateScenario(value).length === 0;
}

export function isScenarioState(value: unknown): value is ScenarioState {
  return validateScenarioState(value).length === 0;
}

export function isSavingsItem(value: unknown): value is SavingsItem {
  return validateSavingsItem(value, 'savingsItem').length === 0;
}

export function isPersonSavingsData(value: unknown): value is PersonSavingsData {
  return validatePersonSavingsData(value).length === 0;
}

export function isBudgetData(value: unknown): value is BudgetData {
  return validateBudgetData(value).length === 0;
}