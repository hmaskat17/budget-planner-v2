/** @typedef {import('../models.js').Scenario} Scenario */
import { personStore } from '../person-store.js';

const STORAGE_KEY = 'budget-planner-income';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
    :host {
        display: block;
    }
    .income-block {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 10px;
    }
    .income-block input {
        width: 48%;
    }
    .add-income-input {
        display: block;
        margin-bottom: 10px;
    }
    .person-total {
        font-weight: bold;
    }
    .scenario-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 10px;
    }
    .scenario-chip {
        display: flex;
        align-items: center;
        gap: 4px;
        border: 1px solid #ccc;
        border-radius: 999px;
        background: #eee;
        padding: 4px 6px 4px 10px;
        font-size: 0.9em;
    }
    .scenario-chip.active {
        background: #4a90d9;
        border-color: #4a90d9;
        color: #fff;
    }
    .scenario-chip-label {
        border: none;
        background: transparent;
        color: inherit;
        font: inherit;
        cursor: pointer;
        padding: 0;
    }
    .scenario-chip-rename-trigger,
    .scenario-chip-delete {
        border: none;
        background: transparent;
        color: inherit;
        cursor: pointer;
        line-height: 1;
        padding: 0;
    }
    .scenario-chip-delete {
        font-size: 1.1em;
    }
    .scenario-chip-rename {
        width: 100px;
        font-size: 0.9em;
    }
    .scenario-chip-add {
        border: 1px dashed #999;
        border-radius: 999px;
        background: transparent;
        padding: 4px 10px;
        cursor: pointer;
        font-size: 0.9em;
    }
`);

/** Self-contained income budget component; owns its own scenario data, keyed by person-id. */
export class BudgetIncome extends HTMLElement {
    static get observedAttributes() {
        return ['person-id'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.adoptedStyleSheets = [sheet];
        /** @type {Record<string, { activeScenarioId: string, scenarios: Scenario[] }>} */
        this.data = loadAll();
    }

    connectedCallback() {
        this._unsubscribe = personStore.subscribe(() => this.render());
        this.render();
    }

    disconnectedCallback() {
        this._unsubscribe?.();
    }

    attributeChangedCallback() {
        if (this.isConnected) {
            this.render();
        }
    }

    get personId() {
        return this.getAttribute('person-id');
    }

    /** Returns this person's scenario state, creating a default scenario on first use. */
    ensureScenarioState() {
        if (!this.data[this.personId]) {
            const scenario = createDefaultScenario();
            this.data[this.personId] = { activeScenarioId: scenario.id, scenarios: [scenario] };
        }
        return this.data[this.personId];
    }

    getActiveScenario() {
        const state = this.ensureScenarioState();
        return state.scenarios.find((scenario) => scenario.id === state.activeScenarioId);
    }

    /** @returns {number} */
    total() {
        return scenarioTotal(this.getActiveScenario());
    }

    persistAndNotify() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        this.dispatchEvent(new CustomEvent('income-changed', { bubbles: true, composed: true }));
    }

    render() {
        const state = this.ensureScenarioState();
        const activeScenario = this.getActiveScenario();
        const root = this.shadowRoot;
        root.innerHTML = '';

        const heading = document.createElement('h3');
        heading.className = 'person-name';
        heading.textContent = personStore.get(this.personId)?.name ?? 'Person';
        root.appendChild(heading);

        root.appendChild(this.renderScenarioChips(state));
        root.appendChild(this.renderIncomeForm(activeScenario));

        const total = document.createElement('p');
        total.className = 'person-total';
        total.innerHTML = `Total: <span class="total-amount">${formatAmount(this.total())}</span>`;
        root.appendChild(total);

        this.persistAndNotify();
    }

    updateTotal() {
        const totalEl = this.shadowRoot.querySelector('.total-amount');
        if (totalEl) {
            totalEl.textContent = formatAmount(this.total());
        }
        this.persistAndNotify();
    }

    renderScenarioChips(state) {
        const chipsContainer = document.createElement('div');
        chipsContainer.className = 'scenario-chips';

        state.scenarios.forEach((scenario) => {
            const chip = document.createElement('div');
            chip.className = 'scenario-chip' + (scenario.id === state.activeScenarioId ? ' active' : '');

            const label = document.createElement('button');
            label.type = 'button';
            label.className = 'scenario-chip-label';
            label.textContent = scenario.name;
            label.addEventListener('click', () => this.switchScenario(scenario.id));
            chip.appendChild(label);

            const renameButton = document.createElement('button');
            renameButton.type = 'button';
            renameButton.className = 'scenario-chip-rename-trigger';
            renameButton.title = 'Rename scenario';
            renameButton.textContent = '\u270e';
            renameButton.addEventListener('click', () => this.startRenameScenario(chip, scenario));
            chip.appendChild(renameButton);

            if (state.scenarios.length > 1) {
                const deleteButton = document.createElement('button');
                deleteButton.type = 'button';
                deleteButton.className = 'scenario-chip-delete';
                deleteButton.title = 'Delete scenario';
                deleteButton.textContent = '\u00d7';
                deleteButton.addEventListener('click', () => this.deleteScenario(scenario.id));
                chip.appendChild(deleteButton);
            }

            chipsContainer.appendChild(chip);
        });

        const addChip = document.createElement('button');
        addChip.type = 'button';
        addChip.className = 'scenario-chip-add';
        addChip.title = 'New scenario';
        addChip.textContent = '+';
        addChip.addEventListener('click', () => this.addScenario());
        chipsContainer.appendChild(addChip);

        return chipsContainer;
    }

    startRenameScenario(chip, scenario) {
        chip.innerHTML = '';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'scenario-chip-rename';
        input.value = scenario.name;
        chip.appendChild(input);
        input.focus();
        input.select();

        const commit = () => {
            const newName = input.value.trim();
            if (newName) {
                this.renameScenario(scenario.id, newName);
            } else {
                this.render();
            }
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                input.blur();
            } else if (event.key === 'Escape') {
                this.render();
            }
        });
    }

    renderIncomeForm(scenario) {
        const form = document.createElement('div');
        form.className = 'income-form';

        const inputsContainer = document.createElement('div');
        inputsContainer.className = 'income-inputs';

        scenario.incomes.forEach((income, index) => {
            const incomeBlock = document.createElement('div');
            incomeBlock.className = 'income-block';

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.placeholder = 'Income source';
            nameInput.required = true;
            nameInput.value = income.name;
            nameInput.addEventListener('input', () => {
                income.name = nameInput.value;
                this.persistAndNotify();
            });

            const amountInput = document.createElement('input');
            amountInput.type = 'number';
            amountInput.placeholder = 'Amount';
            amountInput.required = true;
            amountInput.value = income.amount;
            amountInput.addEventListener('input', () => {
                // Store the raw string while typing so partial/exponent input (e.g. "1e") isn't clobbered.
                income.amount = amountInput.value;
                this.updateTotal();
            });
            amountInput.addEventListener('blur', () => {
                income.amount = Number(amountInput.value) || 0;
                this.render();
            });

            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'remove-income-input';
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', () => this.removeIncome(index));

            incomeBlock.appendChild(nameInput);
            incomeBlock.appendChild(amountInput);
            incomeBlock.appendChild(removeButton);
            inputsContainer.appendChild(incomeBlock);
        });

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'add-income-input';
        addButton.textContent = 'Add new income';
        addButton.addEventListener('click', () => this.addIncome());

        form.appendChild(inputsContainer);
        form.appendChild(addButton);
        return form;
    }

    switchScenario(scenarioId) {
        this.ensureScenarioState().activeScenarioId = scenarioId;
        this.render();
    }

    addScenario() {
        const state = this.ensureScenarioState();
        const scenario = createDefaultScenario();
        state.scenarios.push(scenario);
        state.activeScenarioId = scenario.id;
        this.render();

        const chip = [...this.shadowRoot.querySelectorAll('.scenario-chip')].at(-1);
        if (chip) {
            this.startRenameScenario(chip, scenario);
        }
    }

    deleteScenario(scenarioId) {
        const state = this.ensureScenarioState();
        if (state.scenarios.length <= 1) {
            return;
        }
        state.scenarios = state.scenarios.filter((scenario) => scenario.id !== scenarioId);
        if (state.activeScenarioId === scenarioId) {
            state.activeScenarioId = state.scenarios[0].id;
        }
        this.render();
    }

    renameScenario(scenarioId, newName) {
        const scenario = this.ensureScenarioState().scenarios.find((candidate) => candidate.id === scenarioId);
        scenario.name = newName;
        this.render();
    }

    addIncome() {
        this.getActiveScenario().incomes.push({ name: '', amount: 0 });
        this.render();
    }

    removeIncome(incomeIndex) {
        const scenario = this.getActiveScenario();
        // At minimum, one income source is always required.
        if (scenario.incomes.length <= 1) {
            return;
        }
        scenario.incomes.splice(incomeIndex, 1);
        this.render();
    }
}

customElements.define('budget-income', BudgetIncome);

function createDefaultScenario() {
    return { id: uid('scenario'), name: 'Default', incomes: [{ name: '', amount: 0 }] };
}

function uid(prefix) {
    return prefix + '-' + Math.random().toString(36).slice(2, 10);
}

function formatAmount(amount) {
    return amount.toFixed(2);
}

function scenarioTotal(scenario) {
    return scenario.incomes.reduce((sum, income) => sum + (Number(income.amount) || 0), 0);
}

function loadAll() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return {};
    }
    try {
        const parsed = JSON.parse(raw);
        // Legacy format stored a flat array of persons with embedded scenarios; discard it in favor of the new per-person map.
        return Array.isArray(parsed) ? {} : parsed;
    } catch (error) {
        return {};
    }
}
