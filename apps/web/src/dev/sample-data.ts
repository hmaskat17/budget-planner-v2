// TEMPORARY: random sample data for manual testing. Remove with the header button when the app is complete.
import type { BudgetData, Entry, ScenarioState, SharedExpenseEntry, SavingsItem } from '@budget-planner/core';
import { createId } from '@budget-planner/core';

const NAMES = ['Alex', 'Sam', 'Jamie', 'Taylor', 'Morgan', 'Riley', 'Jordan', 'Casey'];
const METHODS = ['equal', 'proportional', 'equal-leftover', 'fully-pooled', 'custom'] as const;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const money = (min: number, max: number, step = 5) => Math.round(rand(min, max) / step) * step;
const pick = <T>(items: readonly T[]): T => items[randInt(0, items.length - 1)];
const sample = <T>(items: readonly T[], count: number): T[] =>
  [...items].sort(() => Math.random() - 0.5).slice(0, count);

function state<T extends Entry>(entries: T[], name = 'Current'): ScenarioState<T> {
  const id = createId('scenario');
  return { activeScenarioId: id, scenarios: [{ id, name, entries }] };
}

function savingsItems(names: readonly string[], maxTotal: number): SavingsItem[] {
  const chosen = sample(names, randInt(1, 3));
  let left = maxTotal;
  return chosen.map((name, i) => {
    const percent = i === chosen.length - 1 ? Math.min(left, 5 * randInt(2, 8)) : Math.min(left, 5 * randInt(2, 6));
    left -= percent;
    return { id: createId('savings'), name, percent };
  });
}

export function generateSampleBudget(): BudgetData {
  const count = randInt(1, 2);
  const names = sample(NAMES, count);
  const people = names.map((name, i) => ({ id: `person-${i + 1}`, name }));

  const data: BudgetData = {
    people,
    incomeByPerson: {},
    personalExpensesByPerson: {},
    sharedExpenses: state<SharedExpenseEntry>([]),
    assetsByPerson: {},
    personalSavingsByPerson: {},
    sharedSavings: { items: savingsItems(['Vacation', 'Home renovation', 'Emergency fund', 'New car'], 100) },
    contributionSettings: { method: pick(METHODS), customPercentByPerson: {} }
  };

  const customFirst = pick([30, 40, 50, 60, 70]);
  people.forEach((person, i) => {
    const salary = money(1800, 5500, 50);
    const income: Entry[] = [{ name: 'Salary', amount: salary }];
    if (Math.random() < 0.4) income.push({ name: pick(['Freelance', 'Side project', 'Rental income']), amount: money(100, 600, 25) });
    data.incomeByPerson[person.id] = state(income);

    const personal: Entry[] = sample(
      [
        { name: 'Phone', amount: money(15, 60) },
        { name: 'Transport', amount: money(40, 150) },
        { name: 'Gym', amount: money(20, 60) },
        { name: 'Subscriptions', amount: money(10, 45) },
        { name: 'Clothing', amount: money(30, 150, 10) },
        { name: 'Hobbies', amount: money(20, 120, 10) }
      ],
      randInt(3, 5)
    );
    data.personalExpensesByPerson[person.id] = state(personal);

    data.assetsByPerson[person.id] = sample(
      [
        { name: 'Savings account', amount: money(1000, 25000, 100) },
        { name: 'Cash', amount: money(100, 1500, 50) },
        { name: 'Investments', amount: money(500, 20000, 100) },
        { name: 'Gold', amount: money(300, 3000, 100) }
      ],
      randInt(1, 3)
    );

    data.personalSavingsByPerson[person.id] = {
      sharedContributionPercent: count === 1 ? 0 : pick([0, 10, 20, 30]),
      items: savingsItems(['Rainy day', 'Travel', 'Gadgets', 'Education', 'Retirement'], 100)
    };
    data.contributionSettings.customPercentByPerson[person.id] = count === 1 ? 100 : i === 0 ? customFirst : 100 - customFirst;
  });

  const shared: SharedExpenseEntry[] = [
    { name: 'Rent', amount: money(700, 1600, 25) },
    { name: 'Groceries', amount: money(300, 700, 10) },
    { name: 'Utilities', amount: money(80, 250, 5) },
    { name: 'Internet', amount: money(25, 60) },
    { name: 'Insurance', amount: money(40, 150) }
  ].map((entry) => ({ ...entry, personId: pick(people).id }));
  data.sharedExpenses = state(shared);

  return data;
}
