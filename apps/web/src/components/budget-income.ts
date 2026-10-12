import { ScenarioBudgetElement } from './scenario-budget.ts';

/** Self-contained income budget component; owns its own scenario data, keyed by person-id. */
export class BudgetIncome extends ScenarioBudgetElement {
  static override get storageKey(): string {
    return 'budget-planner-income';
  }

  static override get changeEventName(): string {
    return 'income-changed';
  }

  static override get entryPlaceholder(): string {
    return 'Income source';
  }

  static override get addEntryLabel(): string {
    return 'Add new income';
  }
}

customElements.define('budget-income', BudgetIncome);
