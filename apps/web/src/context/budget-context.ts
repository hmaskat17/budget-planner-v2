import { createContext } from '@lit/context';
import type {
  BudgetData,
  Entry,
  PersonSavingsData,
  ScenarioState,
  SharedExpenseEntry,
  SharedSavingsData
} from '@budget-planner/core';

export interface BudgetContextValue {
  data: BudgetData;
  canAddPerson: () => boolean;
  addPerson: () => void;
  removePerson: (id: string) => void;
  renamePerson: (id: string, name: string) => void;
  updateIncome: (personId: string, state: ScenarioState) => void;
  updatePersonalExpense: (personId: string, state: ScenarioState) => void;
  updateSharedExpenses: (state: ScenarioState<SharedExpenseEntry>) => void;
  updateAssets: (personId: string, entries: Entry[]) => void;
  updatePersonalSavings: (personId: string, savings: PersonSavingsData) => void;
  updateSharedSavings: (savings: SharedSavingsData) => void;
  applySettlements: () => void;
  removeSettlements: () => void;
  isSettlementApplied: () => boolean;
}

export const budgetContext = createContext<BudgetContextValue>(Symbol('budget-context'));
