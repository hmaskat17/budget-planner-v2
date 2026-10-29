import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { provide } from '@lit/context';
import { Task } from '@lit/task';
import type {
  BudgetData,
  Entry,
  PersonSavingsData,
  ScenarioState,
  SharedExpenseEntry,
  SharedSavingsData
} from '@budget-planner/core';
import {
  addPerson as coreAddPerson,
  applySettlementAdjustments,
  calculateHouseholdTotals,
  calculateProportionalContributions,
  canAddPerson as coreCanAddPerson,
  createDefaultScenario,
  createId,
  formatAmount,
  removePerson as coreRemovePerson,
  removeSettlementAdjustments,
  renamePerson as coreRenamePerson
} from '@budget-planner/core';
import { budgetContext, type BudgetContextValue } from '../context/budget-context.ts';
import { localStorageAdapter } from '../adapters/local-storage-adapter.ts';
import { icon, type IconName } from '../ui/icons.ts';

// Import child components
import './person-editor.ts';
import './budget-income.ts';
import './budget-personal-expense.ts';
import './budget-shared-expense.ts';
import './budget-remaining-balance.ts';
import './budget-savings.ts';
import './budget-proportional-contributions.ts';
import './budget-unallocated-assets.ts';

/** Page sections in display order; drives both the navigation and section headers. */
const SECTIONS: { id: string; label: string; icon: IconName; accent: string }[] = [
  { id: 'household-section', label: 'Household', icon: 'house', accent: '#475569' },
  { id: 'income-section', label: 'Income', icon: 'trendingUp', accent: '#059669' },
  { id: 'personal-expense-section', label: 'Personal expenses', icon: 'creditCard', accent: '#e11d48' },
  { id: 'shared-expense-section', label: 'Shared expenses', icon: 'receipt', accent: '#d97706' },
  { id: 'remaining-balance-section', label: 'Remaining balance', icon: 'wallet', accent: '#0284c7' },
  { id: 'savings-section', label: 'Savings', icon: 'piggyBank', accent: '#7c3aed' },
  { id: 'proportional-contributions-section', label: 'Contributions', icon: 'arrowsLeftRight', accent: '#4f46e5' },
  { id: 'unallocated-assets-section', label: 'Unallocated assets', icon: 'landmark', accent: '#0d9488' }
];

/**
 * Root Application Component for Budget Planner.
 * Loads initial data with @lit/task, manages reactive application state,
 * and provides state across the web component tree with @lit/context.
 */
@customElement('budget-planner-app')
export class BudgetPlannerApp extends LitElement {
  static override styles = css`
    :host {
      display: block;
      font-family: var(--font);
      --nav-offset: 16px;
    }
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }
    [hidden] {
      display: none !important;
    }
    .icon {
      flex: none;
    }

    .app-header {
      max-width: 1180px;
      margin: 0 auto;
      padding: 32px 24px 24px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .logo {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      color: #fff;
      background: var(--primary);
      border-radius: 12px;
    }
    h1 {
      margin: 0;
      font-size: 1.375rem;
      font-weight: 650;
      letter-spacing: -0.01em;
    }
    .tagline {
      margin: 2px 0 0;
      font-size: 0.875rem;
      color: var(--muted);
    }

    .layout {
      display: grid;
      grid-template-columns: 210px minmax(0, 1fr);
      gap: 32px;
      max-width: 1180px;
      margin: 0 auto;
      padding: 0 24px 64px;
    }

    nav {
      position: sticky;
      top: 24px;
      align-self: start;
    }
    nav ul {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    nav a {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--muted);
      text-decoration: none;
      white-space: nowrap;
      border-radius: var(--radius-sm);
      transition: background 0.12s, color 0.12s;
    }
    nav a:hover {
      color: var(--text);
      background: var(--border-soft);
    }
    nav a[aria-current='true'] {
      color: var(--nav-accent);
      background: color-mix(in srgb, var(--nav-accent) 10%, transparent);
    }
    nav a:focus-visible {
      outline: 2px solid var(--nav-accent);
      outline-offset: 1px;
    }

    .budget-section {
      margin-bottom: 24px;
      padding: 28px;
      scroll-margin-top: var(--nav-offset);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }
    .section-head {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 22px;
    }
    .section-icon {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      color: var(--section-accent);
      background: color-mix(in srgb, var(--section-accent) 12%, transparent);
      border-radius: 10px;
    }
    .section-head h2 {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
    }
    .budget-columns {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }

    .person-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    .person-row person-editor {
      flex: 1;
    }
    .remove-person {
      display: grid;
      place-items: center;
      flex: none;
      width: 44px;
      height: 44px;
      padding: 0;
      color: var(--muted);
      background: transparent;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      cursor: pointer;
    }
    .remove-person:hover {
      color: var(--negative);
      background: var(--negative-bg);
      border-color: transparent;
    }
    #add-person {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 40px;
      padding: 0 14px;
      font: inherit;
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--accent);
      background: transparent;
      border: 1px dashed color-mix(in srgb, var(--accent) 45%, transparent);
      border-radius: var(--radius-sm);
      cursor: pointer;
    }
    #add-person:hover {
      background: color-mix(in srgb, var(--accent) 8%, transparent);
    }
    .remove-person:focus-visible,
    #add-person:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    #household-total,
    #household-expense-total,
    #household-assets-total {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin: 20px 0 0;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      color: var(--muted);
      font-size: 0.9rem;
      font-variant-numeric: tabular-nums;
    }
    #household-total strong,
    #household-expense-total strong,
    #household-assets-total strong {
      font-size: 1.25rem;
      font-weight: 650;
      color: var(--text);
    }

    .loading-container {
      text-align: center;
      padding: 40px;
      font-size: 1.1em;
      color: var(--muted);
    }
    .error-container {
      color: var(--negative);
      padding: 20px;
      text-align: center;
    }

    @media (max-width: 900px) {
      :host {
        --nav-offset: 72px;
      }
      .app-header {
        padding: 20px 16px 12px;
      }
      .layout {
        display: block;
        padding: 0 16px 48px;
      }
      nav {
        top: 0;
        z-index: 10;
        margin: 0 -16px 16px;
        padding: 8px 16px;
        background: color-mix(in srgb, var(--bg) 92%, transparent);
        backdrop-filter: blur(8px);
        border-bottom: 1px solid var(--border);
      }
      nav ul {
        flex-direction: row;
        gap: 4px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .budget-section {
        padding: 20px 16px;
      }
    }
  `;

  @state()
  private _budgetData: BudgetData = {
    people: [{ id: 'person-1', name: 'Person 1' }],
    incomeByPerson: {},
    personalExpensesByPerson: {},
    sharedExpenses: {
      activeScenarioId: 'default',
      scenarios: [{ id: 'default', name: 'Default', entries: [] }]
    },
    assetsByPerson: {},
    personalSavingsByPerson: {},
    sharedSavings: { items: [] }
  };

  @provide({ context: budgetContext })
  budgetContextValue: BudgetContextValue = this._createContextValue();

  @state()
  private _activeSection = SECTIONS[0].id;

  private _scrollFrame = 0;

  private readonly _onScroll = (): void => {
    cancelAnimationFrame(this._scrollFrame);
    this._scrollFrame = requestAnimationFrame(() => this._updateActiveSection());
  };

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this._onScroll);
  }

  override disconnectedCallback(): void {
    window.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('resize', this._onScroll);
    cancelAnimationFrame(this._scrollFrame);
    super.disconnectedCallback();
  }

  /** Last section whose top has passed a threshold below the sticky nav. */
  private _updateActiveSection(): void {
    const threshold = window.innerHeight * 0.3;
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    let current = SECTIONS[0].id;
    for (const { id } of SECTIONS) {
      const el = this.renderRoot.querySelector(`#${id}`);
      if (el && el.getBoundingClientRect().top <= threshold) {
        current = id;
      }
    }
    this._activeSection = atBottom ? SECTIONS[SECTIONS.length - 1].id : current;
  }

  private _goToSection(e: Event, id: string): void {
    e.preventDefault();
    this._activeSection = id;
    this.renderRoot.querySelector(`#${id}`)?.scrollIntoView({ block: 'start' });
  }

  /** Async task for loading budget data on startup */
  private _loadDataTask = new Task(this, {
    task: async () => {
      const data = await localStorageAdapter.loadBudgetData();
      this._budgetData = data;
      this._updateContextValue();
      return data;
    },
    args: () => []
  });

  private _createContextValue(): BudgetContextValue {
    return {
      data: this._budgetData,
      canAddPerson: () => coreCanAddPerson(this._budgetData.people),
      addPerson: () => this._addPerson(),
      removePerson: (id: string) => this._removePerson(id),
      renamePerson: (id: string, name: string) => this._renamePerson(id, name),
      updateIncome: (personId: string, state: ScenarioState) =>
        this._updateIncome(personId, state),
      updatePersonalExpense: (personId: string, state: ScenarioState) =>
        this._updatePersonalExpense(personId, state),
      updateSharedExpenses: (state: ScenarioState<SharedExpenseEntry>) =>
        this._updateSharedExpenses(state),
      updateAssets: (personId: string, entries: Entry[]) =>
        this._updateAssets(personId, entries),
      updatePersonalSavings: (personId: string, savings: PersonSavingsData) =>
        this._updatePersonalSavings(personId, savings),
      updateSharedSavings: (savings: SharedSavingsData) =>
        this._updateSharedSavings(savings),
      applySettlements: () => this._applySettlements(),
      removeSettlements: () => this._removeSettlements(),
      isSettlementApplied: () => this._isSettlementApplied()
    };
  }

  private _updateContextValue(): void {
    this.budgetContextValue = this._createContextValue();
    this.requestUpdate();
  }

  private _addPerson(): void {
    if (!coreCanAddPerson(this._budgetData.people)) {
      return;
    }
    const nextIndex = this._budgetData.people.length + 1;
    const newPerson = { id: `person-${nextIndex}`, name: `Person ${nextIndex}` };
    const result = coreAddPerson(this._budgetData.people, newPerson);
    if (result.issues.length === 0) {
      const newIncomeScenario = createDefaultScenario(createId('scenario'));
      const newExpenseScenario = createDefaultScenario(createId('scenario'));

      this._budgetData = {
        ...this._budgetData,
        people: result.people,
        incomeByPerson: {
          ...this._budgetData.incomeByPerson,
          [newPerson.id]: {
            activeScenarioId: newIncomeScenario.id,
            scenarios: [newIncomeScenario]
          }
        },
        personalExpensesByPerson: {
          ...this._budgetData.personalExpensesByPerson,
          [newPerson.id]: {
            activeScenarioId: newExpenseScenario.id,
            scenarios: [newExpenseScenario]
          }
        },
        assetsByPerson: {
          ...this._budgetData.assetsByPerson,
          [newPerson.id]: []
        },
        personalSavingsByPerson: {
          ...this._budgetData.personalSavingsByPerson,
          [newPerson.id]: { sharedContributionPercent: 0, items: [] }
        }
      };

      localStorageAdapter.saveAll(this._budgetData);
      this._updateContextValue();
    }
  }

  private _removePerson(id: string): void {
    const result = coreRemovePerson(this._budgetData.people, id);
    if (result.issues.length === 0) {
      const { [id]: _removedIncome, ...restIncome } = this._budgetData.incomeByPerson;
      const { [id]: _removedExpense, ...restExpense } = this._budgetData.personalExpensesByPerson;
      const { [id]: _removedAssets, ...restAssets } = this._budgetData.assetsByPerson;
      const { [id]: _removedSavings, ...restSavings } = this._budgetData.personalSavingsByPerson;

      // Reassign any shared expense entries for this person to first remaining person
      const remainingFirstId = result.people[0]?.id;
      const updatedSharedScenarios = this._budgetData.sharedExpenses.scenarios.map((sc) => ({
        ...sc,
        entries: sc.entries.map((entry) =>
          entry.personId === id ? { ...entry, personId: remainingFirstId } : entry
        )
      }));

      this._budgetData = {
        ...this._budgetData,
        people: result.people,
        incomeByPerson: restIncome,
        personalExpensesByPerson: restExpense,
        assetsByPerson: restAssets,
        personalSavingsByPerson: restSavings,
        sharedExpenses: {
          ...this._budgetData.sharedExpenses,
          scenarios: updatedSharedScenarios
        }
      };

      localStorageAdapter.saveAll(this._budgetData);
      this._updateContextValue();
    }
  }

  private _renamePerson(id: string, name: string): void {
    const result = coreRenamePerson(this._budgetData.people, id, name);
    if (result.issues.length === 0) {
      this._budgetData = {
        ...this._budgetData,
        people: result.people
      };
      localStorageAdapter.savePeople(this._budgetData.people);
      this._updateContextValue();
    }
  }

  private _updateIncome(personId: string, state: ScenarioState): void {
    this._budgetData = {
      ...this._budgetData,
      incomeByPerson: {
        ...this._budgetData.incomeByPerson,
        [personId]: state
      }
    };
    localStorageAdapter.saveIncome(this._budgetData.incomeByPerson);
    this._updateContextValue();
  }

  private _updatePersonalExpense(personId: string, state: ScenarioState): void {
    this._budgetData = {
      ...this._budgetData,
      personalExpensesByPerson: {
        ...this._budgetData.personalExpensesByPerson,
        [personId]: state
      }
    };
    localStorageAdapter.savePersonalExpenses(this._budgetData.personalExpensesByPerson);
    this._updateContextValue();
  }

  private _updateSharedExpenses(state: ScenarioState<SharedExpenseEntry>): void {
    this._budgetData = {
      ...this._budgetData,
      sharedExpenses: state
    };
    localStorageAdapter.saveSharedExpenses(this._budgetData.sharedExpenses);
    this._updateContextValue();
  }

  private _updateAssets(personId: string, entries: Entry[]): void {
    this._budgetData = {
      ...this._budgetData,
      assetsByPerson: {
        ...this._budgetData.assetsByPerson,
        [personId]: entries
      }
    };
    localStorageAdapter.saveAssets(this._budgetData.assetsByPerson);
    this._updateContextValue();
  }

  private _updatePersonalSavings(personId: string, savings: PersonSavingsData): void {
    this._budgetData = {
      ...this._budgetData,
      personalSavingsByPerson: {
        ...this._budgetData.personalSavingsByPerson,
        [personId]: savings
      }
    };
    localStorageAdapter.savePersonalSavings(this._budgetData.personalSavingsByPerson);
    this._updateContextValue();
  }

  private _updateSharedSavings(savings: SharedSavingsData): void {
    this._budgetData = {
      ...this._budgetData,
      sharedSavings: savings
    };
    localStorageAdapter.saveSharedSavings(this._budgetData.sharedSavings);
    this._updateContextValue();
  }

  private _isSettlementApplied(): boolean {
    return this._budgetData.people.some((person) => {
      const incState = this._budgetData.incomeByPerson[person.id];
      const activeInc = incState?.scenarios.find((s) => s.id === incState.activeScenarioId);
      const expState = this._budgetData.personalExpensesByPerson[person.id];
      const activeExp = expState?.scenarios.find((s) => s.id === expState.activeScenarioId);
      return (
        activeInc?.entries.some((e) => e.isSettlement) ||
        activeExp?.entries.some((e) => e.isSettlement)
      );
    });
  }

  private _applySettlements(): void {
    const { rows } = calculateProportionalContributions(
      this._budgetData.people,
      this._budgetData.incomeByPerson,
      this._budgetData.sharedExpenses
    );

    const updated = applySettlementAdjustments(
      this._budgetData.incomeByPerson,
      this._budgetData.personalExpensesByPerson,
      rows
    );

    this._budgetData = {
      ...this._budgetData,
      incomeByPerson: updated.incomeByPerson,
      personalExpensesByPerson: updated.personalExpensesByPerson
    };

    localStorageAdapter.saveIncome(this._budgetData.incomeByPerson);
    localStorageAdapter.savePersonalExpenses(this._budgetData.personalExpensesByPerson);
    this._updateContextValue();
  }

  private _removeSettlements(): void {
    const updated = removeSettlementAdjustments(
      this._budgetData.incomeByPerson,
      this._budgetData.personalExpensesByPerson
    );

    this._budgetData = {
      ...this._budgetData,
      incomeByPerson: updated.incomeByPerson,
      personalExpensesByPerson: updated.personalExpensesByPerson
    };

    localStorageAdapter.saveIncome(this._budgetData.incomeByPerson);
    localStorageAdapter.savePersonalExpenses(this._budgetData.personalExpensesByPerson);
    this._updateContextValue();
  }

  override render() {
    return this._loadDataTask.render({
      pending: () => html`<div class="loading-container">Loading budget planner...</div>`,
      error: (e) => html`<div class="error-container">Failed to load budget data: ${String(e)}</div>`,
      complete: () => this._renderApp()
    });
  }

  private _renderApp() {
    const totals = calculateHouseholdTotals({
      people: this._budgetData.people,
      incomeByPerson: this._budgetData.incomeByPerson,
      personalExpensesByPerson: this._budgetData.personalExpensesByPerson,
      sharedExpenses: this._budgetData.sharedExpenses,
      assetsByPerson: this._budgetData.assetsByPerson
    });

    const people = this._budgetData.people;
    const canAdd = coreCanAddPerson(people);

    return html`
      <header class="app-header">
        <div class="brand">
          <span class="logo">${icon('wallet', 24)}</span>
          <div>
            <h1>Budget Planner</h1>
            <p class="tagline">Plan income, expenses and savings together</p>
          </div>
        </div>
      </header>

      <div class="layout">
        <nav aria-label="Sections">
          <ul>
            ${SECTIONS.map(
              (s) => html`
                <li>
                  <a
                    href="#${s.id}"
                    style="--nav-accent: ${s.accent}"
                    aria-current=${this._activeSection === s.id ? 'true' : 'false'}
                    @click=${(e: Event) => this._goToSection(e, s.id)}
                  >
                    ${icon(s.icon, 18)}${s.label}
                  </a>
                </li>
              `
            )}
          </ul>
        </nav>

        <main>
          ${this._section('household-section', html`
            <div id="household-people">
              ${people.map(
                (person) => html`
                  <div class="person-row" data-person-id=${person.id}>
                    <person-editor .personId=${person.id}></person-editor>
                    ${people.length > 1
                      ? html`
                          <button
                            type="button"
                            class="remove-person"
                            title="Remove person"
                            aria-label="Remove ${person.name}"
                            @click=${() => this._removePerson(person.id)}
                          >
                            ${icon('trash', 18)}
                          </button>
                        `
                      : ''}
                  </div>
                `
              )}
            </div>
            <button
              type="button"
              id="add-person"
              ?hidden=${!canAdd}
              @click=${() => this._addPerson()}
            >
              ${icon('plus', 16)}Add person
            </button>
          `)}

          ${this._section('income-section', html`
            <div id="income-people" class="budget-columns">
              ${people.map(
                (person) => html`
                  <budget-income .personId=${person.id}></budget-income>
                `
              )}
            </div>
            <p id="household-total">
              <span>Household income</span>
              <strong id="household-total-amount">${formatAmount(totals.income)} €</strong>
            </p>
          `)}

          ${this._section('personal-expense-section', html`
            <div id="personal-expense-people" class="budget-columns">
              ${people.map(
                (person) => html`
                  <budget-personal-expense .personId=${person.id}></budget-personal-expense>
                `
              )}
            </div>
            <p id="household-expense-total">
              <span>Household personal expenses</span>
              <strong id="household-expense-total-amount">${formatAmount(totals.personalExpenses)} €</strong>
            </p>
          `)}

          ${this._section('shared-expense-section', html`
            <budget-shared-expense></budget-shared-expense>
          `)}

          ${this._section('remaining-balance-section', html`
            <budget-remaining-balance></budget-remaining-balance>
          `)}

          ${this._section('savings-section', html`<budget-savings></budget-savings>`)}

          ${this._section('proportional-contributions-section', html`
            <budget-proportional-contributions></budget-proportional-contributions>
          `)}

          ${this._section('unallocated-assets-section', html`
            <div id="unallocated-assets-people" class="budget-columns">
              ${people.map(
                (person) => html`
                  <budget-unallocated-assets .personId=${person.id}></budget-unallocated-assets>
                `
              )}
            </div>
            <p id="household-assets-total">
              <span>Household unallocated assets</span>
              <strong id="household-assets-total-amount">${formatAmount(totals.assets)} €</strong>
            </p>
          `)}
        </main>
      </div>
    `;
  }

  private _section(id: string, body: unknown) {
    const meta = SECTIONS.find((s) => s.id === id)!;
    return html`
      <section id=${id} class="budget-section" style="--section-accent: ${meta.accent}">
        <div class="section-head">
          <span class="section-icon">${icon(meta.icon, 20)}</span>
          <h2>${meta.label}</h2>
        </div>
        ${body}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'budget-planner-app': BudgetPlannerApp;
  }
}
