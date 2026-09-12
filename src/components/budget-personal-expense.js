import { ScenarioBudgetElement } from './scenario-budget.js';

/** Self-contained personal expense budget component; owns its own scenario data, keyed by person-id. */
export class BudgetPersonalExpense extends ScenarioBudgetElement {
    static get storageKey() {
        return 'budget-planner-personal-expense';
    }

    static get changeEventName() {
        return 'personal-expense-changed';
    }

    static get entryPlaceholder() {
        return 'Expense source';
    }

    static get addEntryLabel() {
        return 'Add new expense';
    }
}

customElements.define('budget-personal-expense', BudgetPersonalExpense);
