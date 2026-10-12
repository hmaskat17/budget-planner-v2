import { customElement } from 'lit/decorators.js';
import type { ScenarioState } from '@budget-planner/core';
import { createDefaultScenario, createId } from '@budget-planner/core';
import { ScenarioBudgetElement } from './scenario-budget.ts';
import type { BudgetContextValue } from '../context/budget-context.ts';

/** Self-contained personal expense budget component; consumes budgetContext. */
@customElement('budget-personal-expense')
export class BudgetPersonalExpense extends ScenarioBudgetElement {
  override get entryPlaceholder(): string {
    return 'Expense source';
  }

  override get addEntryLabel(): string {
    return 'Add new expense';
  }

  override getScenarioState(budget: BudgetContextValue): ScenarioState {
    const existing = budget.data.personalExpensesByPerson[this.personId];
    if (existing) {
      return existing;
    }
    const fallback = createDefaultScenario(createId('scenario'));
    return { activeScenarioId: fallback.id, scenarios: [fallback] };
  }

  override updateScenarioState(budget: BudgetContextValue, state: ScenarioState): void {
    budget.updatePersonalExpense(this.personId, state);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'budget-personal-expense': BudgetPersonalExpense;
  }
}
