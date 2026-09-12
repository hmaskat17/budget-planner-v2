import { personStore } from './person-store.js';
import './components/person-editor.js';
import './components/budget-income.js';
import './components/budget-personal-expense.js';
import './components/budget-shared-expense.js';
import { createTotalAggregator } from './total-aggregator.js';

// Only add/remove person rows on structural changes; renames shouldn't remount <person-editor>.
function renderPersonManagement() {
    const container = document.getElementById('household-people');
    const addButton = document.getElementById('add-person');
    if (!container || !addButton) {
        return;
    }
    const people = personStore.getAll();
    const currentIds = people.map((person) => person.id);

    Array.from(container.children).forEach((rowEl) => {
        const row = /** @type {HTMLElement} */ (rowEl);
        if (!currentIds.includes(row.dataset.personId)) {
            row.remove();
        }
    });

    people.forEach((person) => {
        if (!container.querySelector(`.person-row[data-person-id="${person.id}"]`)) {
            const row = document.createElement('div');
            row.className = 'person-row';
            row.dataset.personId = person.id;

            const editor = document.createElement('person-editor');
            editor.setAttribute('person-id', person.id);
            row.appendChild(editor);

            container.appendChild(row);
        }
    });

    // Toggle each row's remove button visibility to match the current person count.
    Array.from(container.querySelectorAll('.person-row')).forEach((rowEl) => {
        const row = /** @type {HTMLElement} */ (rowEl);
        let removeButton = /** @type {HTMLButtonElement|null} */ (row.querySelector('.remove-person'));
        if (people.length > 1 && !removeButton) {
            removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'remove-person';
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', () => {
                const personId = row.dataset.personId;
                if (personId) {
                    personStore.removePerson(personId);
                }
            });
            row.appendChild(removeButton);
        } else if (people.length <= 1 && removeButton) {
            removeButton.remove();
        }
    });

    addButton.hidden = !personStore.canAddPerson();
}

// Only add/remove budget columns on structural changes; renames shouldn't remount them.
function renderBudgetColumns(containerId, tagName) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }
    const currentIds = personStore.getAll().map((person) => person.id);

    /** @type {HTMLElement[]} */ ([...container.children]).forEach((el) => {
        const personId = el.getAttribute('person-id');
        if (!personId || !currentIds.includes(personId)) {
            el.remove();
        }
    });

    currentIds.forEach((id) => {
        if (!container.querySelector(`${tagName}[person-id="${id}"]`)) {
            const el = document.createElement(tagName);
            el.setAttribute('person-id', id);
            container.appendChild(el);
        }
    });
}

document.getElementById('add-person')?.addEventListener('click', () => personStore.addPerson());

personStore.subscribe(() => {
    renderPersonManagement();
    renderBudgetColumns('income-people', 'budget-income');
    renderBudgetColumns('personal-expense-people', 'budget-personal-expense');
});

renderPersonManagement();
renderBudgetColumns('income-people', 'budget-income');
renderBudgetColumns('personal-expense-people', 'budget-personal-expense');

createTotalAggregator({ tagName: 'budget-income', eventName: 'income-changed', totalElementId: 'household-total-amount' });
createTotalAggregator({
    tagName: 'budget-personal-expense',
    eventName: 'personal-expense-changed',
    totalElementId: 'household-expense-total-amount'
});

