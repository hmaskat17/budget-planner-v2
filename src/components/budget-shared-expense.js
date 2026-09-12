/** @typedef {import('../models.js').Scenario} Scenario */
import { personStore } from '../person-store.js';
import { scenarioSheet, renderScenarioChips, startRenameScenario, uid, formatAmount } from './scenario-budget.js';

const STORAGE_KEY = 'budget-planner-shared-expense';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
    .entry-row input[type="text"] {
        width: 34%;
    }
    .entry-row input[type="number"] {
        width: 18%;
    }
    .entry-row select {
        width: 26%;
    }
    .person-subtotals {
        margin: 10px 0;
    }
    .person-subtotal-row {
        display: flex;
        justify-content: space-between;
    }
    .household-total {
        font-weight: bold;
        border-top: 1px solid #ddd;
        padding-top: 10px;
        margin-top: 10px;
    }
`);

/**
 * Household-wide shared expense component. Unlike the per-person budgets, this mounts once:
 * every entry is tagged with a person-id so the list stays visible even if a person is hidden.
 */
export class BudgetSharedExpense extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.adoptedStyleSheets = [scenarioSheet, sheet];
        this.data = load();
    }

    connectedCallback() {
        this._unsubscribe = personStore.subscribe(() => this.render());
        this.render();
    }

    disconnectedCallback() {
        this._unsubscribe?.();
    }

    getActiveScenario() {
        return this.data.scenarios.find((scenario) => scenario.id === this.data.activeScenarioId);
    }

    /** Reassigns entries belonging to a removed person to the first remaining person. */
    reconcilePersonIds() {
        const people = personStore.getAll();
        if (!people.length) {
            return;
        }
        const validIds = new Set(people.map((person) => person.id));
        this.getActiveScenario().entries.forEach((entry) => {
            if (!validIds.has(entry.personId)) {
                entry.personId = people[0].id;
            }
        });
    }

    /** @param {string} personId @returns {number} */
    personTotal(personId) {
        return this.getActiveScenario().entries
            .filter((entry) => entry.personId === personId)
            .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
    }

    /** @returns {number} combined shared expense total across all persons */
    total() {
        return this.getActiveScenario().entries.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
    }

    persistAndNotify() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        this.dispatchEvent(new CustomEvent('shared-expense-changed', { bubbles: true, composed: true }));
    }

    render() {
        this.reconcilePersonIds();
        const activeScenario = this.getActiveScenario();
        const people = personStore.getAll();
        const root = this.shadowRoot;
        root.innerHTML = '';

        root.appendChild(renderScenarioChips(this.data, {
            onSwitch: (scenarioId) => this.switchScenario(scenarioId),
            onStartRename: (chip, scenario) => this.handleStartRename(chip, scenario),
            onDelete: (scenarioId) => this.deleteScenario(scenarioId),
            onAdd: () => this.addScenario()
        }));
        root.appendChild(this.renderEntryForm(activeScenario, people));
        root.appendChild(this.renderSubtotals(people));

        const total = document.createElement('p');
        total.className = 'household-total';
        total.innerHTML = `Combined shared expenses: <span class="total-amount">${formatAmount(this.total())}</span>`;
        root.appendChild(total);

        this.persistAndNotify();
    }

    /** Updates totals in place while amount inputs are focused, avoiding a full re-render. */
    updateTotals() {
        const people = personStore.getAll();
        people.forEach((person) => {
            const el = this.shadowRoot.querySelector(`[data-person-subtotal="${person.id}"]`);
            if (el) {
                el.textContent = formatAmount(this.personTotal(person.id));
            }
        });
        const totalEl = this.shadowRoot.querySelector('.household-total .total-amount');
        if (totalEl) {
            totalEl.textContent = formatAmount(this.total());
        }
        this.persistAndNotify();
    }

    handleStartRename(chip, scenario) {
        startRenameScenario(chip, scenario, {
            onCommit: (newName) => this.renameScenario(scenario.id, newName),
            onCancel: () => this.render()
        });
    }

    renderEntryForm(scenario, people) {
        const form = document.createElement('div');
        form.className = 'entry-form';

        const inputsContainer = document.createElement('div');
        inputsContainer.className = 'entry-inputs';

        scenario.entries.forEach((entry, index) => {
            const entryRow = document.createElement('div');
            entryRow.className = 'entry-row';

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.placeholder = 'Expense source';
            nameInput.required = true;
            nameInput.value = entry.name;
            nameInput.addEventListener('input', () => {
                entry.name = nameInput.value;
                this.persistAndNotify();
            });

            const amountInput = document.createElement('input');
            amountInput.type = 'number';
            amountInput.placeholder = 'Amount';
            amountInput.required = true;
            amountInput.value = entry.amount;
            amountInput.addEventListener('input', () => {
                // Store the raw string while typing so partial/exponent input (e.g. "1e") isn't clobbered.
                entry.amount = amountInput.value;
                this.updateTotals();
            });
            amountInput.addEventListener('blur', () => {
                entry.amount = Number(amountInput.value) || 0;
                this.render();
            });

            const personSelect = document.createElement('select');
            people.forEach((person) => {
                const option = document.createElement('option');
                option.value = person.id;
                option.textContent = person.name;
                option.selected = person.id === entry.personId;
                personSelect.appendChild(option);
            });
            personSelect.addEventListener('change', () => {
                entry.personId = personSelect.value;
                this.render();
            });

            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'remove-entry-input';
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', () => this.removeEntry(index));

            entryRow.appendChild(nameInput);
            entryRow.appendChild(amountInput);
            entryRow.appendChild(personSelect);
            entryRow.appendChild(removeButton);
            inputsContainer.appendChild(entryRow);
        });

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'add-entry-button';
        addButton.textContent = 'Add new shared expense';
        addButton.addEventListener('click', () => this.addEntry());

        form.appendChild(inputsContainer);
        form.appendChild(addButton);
        return form;
    }

    renderSubtotals(people) {
        const container = document.createElement('div');
        container.className = 'person-subtotals';

        people.forEach((person) => {
            const row = document.createElement('div');
            row.className = 'person-subtotal-row';

            const label = document.createElement('span');
            label.textContent = `${person.name}:`;

            const amount = document.createElement('span');
            amount.setAttribute('data-person-subtotal', person.id);
            amount.textContent = formatAmount(this.personTotal(person.id));

            row.appendChild(label);
            row.appendChild(amount);
            container.appendChild(row);
        });

        return container;
    }

    switchScenario(scenarioId) {
        this.data.activeScenarioId = scenarioId;
        this.render();
    }

    addScenario() {
        const scenario = createDefaultSharedScenario();
        this.data.scenarios.push(scenario);
        this.data.activeScenarioId = scenario.id;
        this.render();

        const chip = [...this.shadowRoot.querySelectorAll('.scenario-chip')].at(-1);
        if (chip) {
            this.handleStartRename(chip, scenario);
        }
    }

    deleteScenario(scenarioId) {
        if (this.data.scenarios.length <= 1) {
            return;
        }
        this.data.scenarios = this.data.scenarios.filter((scenario) => scenario.id !== scenarioId);
        if (this.data.activeScenarioId === scenarioId) {
            this.data.activeScenarioId = this.data.scenarios[0].id;
        }
        this.render();
    }

    renameScenario(scenarioId, newName) {
        const scenario = this.data.scenarios.find((candidate) => candidate.id === scenarioId);
        // Scenario may have been deleted concurrently (e.g. stale event); nothing to rename.
        if (!scenario) {
            this.render();
            return;
        }
        scenario.name = newName;
        this.render();
    }

    addEntry() {
        const people = personStore.getAll();
        this.getActiveScenario().entries.push({ name: '', amount: 0, personId: people[0]?.id });
        this.render();
    }

    removeEntry(entryIndex) {
        this.getActiveScenario().entries.splice(entryIndex, 1);
        this.render();
    }
}

customElements.define('budget-shared-expense', BudgetSharedExpense);

/** Shared expenses have no "always required" minimum entry, unlike income. */
function createDefaultSharedScenario() {
    return { id: uid('scenario'), name: 'Default', entries: [] };
}

function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.scenarios) && parsed.scenarios.length > 0) {
                return parsed;
            }
        } catch (error) {
            // Ignore corrupt data and fall back to defaults.
        }
    }
    const scenario = createDefaultSharedScenario();
    return { activeScenarioId: scenario.id, scenarios: [scenario] };
}
