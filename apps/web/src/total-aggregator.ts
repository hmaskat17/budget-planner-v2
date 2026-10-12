import { formatAmount } from '@budget-planner/core';

export interface TotalAggregatorConfig {
  tagName: string;
  eventName: string;
  totalElementId: string;
}

interface ComponentWithTotal extends Element {
  baseTotal?: () => number;
  total?: () => number;
}

/**
 * Wires up a total display that sums `.total()` across every mounted element matching `tagName`,
 * refreshed whenever `eventName` fires.
 */
export function createTotalAggregator({ tagName, eventName, totalElementId }: TotalAggregatorConfig): void {
  function update(): void {
    const el = document.getElementById(totalElementId);
    if (!el) {
      return;
    }
    // Household totals exclude settlements, which only move money between persons.
    const total = Array.from(document.querySelectorAll<ComponentWithTotal>(tagName)).reduce((sum, component) => {
      if (typeof component.baseTotal === 'function') {
        return sum + component.baseTotal();
      }
      return sum + (typeof component.total === 'function' ? component.total() : 0);
    }, 0);
    el.textContent = formatAmount(total);
  }

  document.addEventListener(eventName, update);
  update();
}
