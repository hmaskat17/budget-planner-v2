import { personStore } from './person-store.ts';
import './components/person-editor.ts';
import './components/budget-income.ts';
import './components/budget-personal-expense.ts';
import './components/budget-shared-expense.ts';
import './components/budget-remaining-balance.ts';
import './components/budget-savings.ts';
import './components/budget-proportional-contributions.ts';
import './components/budget-unallocated-assets.ts';
import { createTotalAggregator } from './total-aggregator.ts';

// Only add/remove person rows on structural changes; renames shouldn't remount <person-editor>.
function renderPersonManagement(): void {
  const container = document.getElementById('household-people');
  const addButton = document.getElementById('add-person') as HTMLButtonElement | null;
  if (!container || !addButton) {
    return;
  }
  const people = personStore.getAll();
  const currentIds = people.map((person) => person.id);

  Array.from(container.children).forEach((rowEl) => {
    const row = rowEl as HTMLElement;
    if (row.dataset.personId && !currentIds.includes(row.dataset.personId)) {
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
    const row = rowEl as HTMLElement;
    let removeButton = row.querySelector('.remove-person') as HTMLButtonElement | null;
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
function renderBudgetColumns(containerId: string, tagName: string): void {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }
  const currentIds = personStore.getAll().map((person) => person.id);

  Array.from(container.children).forEach((el) => {
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
  renderBudgetColumns('unallocated-assets-people', 'budget-unallocated-assets');
});

renderPersonManagement();
renderBudgetColumns('income-people', 'budget-income');
renderBudgetColumns('personal-expense-people', 'budget-personal-expense');
renderBudgetColumns('unallocated-assets-people', 'budget-unallocated-assets');

createTotalAggregator({ tagName: 'budget-income', eventName: 'income-changed', totalElementId: 'household-total-amount' });
createTotalAggregator({
  tagName: 'budget-personal-expense',
  eventName: 'personal-expense-changed',
  totalElementId: 'household-expense-total-amount'
});
createTotalAggregator({
  tagName: 'budget-unallocated-assets',
  eventName: 'unallocated-assets-changed',
  totalElementId: 'household-assets-total-amount'
});
