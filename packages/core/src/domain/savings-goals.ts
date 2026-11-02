import type { PersonSavingsData, SavingsItem } from './models.js';
import { createId } from './utils.js';


/** Parses user-entered numeric text; empty or invalid input becomes 0. */
export function parseAmount(text: string): number {
  return Number(text) || 0;
}

export function addGoal<T extends { items: SavingsItem[] }>(data: T): T {
  return { ...data, items: [...data.items, { id: createId('savings'), name: '', percent: 0 }] };
}

export function removeGoal<T extends { items: SavingsItem[] }>(data: T, index: number): T {
  return { ...data, items: data.items.filter((_, idx) => idx !== index) };
}

export function updateGoalName<T extends { items: SavingsItem[] }>(data: T, index: number, name: string): T {
  return { ...data, items: data.items.map((item, idx) => (idx === index ? { ...item, name } : item)) };
}

export function updateGoalPercent<T extends { items: SavingsItem[] }>(
  data: T,
  index: number,
  percentText: string
): T {
  const percent = parseAmount(percentText);
  return { ...data, items: data.items.map((item, idx) => (idx === index ? { ...item, percent } : item)) };
}

export function setSharedContributionPercent(data: PersonSavingsData, percentText: string): PersonSavingsData {
  return { ...data, sharedContributionPercent: parseAmount(percentText) };
}

