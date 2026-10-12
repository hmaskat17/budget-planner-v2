import type { Person, ValidationIssue } from './models.js';
import { validatePeople, validatePerson } from './validation.js';

const MAX_PERSONS = 2;

export interface PersonMutationResult {
  people: Person[];
  issues: ValidationIssue[];
}

export function canAddPerson(people: readonly Person[]): boolean {
  return people.length < MAX_PERSONS;
}

export function addPerson(people: readonly Person[], person: Person): PersonMutationResult {
  const nextPeople = [...people, { ...person, id: person.id.trim(), name: person.name.trim() }];
  const issues = validatePeople(nextPeople);
  return issues.length ? { people: [...people], issues } : { people: nextPeople, issues: [] };
}

export function renamePerson(
  people: readonly Person[],
  personId: string,
  name: string
): PersonMutationResult {
  const currentPerson = people.find((person) => person.id === personId);
  if (!currentPerson) {
    return {
      people: [...people],
      issues: [{ path: 'personId', code: 'not-found', message: 'Person does not exist.' }]
    };
  }

  const updatedPerson = { ...currentPerson, name: name.trim() };
  const personIssues = validatePerson(updatedPerson);
  if (personIssues.length) {
    return { people: [...people], issues: personIssues };
  }

  return {
    people: people.map((person) => person.id === personId ? updatedPerson : { ...person }),
    issues: []
  };
}

export function removePerson(people: readonly Person[], personId: string): PersonMutationResult {
  if (!people.some((person) => person.id === personId)) {
    return {
      people: [...people],
      issues: [{ path: 'personId', code: 'not-found', message: 'Person does not exist.' }]
    };
  }
  if (people.length <= 1) {
    return {
      people: [...people],
      issues: [{ path: 'people', code: 'minimum-count', message: 'A household must keep at least one person.' }]
    };
  }
  return { people: people.filter((person) => person.id !== personId), issues: [] };
}