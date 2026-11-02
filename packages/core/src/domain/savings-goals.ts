import type { PersonSavingsData, SavingsItem } from './models.js';
import { createId } from './utils.js';


/** Parses user-entered numeric text; empty or invalid input becomes 0. */
export function parseAmount(text: string): number {
  return Number(text) || 0;
}

export function addGoal<T extends { items: SavingsItem[] }>(
  data: T
): Omit<T, 'items'> & { items: SavingsItem[] } {
  return { ...data, items: [...data.items, { id: createId('savings'), name: '', percent: 0 }] };
}

export function removeGoal<T extends { items: SavingsItem[] }>(
  data: T,
  index: number
): Omit<T, 'items'> & { items: SavingsItem[] } {
  return { ...data, items: data.items.filter((_, idx) => idx !== index) };
}

export function updateGoalName<T extends { items: SavingsItem[] }>(
  data: T,
  index: number,
  name: string
): Omit<T, 'items'> & { items: SavingsItem[] } {
  return { ...data, items: data.items.map((item, idx) => (idx === index ? { ...item, name } : item)) };
}

export function updateGoalPercent<T extends { items: SavingsItem[] }>(
  data: T,
  index: number,
  percentText: string
): Omit<T, 'items'> & { items: SavingsItem[] } {
  const percent = parseAmount(percentText);
  return { ...data, items: data.items.map((item, idx) => (idx === index ? { ...item, percent } : item)) };
}

export function setSharedContributionPercent(data: PersonSavingsData, percentText: string): PersonSavingsData {
  return { ...data, sharedContributionPercent: parseAmount(percentText) };
}
