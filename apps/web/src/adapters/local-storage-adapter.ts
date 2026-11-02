import { createBudgetStorage } from '@budget-planner/core';
import { t } from '../i18n/index.ts';

export const localStorageAdapter = createBudgetStorage(localStorage, () => t('person.defaultName', { n: 1 }));
