import { ScenarioBudgetElement } from './scenario-budget.js';

/** Self-contained income budget component; owns its own scenario data, keyed by person-id. */
export class BudgetIncome extends ScenarioBudgetElement {
    static get storageKey() {
        return 'budget-planner-income';
    }

    static get changeEventName() {
        return 'income-changed';
    }

    static get entryPlaceholder() {
        return 'Income source';
    }

    static get addEntryLabel() {
        return 'Add new income';
    }
}

customElements.define('budget-income', BudgetIncome);

