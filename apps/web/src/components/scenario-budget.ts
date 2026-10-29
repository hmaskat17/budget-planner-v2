import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
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
import { budgetContext, type BudgetContextValue } from '../context/budget-context.ts';
import { baseStyles } from '../ui/shared-styles.ts';
import { icon } from '../ui/icons.ts';

export { formatAmount, createId, SETTLEMENT_ENTRY_NAME };

/** Shared styles for scenario chips and entry rows */
export const scenarioStyles = [
  baseStyles,
  css`
    :host {
      padding: 18px;
      background: var(--surface-2);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius);
    }
    .entry-row.settlement input {
      font-style: italic;
    }
    .scenario-chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-bottom: 16px;
    }
    .scenario-chip {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      height: 28px;
      padding: 0 4px 0 12px;
      font-size: 0.8125rem;
      color: var(--text-2);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 999px;
    }
    .scenario-chip.active {
      color: #fff;
      background: var(--accent);
      border-color: var(--accent);
    }
    .scenario-chip-label {
      padding: 0 4px 0 0;
      color: inherit;
      background: transparent;
      border: none;
      font: inherit;
      font-weight: 500;
    }
    .scenario-chip-rename-trigger,
    .scenario-chip-delete {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      padding: 0;
      color: inherit;
      background: transparent;
      border: none;
      border-radius: 50%;
      opacity: 0.55;
    }
    .scenario-chip-rename-trigger:hover,
    .scenario-chip-delete:hover {
      opacity: 1;
      background: color-mix(in srgb, currentColor 15%, transparent);
    }
    .scenario-chip-rename {
      width: 110px;
      height: 24px;
      margin: 0 4px 0 -6px;
      padding: 0 8px;
      font-size: 0.8125rem;
      color: var(--text);
    }
    .scenario-chip-add {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      color: var(--muted);
      background: transparent;
      border: 1px dashed var(--border);
      border-radius: 50%;
    }
    .scenario-chip-add:hover {
      color: var(--accent);
      border-color: var(--accent);
    }
  `
];

/**
 * Base for per-person, scenario-based budget components (income, personal expenses).
 * Consumes budgetContext and renders using Lit templates.
 */
export abstract class ScenarioBudgetElement extends LitElement {
  static override styles = scenarioStyles;

  @property({ type: String, attribute: 'person-id' })
  personId = '';

  @consume({ context: budgetContext, subscribe: true })
  budget?: BudgetContextValue;

  @state()
  private _renamingScenarioId: string | null = null;

  @state()
  private _renamingName = '';

  abstract get entryPlaceholder(): string;
  abstract get addEntryLabel(): string;
  abstract getScenarioState(budget: BudgetContextValue): ScenarioState;
  abstract updateScenarioState(budget: BudgetContextValue, state: ScenarioState): void;

  ensureScenarioState(): ScenarioState {
    if (this.budget) {
      return this.getScenarioState(this.budget);
    }
    const fallback = coreCreateDefaultScenario(createId('scenario'));
    return { activeScenarioId: fallback.id, scenarios: [fallback] };
  }

  getActiveScenario(): Scenario | undefined {
    const state = this.ensureScenarioState();
    return state.scenarios.find((scenario) => scenario.id === state.activeScenarioId);
  }

  total(): number {
    return scenarioTotal(this.getActiveScenario());
  }

  baseTotal(): number {
    return scenarioTotal(this.getActiveScenario(), true);
  }

  private _commitState(updatedState: ScenarioState): void {
    if (this.budget) {
      this.updateScenarioState(this.budget, updatedState);
    }
  }

  switchScenario(scenarioId: string): void {
    const state = this.ensureScenarioState();
    this._commitState({
      ...state,
      activeScenarioId: scenarioId
    });
  }

  addScenario(): void {
    const state = this.ensureScenarioState();
    const newScenario = coreCreateDefaultScenario(createId('scenario'));
    this._commitState({
      activeScenarioId: newScenario.id,
      scenarios: [...state.scenarios, newScenario]
    });
    this.startRenameScenario(newScenario.id, newScenario.name);
  }

  deleteScenario(scenarioId: string): void {
    const state = this.ensureScenarioState();
    if (state.scenarios.length <= 1) {
      return;
    }
    const remaining = state.scenarios.filter((s) => s.id !== scenarioId);
    const nextActive = state.activeScenarioId === scenarioId ? remaining[0].id : state.activeScenarioId;
    this._commitState({
      activeScenarioId: nextActive,
      scenarios: remaining
    });
  }

  startRenameScenario(scenarioId: string, currentName: string): void {
    this._renamingScenarioId = scenarioId;
    this._renamingName = currentName;
  }

  commitRename(scenarioId: string): void {
    const name = this._renamingName.trim();
    if (name) {
      const state = this.ensureScenarioState();
      this._commitState({
        ...state,
        scenarios: state.scenarios.map((s) => (s.id === scenarioId ? { ...s, name } : s))
      });
    }
    this._renamingScenarioId = null;
    this._renamingName = '';
  }

  cancelRename(): void {
    this._renamingScenarioId = null;
    this._renamingName = '';
  }

  addEntry(): void {
    const state = this.ensureScenarioState();
    const active = this.getActiveScenario();
    if (!active) return;

    const updatedScenario: Scenario = {
      ...active,
      entries: [...active.entries, { name: '', amount: 0 }]
    };

    this._commitState({
      ...state,
      scenarios: state.scenarios.map((s) => (s.id === active.id ? updatedScenario : s))
    });
  }

  removeEntry(entryIndex: number): void {
    const state = this.ensureScenarioState();
    const active = this.getActiveScenario();
    if (!active || active.entries.length <= 1) return;

    const updatedScenario: Scenario = {
      ...active,
      entries: active.entries.filter((_, idx) => idx !== entryIndex)
    };

    this._commitState({
      ...state,
      scenarios: state.scenarios.map((s) => (s.id === active.id ? updatedScenario : s))
    });
  }

  updateEntryName(entryIndex: number, name: string): void {
    const state = this.ensureScenarioState();
    const active = this.getActiveScenario();
    if (!active) return;

    const entries = active.entries.map((entry, idx) => (idx === entryIndex ? { ...entry, name } : entry));
    this._commitState({
      ...state,
      scenarios: state.scenarios.map((s) => (s.id === active.id ? { ...s, entries } : s))
    });
  }

  updateEntryAmount(entryIndex: number, amountStr: string): void {
    const state = this.ensureScenarioState();
    const active = this.getActiveScenario();
    if (!active) return;

    const amount = Number(amountStr) || 0;
    const entries = active.entries.map((entry, idx) => (idx === entryIndex ? { ...entry, amount } : entry));
    this._commitState({
      ...state,
      scenarios: state.scenarios.map((s) => (s.id === active.id ? { ...s, entries } : s))
    });
  }

  hasSettlement(): boolean {
    const active = this.getActiveScenario();
    return active ? active.entries.some((entry) => entry.isSettlement) : false;
  }

  setSettlement(amount: number): void {
    const state = this.ensureScenarioState();
    const active = this.getActiveScenario();
    if (!active) return;

    const updated = setSettlementEntry(active, amount, SETTLEMENT_ENTRY_NAME);
    this._commitState({
      ...state,
      scenarios: state.scenarios.map((s) => (s.id === active.id ? updated : s))
    });
  }

  removeSettlement(): void {
    const state = this.ensureScenarioState();
    const active = this.getActiveScenario();
    if (!active) return;

    const updated = removeSettlementEntry(active);
    this._commitState({
      ...state,
      scenarios: state.scenarios.map((s) => (s.id === active.id ? updated : s))
    });
  }

  override render() {
    const person = this.budget?.data.people.find((p) => p.id === this.personId);
    const state = this.ensureScenarioState();
    const activeScenario = this.getActiveScenario();

    return html`
      <h3 class="person-name">${icon('user', 16)}${person?.name ?? 'Person'}</h3>

      <div class="scenario-chips">
        ${state.scenarios.map((scenario) => {
          const isActive = scenario.id === state.activeScenarioId;
          const isRenaming = this._renamingScenarioId === scenario.id;

          return html`
            <div class="scenario-chip ${isActive ? 'active' : ''}">
              ${isRenaming
                ? html`
                    <input
                      type="text"
                      class="scenario-chip-rename"
                      .value=${this._renamingName}
                      @input=${(e: Event) => (this._renamingName = (e.target as HTMLInputElement).value)}
                      @blur=${() => this.commitRename(scenario.id)}
                      @keydown=${(e: KeyboardEvent) => {
                        if (e.key === 'Enter') this.commitRename(scenario.id);
                        if (e.key === 'Escape') this.cancelRename();
                      }}
                      autofocus
                    />
                  `
                : html`
                    <button
                      type="button"
                      class="scenario-chip-label"
                      @click=${() => this.switchScenario(scenario.id)}
                    >
                      ${scenario.name}
                    </button>
                    <button
                      type="button"
                      class="scenario-chip-rename-trigger"
                      title="Rename scenario"
                      aria-label="Rename scenario"
                      @click=${() => this.startRenameScenario(scenario.id, scenario.name)}
                    >
                      ${icon('pencil', 12)}
                    </button>
                    ${state.scenarios.length > 1
                      ? html`
                          <button
                            type="button"
                            class="scenario-chip-delete"
                            title="Delete scenario"
                            aria-label="Delete scenario"
                            @click=${() => this.deleteScenario(scenario.id)}
                          >
                            ${icon('x', 12)}
                          </button>
                        `
                      : ''}
                  `}
            </div>
          `;
        })}
        <button
          type="button"
          class="scenario-chip-add"
          title="New scenario"
          aria-label="New scenario"
          @click=${() => this.addScenario()}
        >
          ${icon('plus', 14)}
        </button>
      </div>

      ${activeScenario
        ? html`
            <div class="entry-form">
              <div class="entry-inputs">
                ${activeScenario.entries.map((entry, index) => html`
                  <div class="entry-row ${entry.isSettlement ? 'settlement' : ''}">
                    <input
                      type="text"
                      placeholder=${this.entryPlaceholder}
                      required
                      ?readonly=${entry.isSettlement}
                      .value=${entry.name}
                      @input=${(e: Event) =>
                        this.updateEntryName(index, (e.target as HTMLInputElement).value)}
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      required
                      ?readonly=${entry.isSettlement}
                      .value=${String(entry.amount)}
                      @input=${(e: Event) =>
                        this.updateEntryAmount(index, (e.target as HTMLInputElement).value)}
                    />
                    ${entry.isSettlement
                      ? html`<button type="button" class="remove-entry-input entry-spacer" tabindex="-1" aria-hidden="true">${icon('trash', 16)}</button>`
                      : html`
                          <button
                            type="button"
                            class="remove-entry-input"
                            title="Remove"
                            aria-label="Remove"
                            @click=${() => this.removeEntry(index)}
                          >
                            ${icon('trash', 16)}
                          </button>
                        `}
                  </div>
                `)}
              </div>
              <button
                type="button"
                class="add-entry-button"
                @click=${() => this.addEntry()}
              >
                ${icon('plus', 14)}${this.addEntryLabel}
              </button>
            </div>
          `
        : ''}

      <p class="person-total">
        <span>Total</span>
        <span class="total-amount">${formatAmount(this.total())} €</span>
      </p>
    `;
  }
}
