/** @typedef {import('../models.js').Scenario} Scenario */
/** @typedef {import('../models.js').Entry} Entry */
import { personStore } from '../person-store.js';

/** Shared Shadow DOM stylesheet for scenario chips and entry rows; reusable by any scenario-based component. */
export const scenarioSheet = new CSSStyleSheet();
scenarioSheet.replaceSync(`
    :host {
        display: block;
    }
    .entry-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 10px;
    }
    .entry-row input {
        width: 48%;
    }
    .add-entry-button {
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

/**
 * Base for per-person, scenario-based budget components (income, personal expenses, ...).
 * Subclasses configure storage/labels via static getters and call `customElements.define`.
 */
export class ScenarioBudgetElement extends HTMLElement {
    static get observedAttributes() {
        return ['person-id'];
    }

    /** @returns {string} localStorage key this component's data is persisted under */
    static get storageKey() {
        throw new Error('storageKey must be implemented by subclass');
    }

    /** @returns {string} CustomEvent name dispatched whenever totals change */
    static get changeEventName() {
        throw new Error('changeEventName must be implemented by subclass');
    }

    /** @returns {string} placeholder text for an entry's name input */
    static get entryPlaceholder() {
        return 'Source';
    }

    /** @returns {string} label for the "add entry" button */
    static get addEntryLabel() {
        return 'Add new entry';
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.adoptedStyleSheets = [scenarioSheet];
        /** @type {Record<string, { activeScenarioId: string, scenarios: Scenario[] }>} */
        this.data = loadAll(this.constructor.storageKey);
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

    /** @returns {number} total including any settlement adjustments */
    total() {
        return scenarioTotal(this.getActiveScenario());
    }

    /** @returns {number} base total excluding settlement adjustments */
    baseTotal() {
        return scenarioTotal(this.getActiveScenario(), true);
    }

    persistAndNotify() {
        localStorage.setItem(this.constructor.storageKey, JSON.stringify(this.data));
        this.dispatchEvent(new CustomEvent(this.constructor.changeEventName, { bubbles: true, composed: true }));
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
        root.appendChild(this.renderEntryForm(activeScenario));

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
        return renderScenarioChips(state, {
            onSwitch: (scenarioId) => this.switchScenario(scenarioId),
            onStartRename: (chip, scenario) => this.startRenameScenario(chip, scenario),
            onDelete: (scenarioId) => this.deleteScenario(scenarioId),
            onAdd: () => this.addScenario()
        });
    }

    startRenameScenario(chip, scenario) {
        startRenameScenario(chip, scenario, {
            onCommit: (newName) => this.renameScenario(scenario.id, newName),
            onCancel: () => this.render()
        });
    }

    renderEntryForm(scenario) {
        const form = document.createElement('div');
        form.className = 'entry-form';

        const inputsContainer = document.createElement('div');
        inputsContainer.className = 'entry-inputs';

        scenario.entries.forEach((entry, index) => {
            const entryRow = document.createElement('div');
            entryRow.className = 'entry-row';

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.placeholder = this.constructor.entryPlaceholder;
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
                this.updateTotal();
            });
            amountInput.addEventListener('blur', () => {
                entry.amount = Number(amountInput.value) || 0;
                this.render();
            });

            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'remove-entry-input';
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', () => this.removeEntry(index));

            entryRow.appendChild(nameInput);
            entryRow.appendChild(amountInput);
            entryRow.appendChild(removeButton);
            inputsContainer.appendChild(entryRow);
        });

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'add-entry-button';
        addButton.textContent = this.constructor.addEntryLabel;
        addButton.addEventListener('click', () => this.addEntry());

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
        // Scenario may have been deleted concurrently (e.g. stale event); nothing to rename.
        if (!scenario) {
            this.render();
            return;
        }
        scenario.name = newName;
        this.render();
    }

    addEntry() {
        this.getActiveScenario().entries.push({ name: '', amount: 0 });
        this.render();
    }

    removeEntry(entryIndex) {
        const scenario = this.getActiveScenario();
        // At minimum, one entry is always required.
        if (scenario.entries.length <= 1) {
            return;
        }
        scenario.entries.splice(entryIndex, 1);
        this.render();
    }

    /**
     * Adds or updates an entry by name in the active scenario.
     * @param {string} name
     * @param {number} amount
     * @param {boolean} [isSettlement=false]
     */
    addOrUpdateEntry(name, amount, isSettlement = false) {
        const scenario = this.getActiveScenario();
        const existing = scenario.entries.find((entry) => entry.name === name || (isSettlement && entry.isSettlement));
        if (existing) {
            existing.name = name;
            existing.amount = amount;
            if (isSettlement) {
                existing.isSettlement = true;
            }
        } else {
            // Replace a single empty initial entry if present
            if (scenario.entries.length === 1 && scenario.entries[0].name === '' && Number(scenario.entries[0].amount) === 0) {
                scenario.entries[0] = { name, amount, isSettlement };
            } else {
                scenario.entries.push({ name, amount, isSettlement });
            }
        }
        this.persistAndNotify();
        this.render();
    }

    /**
     * Removes an entry by name or settlement flag if present.
     * @param {string} name
     */
    removeEntryByName(name) {
        const scenario = this.getActiveScenario();
        const index = scenario.entries.findIndex((entry) => entry.name === name || entry.isSettlement);
        if (index !== -1) {
            if (scenario.entries.length === 1) {
                scenario.entries[0] = { name: '', amount: 0 };
            } else {
                scenario.entries.splice(index, 1);
            }
            this.persistAndNotify();
            this.render();
        }
    }
}

/** Default name used for settlement entries */
export const SETTLEMENT_ENTRY_NAME = 'Shared expense settlement';

/**
 * Builds a chip-based scenario switcher. Reusable by any component backed by
 * a `{ activeScenarioId, scenarios }` state, not just per-person ones.
 * @param {{ activeScenarioId: string, scenarios: Scenario[] }} state
 * @param {{ onSwitch: (scenarioId: string) => void, onStartRename: (chip: HTMLElement, scenario: Scenario) => void, onDelete: (scenarioId: string) => void, onAdd: () => void }} handlers
 */
export function renderScenarioChips(state, handlers) {
    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'scenario-chips';

    state.scenarios.forEach((scenario) => {
        const chip = document.createElement('div');
        chip.className = 'scenario-chip' + (scenario.id === state.activeScenarioId ? ' active' : '');

        const label = document.createElement('button');
        label.type = 'button';
        label.className = 'scenario-chip-label';
        label.textContent = scenario.name;
        label.addEventListener('click', () => handlers.onSwitch(scenario.id));
        chip.appendChild(label);

        const renameButton = document.createElement('button');
        renameButton.type = 'button';
        renameButton.className = 'scenario-chip-rename-trigger';
        renameButton.title = 'Rename scenario';
        renameButton.textContent = '\u270e';
        renameButton.addEventListener('click', () => handlers.onStartRename(chip, scenario));
        chip.appendChild(renameButton);

        if (state.scenarios.length > 1) {
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'scenario-chip-delete';
            deleteButton.title = 'Delete scenario';
            deleteButton.textContent = '\u00d7';
            deleteButton.addEventListener('click', () => handlers.onDelete(scenario.id));
            chip.appendChild(deleteButton);
        }

        chipsContainer.appendChild(chip);
    });

    const addChip = document.createElement('button');
    addChip.type = 'button';
    addChip.className = 'scenario-chip-add';
    addChip.title = 'New scenario';
    addChip.textContent = '+';
    addChip.addEventListener('click', () => handlers.onAdd());
    chipsContainer.appendChild(addChip);

    return chipsContainer;
}

/**
 * Replaces a scenario chip's contents with a rename input.
 * @param {HTMLElement} chip
 * @param {Scenario} scenario
 * @param {{ onCommit: (newName: string) => void, onCancel: () => void }} handlers
 */
export function startRenameScenario(chip, scenario, handlers) {
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
            handlers.onCommit(newName);
        } else {
            handlers.onCancel();
        }
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            input.blur();
        } else if (event.key === 'Escape') {
            handlers.onCancel();
        }
    });
}

/** @param {() => Entry} [entryFactory] */
export function createDefaultScenario(entryFactory = () => ({ name: '', amount: 0 })) {
    return { id: uid('scenario'), name: 'Default', entries: [entryFactory()] };
}

/** @param {string} prefix */
export function uid(prefix) {
    return prefix + '-' + Math.random().toString(36).slice(2, 10);
}

/** @param {number} amount */
export function formatAmount(amount) {
    return amount.toFixed(2);
}

function scenarioTotal(scenario, excludeSettlement = false) {
    return scenario.entries.reduce((sum, entry) => {
        if (excludeSettlement && (entry.isSettlement || entry.name === SETTLEMENT_ENTRY_NAME)) {
            return sum;
        }
        return sum + (Number(entry.amount) || 0);
    }, 0);
}

/** @param {string} storageKey */
function loadAll(storageKey) {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
        return {};
    }
    try {
        const parsed = JSON.parse(raw);
        // Legacy format stored a flat array of persons with embedded scenarios; discard it in favor of the per-person map.
        if (Array.isArray(parsed)) {
            return {};
        }
        // Migrate the older `incomes` field name to the generic `entries` field.
        Object.values(parsed).forEach((state) => {
            state.scenarios?.forEach((scenario) => {
                if (!scenario.entries && scenario.incomes) {
                    scenario.entries = scenario.incomes;
                    delete scenario.incomes;
                }
            });
        });
        return parsed;
    } catch (error) {
        return {};
    }
}
