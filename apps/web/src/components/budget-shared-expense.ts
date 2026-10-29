import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import type { Scenario, ScenarioState, SharedExpenseEntry } from '@budget-planner/core';
import { createId, entriesTotal, formatAmount } from '@budget-planner/core';
import { scenarioStyles } from './scenario-budget.ts';
import { budgetContext, type BudgetContextValue } from '../context/budget-context.ts';
import { icon } from '../ui/icons.ts';

/**
 * Household-wide shared expense component. Unlike the per-person budgets, this mounts once:
 * every entry is tagged with a person-id so the list stays visible even if a person is hidden.
 */
@customElement('budget-shared-expense')
export class BudgetSharedExpense extends LitElement {
  static override styles = [
    scenarioStyles,
    css`
      :host {
        container-type: inline-size;
      }
      .entry-row {
        grid-template-columns: minmax(0, 1fr) minmax(72px, 100px) minmax(96px, 130px) 32px;
      }
      /* Two-line rows when the card is too narrow for four columns. */
      @container (max-width: 440px) {
        .entry-row {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 32px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border-soft);
        }
        .entry-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .entry-row input[type='text'] {
          grid-column: 1 / 3;
        }
        .entry-row .remove-entry-input {
          grid-column: 3;
          grid-row: 1;
        }
        .entry-row input[type='number'] {
          grid-column: 1;
          grid-row: 2;
        }
        .entry-row select {
          grid-column: 2 / 4;
          grid-row: 2;
        }
      }
      .person-subtotals {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-top: 16px;
        padding-top: 12px;
        border-top: 1px solid var(--border);
      }
      .person-subtotal-row {
        color: var(--muted);
      }
      .household-total {
        margin-top: 12px;
      }
    `
  ];

  @consume({ context: budgetContext, subscribe: true })
  budget?: BudgetContextValue;

  @state()
  private _renamingScenarioId: string | null = null;

  @state()
  private _renamingName = '';

  private _getSharedState(): ScenarioState<SharedExpenseEntry> {
    if (this.budget) {
      return this.budget.data.sharedExpenses;
    }
    const fallback = createDefaultSharedScenario();
    return { activeScenarioId: fallback.id, scenarios: [fallback] };
  }

  getActiveScenario(): Scenario<SharedExpenseEntry> {
    const data = this._getSharedState();
    const found = data.scenarios.find((scenario) => scenario.id === data.activeScenarioId);
    if (!found) {
      const fallback = createDefaultSharedScenario();
      return fallback;
    }
    return found;
  }

  personTotal(personId: string): number {
    const entries = this.getActiveScenario().entries.filter((entry) => entry.personId === personId);
    return entriesTotal(entries);
  }

  total(): number {
    return entriesTotal(this.getActiveScenario().entries);
  }

  private _commitState(nextState: ScenarioState<SharedExpenseEntry>): void {
    if (this.budget) {
      this.budget.updateSharedExpenses(nextState);
    }
  }

  switchScenario(scenarioId: string): void {
    const current = this._getSharedState();
    this._commitState({ ...current, activeScenarioId: scenarioId });
  }

  addScenario(): void {
    const current = this._getSharedState();
    const newScenario = createDefaultSharedScenario();
    this._commitState({
      activeScenarioId: newScenario.id,
      scenarios: [...current.scenarios, newScenario]
    });
    this.startRenameScenario(newScenario.id, newScenario.name);
  }

  deleteScenario(scenarioId: string): void {
    const current = this._getSharedState();
    if (current.scenarios.length <= 1) return;

    const remaining = current.scenarios.filter((s) => s.id !== scenarioId);
    const nextActive = current.activeScenarioId === scenarioId ? remaining[0].id : current.activeScenarioId;
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
      const current = this._getSharedState();
      this._commitState({
        ...current,
        scenarios: current.scenarios.map((s) => (s.id === scenarioId ? { ...s, name } : s))
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
    const current = this._getSharedState();
    const active = this.getActiveScenario();
    const people = this.budget?.data.people ?? [];
    const firstPersonId = people[0]?.id;

    const updatedScenario: Scenario<SharedExpenseEntry> = {
      ...active,
      entries: [...active.entries, { name: '', amount: 0, personId: firstPersonId }]
    };

    this._commitState({
      ...current,
      scenarios: current.scenarios.map((s) => (s.id === active.id ? updatedScenario : s))
    });
  }

  removeEntry(entryIndex: number): void {
    const current = this._getSharedState();
    const active = this.getActiveScenario();

    const updatedScenario: Scenario<SharedExpenseEntry> = {
      ...active,
      entries: active.entries.filter((_, idx) => idx !== entryIndex)
    };

    this._commitState({
      ...current,
      scenarios: current.scenarios.map((s) => (s.id === active.id ? updatedScenario : s))
    });
  }

  updateEntryName(entryIndex: number, name: string): void {
    const current = this._getSharedState();
    const active = this.getActiveScenario();

    const entries = active.entries.map((entry, idx) => (idx === entryIndex ? { ...entry, name } : entry));
    this._commitState({
      ...current,
      scenarios: current.scenarios.map((s) => (s.id === active.id ? { ...s, entries } : s))
    });
  }

  updateEntryAmount(entryIndex: number, amountStr: string): void {
    const current = this._getSharedState();
    const active = this.getActiveScenario();

    const amount = Number(amountStr) || 0;
    const entries = active.entries.map((entry, idx) => (idx === entryIndex ? { ...entry, amount } : entry));
    this._commitState({
      ...current,
      scenarios: current.scenarios.map((s) => (s.id === active.id ? { ...s, entries } : s))
    });
  }

  updateEntryPersonId(entryIndex: number, personId: string): void {
    const current = this._getSharedState();
    const active = this.getActiveScenario();

    const entries = active.entries.map((entry, idx) => (idx === entryIndex ? { ...entry, personId } : entry));
    this._commitState({
      ...current,
      scenarios: current.scenarios.map((s) => (s.id === active.id ? { ...s, entries } : s))
    });
  }

  override render() {
    const current = this._getSharedState();
    const activeScenario = this.getActiveScenario();
    const people = this.budget?.data.people ?? [];

    return html`
      <div class="scenario-chips">
        ${current.scenarios.map((scenario) => {
          const isActive = scenario.id === current.activeScenarioId;
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
                    ${current.scenarios.length > 1
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

      <div class="entry-form">
        <div class="entry-inputs">
          ${activeScenario.entries.map((entry, index) => html`
            <div class="entry-row">
              <input
                type="text"
                placeholder="Expense source"
                required
                .value=${entry.name}
                @input=${(e: Event) =>
                  this.updateEntryName(index, (e.target as HTMLInputElement).value)}
              />
              <input
                type="number"
                placeholder="Amount"
                required
                .value=${String(entry.amount)}
                @input=${(e: Event) =>
                  this.updateEntryAmount(index, (e.target as HTMLInputElement).value)}
              />
              <select
                @change=${(e: Event) =>
                  this.updateEntryPersonId(index, (e.target as HTMLSelectElement).value)}
              >
                ${people.map(
                  (person) => html`
                    <option
                      value=${person.id}
                      ?selected=${person.id === entry.personId}
                    >
                      ${person.name}
                    </option>
                  `
                )}
              </select>
              <button
                type="button"
                class="remove-entry-input"
                title="Remove"
                aria-label="Remove"
                @click=${() => this.removeEntry(index)}
              >
                ${icon('trash', 16)}
              </button>
            </div>
          `)}
        </div>
        <button
          type="button"
          class="add-entry-button"
          @click=${() => this.addEntry()}
        >
          ${icon('plus', 14)}Add new shared expense
        </button>
      </div>

      <div class="person-subtotals">
        ${people.map(
          (person) => html`
            <div class="person-subtotal-row">
              <span>${person.name}</span>
              <span data-person-subtotal=${person.id}>${formatAmount(this.personTotal(person.id))} €</span>
            </div>
          `
        )}
      </div>

      <p class="household-total">
        <span>Combined shared expenses</span>
        <span class="total-amount">${formatAmount(this.total())} €</span>
      </p>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'budget-shared-expense': BudgetSharedExpense;
  }
}

function createDefaultSharedScenario(): Scenario<SharedExpenseEntry> {
  return { id: createId('scenario'), name: 'Default', entries: [] };
}
