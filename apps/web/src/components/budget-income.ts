import { customElement } from 'lit/decorators.js';
import type { ScenarioState } from '@budget-planner/core';
import { createDefaultScenario, createId } from '@budget-planner/core';
import { ScenarioBudgetElement } from './scenario-budget.ts';
import type { BudgetContextValue } from '../context/budget-context.ts';
import { t } from '../i18n/index.ts';

/** Self-contained income budget component; consumes budgetContext. */
@customElement('budget-income')
export class BudgetIncome extends ScenarioBudgetElement {
  override get entryPlaceholder(): string {
    return t('income.placeholder');
  }

  override get addEntryLabel(): string {
    return t('income.add');
  }

  override getScenarioState(budget: BudgetContextValue): ScenarioState {
    const existing = budget.data.incomeByPerson[this.personId];
    if (existing) {
      return existing;
    }
    const fallback = createDefaultScenario(createId('scenario'));
    return { activeScenarioId: fallback.id, scenarios: [fallback] };
  }

  override updateScenarioState(budget: BudgetContextValue, state: ScenarioState): void {
    budget.updateIncome(this.personId, state);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'budget-income': BudgetIncome;
  }
}
