import { ScenarioBudgetElement } from './scenario-budget.ts';

/** Self-contained personal expense budget component; owns its own scenario data, keyed by person-id. */
export class BudgetPersonalExpense extends ScenarioBudgetElement {
  static override get storageKey(): string {
    return 'budget-planner-personal-expense';
  }

  static override get changeEventName(): string {
    return 'personal-expense-changed';
  }

  static override get entryPlaceholder(): string {
    return 'Expense source';
  }

  static override get addEntryLabel(): string {
    return 'Add new expense';
  }
}

customElements.define('budget-personal-expense', BudgetPersonalExpense);
