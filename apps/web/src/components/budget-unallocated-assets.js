/** @typedef {import('../models.js').Entry} Entry */
import { personStore } from '../person-store.js';
import { scenarioSheet, formatAmount } from './scenario-budget.js';

const STORAGE_KEY = 'budget-planner-unallocated-assets';

/**
 * Per-person list of money and assets held elsewhere (other accounts, gold, cash).
 * Purely informational: no other component reads these totals, and it uses no scenarios.
 */
export class BudgetUnallocatedAssets extends HTMLElement {
    static get observedAttributes() {
        return ['person-id'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.adoptedStyleSheets = [scenarioSheet];
        /** @type {Record<string, Entry[]>} */
        this.data = load();
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

    /** @returns {Entry[]} */
    entries() {
        if (!this.data[this.personId]) {
            this.data[this.personId] = [];
        }
        return this.data[this.personId];
    }

    /** @returns {number} */
    total() {
        return this.entries().reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
    }

    persistAndNotify() {
        // Merge into fresh storage: sibling per-person elements each hold their own copy of the map.
        const stored = load();
        stored[this.personId] = this.entries();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        this.dispatchEvent(new CustomEvent('unallocated-assets-changed', { bubbles: true, composed: true }));
    }

    render() {
        const root = this.shadowRoot;
        root.innerHTML = '';

        const heading = document.createElement('h3');
        heading.className = 'person-name';
        heading.textContent = personStore.get(this.personId)?.name ?? 'Person';
        root.appendChild(heading);

        const list = document.createElement('div');
        list.className = 'entry-inputs';
        this.entries().forEach((entry, index) => list.appendChild(this.renderRow(entry, index)));
        root.appendChild(list);

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'add-entry-button';
        addButton.textContent = 'Add new asset';
        addButton.addEventListener('click', () => {
            this.entries().push({ name: '', amount: 0 });
            this.persistAndNotify();
            this.render();
        });
        root.appendChild(addButton);

        const total = document.createElement('p');
        total.className = 'person-total';
        total.innerHTML = `Total: <span class="total-amount">${formatAmount(this.total())}</span>`;
        root.appendChild(total);
    }

    /** @param {Entry} entry @param {number} index */
    renderRow(entry, index) {
        const row = document.createElement('div');
        row.className = 'entry-row';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Asset (e.g. cash, gold)';
        nameInput.value = entry.name;
        nameInput.addEventListener('input', () => {
            entry.name = nameInput.value;
            this.persistAndNotify();
        });

        const amountInput = document.createElement('input');
        amountInput.type = 'number';
        amountInput.placeholder = 'Amount';
        amountInput.value = String(entry.amount);
        amountInput.addEventListener('input', () => {
            // Keep the raw string while typing so partial input (e.g. "1e") isn't clobbered.
            entry.amount = amountInput.value;
            this.updateTotal();
        });
        amountInput.addEventListener('blur', () => {
            entry.amount = Number(amountInput.value) || 0;
            this.updateTotal();
        });

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'remove-entry-input';
        removeButton.textContent = 'Remove';
        removeButton.addEventListener('click', () => {
            this.entries().splice(index, 1);
            this.persistAndNotify();
            this.render();
        });

        row.appendChild(nameInput);
        row.appendChild(amountInput);
        row.appendChild(removeButton);
        return row;
    }

    updateTotal() {
        const totalEl = this.shadowRoot.querySelector('.total-amount');
        if (totalEl) {
            totalEl.textContent = formatAmount(this.total());
        }
        this.persistAndNotify();
    }
}

customElements.define('budget-unallocated-assets', BudgetUnallocatedAssets);

function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return {};
    }
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
        return {};
    }
}
