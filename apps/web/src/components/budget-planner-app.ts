import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { provide } from '@lit/context';
import { Task } from '@lit/task';
import type {
  BudgetData,
  ContributionMethod,
  Entry,
  PersonSavingsData,
  ScenarioState,
  SharedExpenseEntry,
  SharedSavingsData
} from '@budget-planner/core';
import {
  addPersonToBudget,
  applySettlementsToBudget,
  calculateHouseholdTotals,
  canAddPerson as coreCanAddPerson,
  generateSampleBudget,
  isSettlementApplied,
  removePersonFromBudget,
  removeSettlementsFromBudget,
  renamePersonInBudget,
  setContributionMethod,
  setCustomContributionPercent,
  updateAssets,
  updateIncome,
  updatePersonalExpenses,
  updatePersonalSavings,
  updateSharedExpenses
} from '@budget-planner/core';
import { budgetContext, type BudgetContextValue } from '../context/budget-context.ts';
import { localStorageAdapter } from '../adapters/local-storage-adapter.ts';
import {
  applyThemePreference,
  COLOR_SCHEMES,
  loadThemePreference,
  saveThemePreference,
  type ThemePreference
} from '../adapters/theme-preference.ts';
import { icon, type IconName } from '../ui/icons.ts';
import { LocalizeController, money, t } from '../i18n/index.ts';
import type { MessageKey } from '@budget-planner/preferences';

// Import child components
import './locale-settings.ts';
import './person-editor.ts';
import './budget-income.ts';
import './budget-personal-expense.ts';
import './budget-shared-expense.ts';
import './budget-remaining-balance.ts';
import './budget-savings.ts';
import './budget-contributions.ts';
import './budget-unallocated-assets.ts';
import './budget-summary.ts';

/** Page sections in display order; drives both the navigation and section headers. */
const SECTIONS: { id: string; labelKey: MessageKey; icon: IconName; accent: string }[] = [
  { id: 'summary-section', labelKey: 'section.summary', icon: 'wallet', accent: '#4f46e5' },
  { id: 'household-section', labelKey: 'section.household', icon: 'house', accent: '#475569' },
  { id: 'income-section', labelKey: 'section.income', icon: 'trendingUp', accent: '#059669' },
  { id: 'personal-expense-section', labelKey: 'section.personalExpenses', icon: 'creditCard', accent: '#e11d48' },
  { id: 'shared-expense-section', labelKey: 'section.sharedExpenses', icon: 'receipt', accent: '#d97706' },
  { id: 'remaining-balance-section', labelKey: 'section.remainingBalance', icon: 'wallet', accent: '#0284c7' },
  { id: 'savings-section', labelKey: 'section.savings', icon: 'piggyBank', accent: '#7c3aed' },
  { id: 'proportional-contributions-section', labelKey: 'section.contributions', icon: 'arrowsLeftRight', accent: '#4f46e5' },
  { id: 'unallocated-assets-section', labelKey: 'section.unallocatedAssets', icon: 'landmark', accent: '#0d9488' }
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
    .app-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .dev-fill {
      font: inherit;
      font-size: 0.85rem;
      padding: 8px 12px;
      cursor: pointer;
      color: var(--text-2);
      background: var(--surface);
      border: 1px dashed var(--muted);
      border-radius: var(--radius-sm);
    }
    .header-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 16px;
    }
    .appearance-controls {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .theme-label {
      font-size: 0.85rem;
      color: var(--muted);
    }
    .appearance-controls select {
      min-width: 104px;
      height: 36px;
      padding: 0 8px;
      font: inherit;
      font-size: 0.85rem;
      color: var(--text);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .appearance-controls select:focus-visible,
    .mode-toggle:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .mode-toggle {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      width: 64px;
      height: 36px;
      padding: 0 9px;
      cursor: pointer;
      color: var(--muted);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 999px;
    }
    .mode-toggle::before {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 28px;
      height: 28px;
      background: var(--primary);
      border-radius: 50%;
      transition: transform 0.15s;
    }
    .mode-toggle[aria-checked='true']::before {
      transform: translateX(28px);
    }
    .mode-toggle .icon {
      position: relative;
      z-index: 1;
    }
    .mode-toggle[aria-checked='false'] .icon:first-child,
    .mode-toggle[aria-checked='true'] .icon:last-child {
      color: var(--surface);
    }
    @media (prefers-reduced-motion: reduce) {
      .mode-toggle::before {
        transition: none;
      }
    }
    .page-footer {
      max-width: 1180px;
      margin: 0 auto;
      padding: 0 24px 32px;
      text-align: right;
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
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
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
        cursor: grab;
        user-select: none;
      }
      nav ul.dragging {
        cursor: grabbing;
      }
      .budget-section {
        padding: 20px 16px;
      }
    }

    @media (max-width: 600px) {
      .app-header {
        align-items: flex-start;
        flex-direction: column;
      }
      .header-actions {
        width: 100%;
        justify-content: flex-end;
      }
    }
  `;

  @state()
  private _themePreference: ThemePreference = loadThemePreference();

  protected readonly _localize = new LocalizeController(this);

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
    sharedSavings: { items: [] },
    contributionSettings: { method: 'proportional', customPercentByPerson: { 'person-1': 100 } }
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

  private _navDragStartX = 0;
  private _navDragStartScroll = 0;
  private _navPointerDown = false;
  private _navDragged = false;

  private _onNavPointerDown = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const ul = e.currentTarget as HTMLElement;
    this._navPointerDown = true;
    this._navDragged = false;
    this._navDragStartX = e.clientX;
    this._navDragStartScroll = ul.scrollLeft;
  };

  private _onNavPointerMove = (e: PointerEvent): void => {
    if (!this._navPointerDown) return;
    const ul = e.currentTarget as HTMLElement;
    const dx = e.clientX - this._navDragStartX;
    if (!this._navDragged && Math.abs(dx) > 5) {
      this._navDragged = true;
      ul.classList.add('dragging');
      ul.setPointerCapture(e.pointerId);
    }
    if (this._navDragged) {
      ul.scrollLeft = this._navDragStartScroll - dx;
    }
  };

  private _onNavPointerEnd = (e: PointerEvent): void => {
    this._navPointerDown = false;
    (e.currentTarget as HTMLElement).classList.remove('dragging');
    // Keep the flag until after the click event that follows a drag.
    setTimeout(() => (this._navDragged = false));
  };

  private _onNavWheel = (e: WheelEvent): void => {
    const ul = e.currentTarget as HTMLElement;
    if (ul.scrollWidth <= ul.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    ul.scrollLeft += e.deltaY;
  };

  override updated(changed: Map<PropertyKey, unknown>): void {
    if (!changed.has('_activeSection')) return;
    const ul = this.renderRoot.querySelector<HTMLElement>('nav ul');
    const link = ul?.querySelector<HTMLElement>('a[aria-current="true"]');
    if (!ul || !link || ul.scrollWidth <= ul.clientWidth) return;
    const offset = link.getBoundingClientRect().left - ul.getBoundingClientRect().left + ul.scrollLeft;
    ul.scrollTo({ left: offset - (ul.clientWidth - link.offsetWidth) / 2, behavior: 'smooth' });
  }

  private _goToSection(e: Event, id: string): void {
    e.preventDefault();
    if (this._navDragged) return;
    this._activeSection = id;
    this.renderRoot.querySelector(`#${id}`)?.scrollIntoView({ block: 'start' });
  }

  private _onSummaryNavigate = (e: Event): void => {
    const id = (e as CustomEvent<string>).detail;
    this._activeSection = id;
    this.renderRoot.querySelector(`#${id}`)?.scrollIntoView({ block: 'start' });
  };

  private _setColorScheme(event: Event): void {
    if (!(event.currentTarget instanceof HTMLSelectElement)) {
      throw new Error('Color scheme control did not provide a select element');
    }
    const select = event.currentTarget;
    const colorScheme = COLOR_SCHEMES.find(({ id }) => id === select.value);
    if (!colorScheme) {
      throw new Error(`Unsupported color scheme: ${select.value}`);
    }
    this._updateThemePreference({ ...this._themePreference, colorScheme: colorScheme.id });
  }

  private _toggleColorMode(): void {
    const colorMode = this._themePreference.colorMode === 'dark' ? 'light' : 'dark';
    this._updateThemePreference({ ...this._themePreference, colorMode });
  }

  private _updateThemePreference(preference: ThemePreference): void {
    this._themePreference = preference;
    applyThemePreference(preference);
    saveThemePreference(preference);
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
      setContributionMethod: (method: ContributionMethod) => this._setContributionMethod(method),
      setCustomContributionPercent: (personId: string, percent: number) =>
        this._setCustomContributionPercent(personId, percent),
      applySettlements: () => this._applySettlements(),
      removeSettlements: () => this._removeSettlements(),
      isSettlementApplied: () => this._isSettlementApplied()
    };
  }

  private _updateContextValue(): void {
    this.budgetContextValue = this._createContextValue();
    this.requestUpdate();
  }

  /** Applies a state change from the shared core, persists it and refreshes the context. */
  private _commit(next: BudgetData | undefined, save: (data: BudgetData) => void): void {
    if (!next) {
      return;
    }
    this._budgetData = next;
    save(next);
    this._updateContextValue();
  }

  private _saveSettlementTargets = (data: BudgetData): void => {
    localStorageAdapter.saveIncome(data.incomeByPerson);
    localStorageAdapter.savePersonalExpenses(data.personalExpensesByPerson);
  };

  // TEMPORARY: replaces all data with random sample data for manual testing.
  private _fillSampleData(): void {
    this._commit(generateSampleBudget(), (data) => localStorageAdapter.saveAll(data));
  }

  private _addPerson(): void {
    const name = t('person.defaultName', { n: this._budgetData.people.length + 1 });
    this._commit(addPersonToBudget(this._budgetData, name), (data) => localStorageAdapter.saveAll(data));
  }

  private _removePerson(id: string): void {
    this._commit(removePersonFromBudget(this._budgetData, id), (data) => localStorageAdapter.saveAll(data));
  }

  private _renamePerson(id: string, name: string): void {
    this._commit(renamePersonInBudget(this._budgetData, id, name), (data) =>
      localStorageAdapter.savePeople(data.people)
    );
  }

  private _updateIncome(personId: string, state: ScenarioState): void {
    this._commit(updateIncome(this._budgetData, personId, state), (data) =>
      localStorageAdapter.saveIncome(data.incomeByPerson)
    );
  }

  private _updatePersonalExpense(personId: string, state: ScenarioState): void {
    this._commit(updatePersonalExpenses(this._budgetData, personId, state), (data) =>
      localStorageAdapter.savePersonalExpenses(data.personalExpensesByPerson)
    );
  }

  private _updateSharedExpenses(state: ScenarioState<SharedExpenseEntry>): void {
    this._commit(updateSharedExpenses(this._budgetData, state), (data) =>
      localStorageAdapter.saveSharedExpenses(data.sharedExpenses)
    );
  }

  private _updateAssets(personId: string, entries: Entry[]): void {
    this._commit(updateAssets(this._budgetData, personId, entries), (data) =>
      localStorageAdapter.saveAssets(data.assetsByPerson)
    );
  }

  private _updatePersonalSavings(personId: string, savings: PersonSavingsData): void {
    this._commit(updatePersonalSavings(this._budgetData, personId, savings), (data) =>
      localStorageAdapter.savePersonalSavings(data.personalSavingsByPerson)
    );
  }

  private _updateSharedSavings(savings: SharedSavingsData): void {
    this._commit({ ...this._budgetData, sharedSavings: savings }, (data) =>
      localStorageAdapter.saveSharedSavings(data.sharedSavings)
    );
  }

  private _saveContributionChange = (data: BudgetData): void => {
    this._saveSettlementTargets(data);
    localStorageAdapter.saveContributionSettings(data.contributionSettings);
  };

  private _setContributionMethod(method: ContributionMethod): void {
    this._commit(setContributionMethod(this._budgetData, method), this._saveContributionChange);
  }

  private _setCustomContributionPercent(personId: string, percent: number): void {
    this._commit(
      setCustomContributionPercent(this._budgetData, personId, percent),
      this._saveContributionChange
    );
  }

  private _isSettlementApplied(): boolean {
    return isSettlementApplied(this._budgetData);
  }

  private _applySettlements(): void {
    this._commit(applySettlementsToBudget(this._budgetData), this._saveSettlementTargets);
  }

  private _removeSettlements(): void {
    this._commit(removeSettlementsFromBudget(this._budgetData), this._saveSettlementTargets);
  }

  override render() {
    return this._loadDataTask.render({
      pending: () => html`<div class="loading-container">${t('app.loading')}</div>`,
      error: (e) => html`<div class="error-container">${t('app.loadError', { error: String(e) })}</div>`,
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
            <h1>${t('app.title')}</h1>
            <p class="tagline">${t('app.tagline')}</p>
          </div>
        </div>
        <div class="header-actions">
          <locale-settings></locale-settings>
          <div class="appearance-controls" role="group" aria-label=${t('settings.appearance')}>
            <label for="color-scheme" class="theme-label">${t('settings.theme')}</label>
            <select id="color-scheme" @change=${this._setColorScheme}>
              ${COLOR_SCHEMES.map(
                ({ id }) =>
                  html`<option value=${id} ?selected=${this._themePreference.colorScheme === id}>${t(`theme.${id}`)}</option>`
              )}
            </select>
            <button
              type="button"
              id="color-mode"
              class="mode-toggle"
              role="switch"
              aria-label=${t('settings.darkMode')}
              aria-checked=${this._themePreference.colorMode === 'dark' ? 'true' : 'false'}
              @click=${() => this._toggleColorMode()}
            >
              ${icon('sun', 16)}${icon('moon', 16)}
            </button>
          </div>
        </div>
      </header>

      <div class="layout">
        <nav aria-label=${t('nav.sections')}>
          <ul
            @pointerdown=${this._onNavPointerDown}
            @pointermove=${this._onNavPointerMove}
            @pointerup=${this._onNavPointerEnd}
            @pointercancel=${this._onNavPointerEnd}
            @wheel=${this._onNavWheel}
          >
            ${SECTIONS.map(
              (s) => html`
                <li>
                  <a
                    href="#${s.id}"
                    draggable="false"
                    style="--nav-accent: ${s.accent}"
                    aria-current=${this._activeSection === s.id ? 'true' : 'false'}
                    @click=${(e: Event) => this._goToSection(e, s.id)}
                  >
                    ${icon(s.icon, 18)}${t(s.labelKey)}
                  </a>
                </li>
              `
            )}
          </ul>
        </nav>

        <main>
          ${this._section('summary-section', html`<budget-summary @navigate-section=${this._onSummaryNavigate}></budget-summary>`)}

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
                            title=${t('person.removeTitle')}
                            aria-label=${t('person.removeLabel', { name: person.name })}
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
              ${icon('plus', 16)}${t('person.add')}
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
              <span>${t('income.household')}</span>
              <strong id="household-total-amount">${money(totals.baseIncome)}</strong>
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
              <span>${t('expense.household')}</span>
              <strong id="household-expense-total-amount">${money(totals.personalExpenses)}</strong>
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
            <budget-contributions></budget-contributions>
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
              <span>${t('assets.household')}</span>
              <strong id="household-assets-total-amount">${money(totals.assets)}</strong>
            </p>
          `)}
        </main>
      </div>

      <footer class="page-footer">
        <button type="button" id="dev-fill-data" class="dev-fill" @click=${() => this._fillSampleData()}>
          ${t('app.fillTestData')}
        </button>
      </footer>
    `;
  }

  private _section(id: string, body: unknown) {
    const meta = SECTIONS.find((s) => s.id === id)!;
    return html`
      <section id=${id} class="budget-section" style="--section-accent: ${meta.accent}">
        <div class="section-head">
          <span class="section-icon">${icon(meta.icon, 20)}</span>
          <h2>${t(meta.labelKey)}</h2>
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
