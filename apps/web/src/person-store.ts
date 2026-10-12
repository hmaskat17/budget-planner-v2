import type { Person } from '@budget-planner/core';
import {
  canAddPerson as coreCanAddPerson,
  addPerson as coreAddPerson,
  renamePerson as coreRenamePerson,
  removePerson as coreRemovePerson
} from '@budget-planner/core';

const STORAGE_KEY = 'budget-planner-persons';

let persons: Person[] = load();
const listeners = new Set<(persons: Person[]) => void>();

function load(): Person[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as Person[];
      }
    } catch {
      // Ignore corrupt data and fall back to defaults.
    }
  }
  return [{ id: 'person-1', name: 'Person 1' }];
}

function persist(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persons));
  listeners.forEach((listener) => listener(persons));
}

/** Storage and reactive adapter for person identities, delegating rules to @budget-planner/core. */
export const personStore = {
  getAll(): Person[] {
    return persons;
  },
  get(id: string): Person | undefined {
    return persons.find((person) => person.id === id);
  },
  rename(id: string, name: string): void {
    const result = coreRenamePerson(persons, id, name);
    if (result.issues.length === 0) {
      persons = result.people;
      persist();
    }
  },
  addPerson(): void {
    if (!coreCanAddPerson(persons)) {
      return;
    }
    const index = persons.length + 1;
    const result = coreAddPerson(persons, { id: `person-${index}`, name: `Person ${index}` });
    if (result.issues.length === 0) {
      persons = result.people;
      persist();
    }
  },
  removePerson(id: string): void {
    const result = coreRemovePerson(persons, id);
    if (result.issues.length === 0) {
      persons = result.people;
      persist();
    }
  },
  canAddPerson(): boolean {
    return coreCanAddPerson(persons);
  },
  subscribe(listener: (persons: Person[]) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};
