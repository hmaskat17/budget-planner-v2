import { describe, expect, it } from 'vitest';
import { createBudgetStorage, STORAGE_KEYS, type KeyValueStore } from './budget-storage.ts';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const map = new Map(Object.entries(initial));
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

describe('budget storage', () => {
  it('loads a normalized default budget from an empty store', async () => {
    const data = await createBudgetStorage(memoryStore(), () => 'Person 1').loadBudgetData();
    expect(data.people[0].name).toBe('Person 1');
    expect(data.incomeByPerson['person-1']).toBeDefined();
  });

  it('round-trips saved data and tolerates corrupt values', async () => {
    const store = memoryStore();
    const storage = createBudgetStorage(store, () => 'P');
    const data = await storage.loadBudgetData();
    storage.saveAll({ ...data, people: [{ id: 'person-1', name: 'Alex' }] });
    expect((await storage.loadBudgetData()).people[0].name).toBe('Alex');

    store.setItem(STORAGE_KEYS.income, '{not json');
    expect((await storage.loadBudgetData()).incomeByPerson['person-1']).toBeDefined();
  });
});
