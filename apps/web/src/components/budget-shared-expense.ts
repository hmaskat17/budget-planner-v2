import type { Scenario, ScenarioState, SharedExpenseEntry } from '@budget-planner/core';
import { createId, entriesTotal, formatAmount } from '@budget-planner/core';
import { personStore } from '../person-store.ts';
import { scenarioSheet, renderScenarioChips, startRenameScenario } from './scenario-budget.ts';

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
  data: ScenarioState<SharedExpenseEntry>;
  private _unsubscribe?: () => void;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot!.adoptedStyleSheets = [scenarioSheet, sheet];
    this.data = load();
  }

  connectedCallback(): void {
    this._unsubscribe = personStore.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback(): void {
    this._unsubscribe?.();
  }

  getActiveScenario(): Scenario<SharedExpenseEntry> {
    const found = this.data.scenarios.find((scenario) => scenario.id === this.data.activeScenarioId);
    if (!found) {
      const fallback = createDefaultSharedScenario();
      this.data.scenarios.push(fallback);
      this.data.activeScenarioId = fallback.id;
      return fallback;
    }
    return found;
  }

  /** Reassigns entries belonging to a removed person to the first remaining person. */
  reconcilePersonIds(): void {
    const people = personStore.getAll();
    if (!people.length) {
      return;
    }
    const validIds = new Set(people.map((person) => person.id));
    this.getActiveScenario().entries.forEach((entry) => {
      if (!entry.personId || !validIds.has(entry.personId)) {
        entry.personId = people[0].id;
      }
    });
  }

  personTotal(personId: string): number {
    const entries = this.getActiveScenario().entries.filter((entry) => entry.personId === personId);
    return entriesTotal(entries);
  }

  total(): number {
    return entriesTotal(this.getActiveScenario().entries);
  }

  persistAndNotify(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    this.dispatchEvent(new CustomEvent('shared-expense-changed', { bubbles: true, composed: true }));
  }

  render(): void {
    this.reconcilePersonIds();
    const activeScenario = this.getActiveScenario();
    const people = personStore.getAll();
    const root = this.shadowRoot!;
    root.innerHTML = '';

    root.appendChild(
      renderScenarioChips(this.data as unknown as ScenarioState, {
        onSwitch: (scenarioId) => this.switchScenario(scenarioId),
        onStartRename: (chip, scenario) => this.handleStartRename(chip, scenario),
        onDelete: (scenarioId) => this.deleteScenario(scenarioId),
        onAdd: () => this.addScenario()
      })
    );
    root.appendChild(this.renderEntryForm(activeScenario, people));
    root.appendChild(this.renderSubtotals(people));

    const total = document.createElement('p');
    total.className = 'household-total';
    total.innerHTML = `Combined shared expenses: <span class="total-amount">${formatAmount(this.total())}</span>`;
    root.appendChild(total);

    this.persistAndNotify();
  }

  updateTotals(): void {
    const people = personStore.getAll();
    people.forEach((person) => {
      const el = this.shadowRoot?.querySelector(`[data-person-subtotal="${person.id}"]`);
      if (el) {
        el.textContent = formatAmount(this.personTotal(person.id));
      }
    });
    const totalEl = this.shadowRoot?.querySelector('.household-total .total-amount');
    if (totalEl) {
      totalEl.textContent = formatAmount(this.total());
    }
    this.persistAndNotify();
  }

  handleStartRename(chip: HTMLElement, scenario: Scenario): void {
    startRenameScenario(chip, scenario, {
      onCommit: (newName) => this.renameScenario(scenario.id, newName),
      onCancel: () => this.render()
    });
  }

  renderEntryForm(scenario: Scenario<SharedExpenseEntry>, people: ReturnType<typeof personStore.getAll>): HTMLElement {
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
      amountInput.value = String(entry.amount);
      amountInput.addEventListener('input', () => {
        entry.amount = Number(amountInput.value) || 0;
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

  renderSubtotals(people: ReturnType<typeof personStore.getAll>): HTMLElement {
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

  switchScenario(scenarioId: string): void {
    this.data.activeScenarioId = scenarioId;
    this.render();
  }

  addScenario(): void {
    const scenario = createDefaultSharedScenario();
    this.data.scenarios.push(scenario);
    this.data.activeScenarioId = scenario.id;
    this.render();

    const chips = this.shadowRoot?.querySelectorAll('.scenario-chip');
    const chip = chips && chips.length > 0 ? (chips[chips.length - 1] as HTMLElement) : null;
    if (chip) {
      this.handleStartRename(chip, scenario);
    }
  }

  deleteScenario(scenarioId: string): void {
    if (this.data.scenarios.length <= 1) {
      return;
    }
    this.data.scenarios = this.data.scenarios.filter((scenario) => scenario.id !== scenarioId);
    if (this.data.activeScenarioId === scenarioId) {
      this.data.activeScenarioId = this.data.scenarios[0].id;
    }
    this.render();
  }

  renameScenario(scenarioId: string, newName: string): void {
    const scenario = this.data.scenarios.find((candidate) => candidate.id === scenarioId);
    if (!scenario) {
      this.render();
      return;
    }
    scenario.name = newName;
    this.render();
  }

  addEntry(): void {
    const people = personStore.getAll();
    this.getActiveScenario().entries.push({ name: '', amount: 0, personId: people[0]?.id });
    this.render();
  }

  removeEntry(entryIndex: number): void {
    this.getActiveScenario().entries.splice(entryIndex, 1);
    this.render();
  }
}

customElements.define('budget-shared-expense', BudgetSharedExpense);

function createDefaultSharedScenario(): Scenario<SharedExpenseEntry> {
  return { id: createId('scenario'), name: 'Default', entries: [] };
}

function load(): ScenarioState<SharedExpenseEntry> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.scenarios) && parsed.scenarios.length > 0) {
        return parsed as ScenarioState<SharedExpenseEntry>;
      }
    } catch {
      // Ignore corrupt data and fall back to defaults.
    }
  }
  const scenario = createDefaultSharedScenario();
  return { activeScenarioId: scenario.id, scenarios: [scenario] };
}
