import type { Scenario, ScenarioState } from '@budget-planner/core';
import {
  createDefaultScenario as coreCreateDefaultScenario,
  createId,
  formatAmount,
  scenarioTotal,
  setSettlementEntry,
  removeSettlementEntry,
  SETTLEMENT_ENTRY_NAME
} from '@budget-planner/core';
import { personStore } from '../person-store.ts';

export { formatAmount, createId, SETTLEMENT_ENTRY_NAME };

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
    .entry-row.settlement input {
        background: #f1f5f9;
        color: #475569;
    }
    .entry-spacer {
        visibility: hidden;
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

export interface ScenarioChipHandlers {
  onSwitch: (scenarioId: string) => void;
  onStartRename: (chip: HTMLElement, scenario: Scenario) => void;
  onDelete: (scenarioId: string) => void;
  onAdd: () => void;
}

export interface ScenarioRenameHandlers {
  onCommit: (newName: string) => void;
  onCancel: () => void;
}

/**
 * Base for per-person, scenario-based budget components (income, personal expenses, ...).
 * Subclasses configure storage/labels via static getters and call customElements.define.
 */
export class ScenarioBudgetElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['person-id'];
  }

  static get storageKey(): string {
    throw new Error('storageKey must be implemented by subclass');
  }

  static get changeEventName(): string {
    throw new Error('changeEventName must be implemented by subclass');
  }

  static get entryPlaceholder(): string {
    return 'Source';
  }

  static get addEntryLabel(): string {
    return 'Add new entry';
  }

  data: Record<string, ScenarioState>;
  private _unsubscribe?: () => void;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot!.adoptedStyleSheets = [scenarioSheet];
    const ctor = this.constructor as typeof ScenarioBudgetElement;
    this.data = loadAll(ctor.storageKey);
  }

  connectedCallback(): void {
    this._unsubscribe = personStore.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback(): void {
    this._unsubscribe?.();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) {
      this.render();
    }
  }

  get personId(): string {
    return this.getAttribute('person-id') ?? '';
  }

  ensureScenarioState(): ScenarioState {
    if (!this.data[this.personId]) {
      const scenario = coreCreateDefaultScenario(createId('scenario'));
      this.data[this.personId] = { activeScenarioId: scenario.id, scenarios: [scenario] };
    }
    return this.data[this.personId];
  }

  getActiveScenario(): Scenario | undefined {
    const state = this.ensureScenarioState();
    return state.scenarios.find((scenario) => scenario.id === state.activeScenarioId);
  }

  /** Total including any settlement adjustments */
  total(): number {
    return scenarioTotal(this.getActiveScenario());
  }

  /** Base total excluding settlement adjustments */
  baseTotal(): number {
    return scenarioTotal(this.getActiveScenario(), true);
  }

  persistAndNotify(): void {
    const ctor = this.constructor as typeof ScenarioBudgetElement;
    const stored = loadAll(ctor.storageKey);
    stored[this.personId] = this.ensureScenarioState();
    localStorage.setItem(ctor.storageKey, JSON.stringify(stored));
    this.dispatchEvent(new CustomEvent(ctor.changeEventName, { bubbles: true, composed: true }));
  }

  render(): void {
    const state = this.ensureScenarioState();
    const activeScenario = this.getActiveScenario();
    const root = this.shadowRoot!;
    root.innerHTML = '';

    const heading = document.createElement('h3');
    heading.className = 'person-name';
    heading.textContent = personStore.get(this.personId)?.name ?? 'Person';
    root.appendChild(heading);

    root.appendChild(this.renderScenarioChips(state));
    if (activeScenario) {
      root.appendChild(this.renderEntryForm(activeScenario));
    }

    const total = document.createElement('p');
    total.className = 'person-total';
    total.innerHTML = `Total: <span class="total-amount">${formatAmount(this.total())}</span>`;
    root.appendChild(total);

    this.persistAndNotify();
  }

  updateTotal(): void {
    const totalEl = this.shadowRoot?.querySelector('.total-amount');
    if (totalEl) {
      totalEl.textContent = formatAmount(this.total());
    }
    this.persistAndNotify();
  }

  renderScenarioChips(state: ScenarioState): HTMLElement {
    return renderScenarioChips(state, {
      onSwitch: (scenarioId) => this.switchScenario(scenarioId),
      onStartRename: (chip, scenario) => this.startRenameScenario(chip, scenario),
      onDelete: (scenarioId) => this.deleteScenario(scenarioId),
      onAdd: () => this.addScenario()
    });
  }

  startRenameScenario(chip: HTMLElement, scenario: Scenario): void {
    startRenameScenario(chip, scenario, {
      onCommit: (newName) => this.renameScenario(scenario.id, newName),
      onCancel: () => this.render()
    });
  }

  renderEntryForm(scenario: Scenario): HTMLElement {
    const ctor = this.constructor as typeof ScenarioBudgetElement;
    const form = document.createElement('div');
    form.className = 'entry-form';

    const inputsContainer = document.createElement('div');
    inputsContainer.className = 'entry-inputs';

    scenario.entries.forEach((entry, index) => {
      const entryRow = document.createElement('div');
      entryRow.className = 'entry-row';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = ctor.entryPlaceholder;
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

      // Settlement entries are managed by the proportional contributions component.
      if (entry.isSettlement) {
        nameInput.readOnly = true;
        amountInput.readOnly = true;
        entryRow.classList.add('settlement');
        entryRow.appendChild(nameInput);
        entryRow.appendChild(amountInput);

        const spacer = document.createElement('button');
        spacer.type = 'button';
        spacer.textContent = 'Remove';
        spacer.className = 'entry-spacer';
        spacer.tabIndex = -1;
        spacer.setAttribute('aria-hidden', 'true');
        entryRow.appendChild(spacer);
        inputsContainer.appendChild(entryRow);
        return;
      }

      amountInput.addEventListener('input', () => {
        entry.amount = Number(amountInput.value) || 0;
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
    addButton.textContent = ctor.addEntryLabel;
    addButton.addEventListener('click', () => this.addEntry());

    form.appendChild(inputsContainer);
    form.appendChild(addButton);
    return form;
  }

  switchScenario(scenarioId: string): void {
    this.ensureScenarioState().activeScenarioId = scenarioId;
    this.render();
  }

  addScenario(): void {
    const state = this.ensureScenarioState();
    const scenario = coreCreateDefaultScenario(createId('scenario'));
    state.scenarios.push(scenario);
    state.activeScenarioId = scenario.id;
    this.render();

    const chips = this.shadowRoot?.querySelectorAll('.scenario-chip');
    const chip = chips && chips.length > 0 ? (chips[chips.length - 1] as HTMLElement) : null;
    if (chip) {
      this.startRenameScenario(chip, scenario);
    }
  }

  deleteScenario(scenarioId: string): void {
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

  renameScenario(scenarioId: string, newName: string): void {
    const scenario = this.ensureScenarioState().scenarios.find((candidate) => candidate.id === scenarioId);
    if (!scenario) {
      this.render();
      return;
    }
    scenario.name = newName;
    this.render();
  }

  addEntry(): void {
    const active = this.getActiveScenario();
    if (active) {
      active.entries.push({ name: '', amount: 0 });
      this.render();
    }
  }

  removeEntry(entryIndex: number): void {
    const scenario = this.getActiveScenario();
    if (!scenario || scenario.entries.length <= 1) {
      return;
    }
    scenario.entries.splice(entryIndex, 1);
    this.render();
  }

  hasSettlement(): boolean {
    const active = this.getActiveScenario();
    return active ? active.entries.some((entry) => entry.isSettlement) : false;
  }

  setSettlement(amount: number): void {
    const scenario = this.getActiveScenario();
    if (!scenario) {
      return;
    }
    const updated = setSettlementEntry(scenario, amount, SETTLEMENT_ENTRY_NAME);
    scenario.entries = updated.entries;
    this.render();
  }

  removeSettlement(): void {
    const scenario = this.getActiveScenario();
    if (!scenario) {
      return;
    }
    const updated = removeSettlementEntry(scenario);
    scenario.entries = updated.entries;
    this.render();
  }
}

/**
 * Builds a chip-based scenario switcher. Reusable by any component backed by
 * a { activeScenarioId, scenarios } state, not just per-person ones.
 */
export function renderScenarioChips(state: ScenarioState, handlers: ScenarioChipHandlers): HTMLElement {
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
 */
export function startRenameScenario(chip: HTMLElement, scenario: Scenario, handlers: ScenarioRenameHandlers): void {
  chip.innerHTML = '';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'scenario-chip-rename';
  input.value = scenario.name;
  chip.appendChild(input);
  input.focus();
  input.select();

  const commit = (): void => {
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

function loadAll(storageKey: string): Record<string, ScenarioState> {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null) {
      return {};
    }
    // Migrate older format if needed
    Object.values(parsed).forEach((st: any) => {
      st.scenarios?.forEach((scenario: any) => {
        if (!scenario.entries && scenario.incomes) {
          scenario.entries = scenario.incomes;
          delete scenario.incomes;
        }
      });
    });
    return parsed as Record<string, ScenarioState>;
  } catch {
    return {};
  }
}
