/** @typedef {import('./models.js').Person} Person */

const STORAGE_KEY = 'budget-planner-persons';
const MAX_PERSONS = 2;

/** @type {Person[]} */
let persons = load();
/** @type {Set<(persons: Person[]) => void>} */
const listeners = new Set();

function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        } catch (error) {
            // Ignore corrupt data and fall back to defaults.
        }
    }
    return [{ id: 'person-1', name: 'Person 1' }];
}

function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persons));
    listeners.forEach((listener) => listener(persons));
}

/** Single source of truth for person identity, shared by every budget component. */
export const personStore = {
    /** @returns {Person[]} */
    getAll() {
        return persons;
    },
    /** @param {string} id @returns {Person|undefined} */
    get(id) {
        return persons.find((person) => person.id === id);
    },
    /** @param {string} id @param {string} name */
    rename(id, name) {
        const person = personStore.get(id);
        if (person) {
            person.name = name;
            persist();
        }
    },
    /** Adds a new person, up to the household maximum of two. */
    addPerson() {
        if (persons.length >= MAX_PERSONS) {
            return;
        }
        const index = persons.length + 1;
        persons.push({ id: `person-${index}`, name: `Person ${index}` });
        persist();
    },
    /** Removes a person; the household must always keep at least one. */
    removePerson(id) {
        if (persons.length <= 1) {
            return;
        }
        persons = persons.filter((person) => person.id !== id);
        persist();
    },
    /** @returns {boolean} whether another person can be added */
    canAddPerson() {
        return persons.length < MAX_PERSONS;
    },
    /** @param {(persons: Person[]) => void} listener @returns {() => void} unsubscribe */
    subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }
};
