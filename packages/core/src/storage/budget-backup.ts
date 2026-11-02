import type { BudgetData, ValidationIssue } from '../domain/models.js';
import { normalizeBudgetData } from '../domain/budget-state.js';
import { validateBudgetData } from '../domain/validation.js';

export const BACKUP_FORMAT = 'budget-planner-backup';
export const BACKUP_VERSION = 1;

export interface BudgetBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: BudgetData;
}

export type ParseBackupResult =
  | { ok: true; data: BudgetData }
  | { ok: false; issues: ValidationIssue[] };

/** Upgrades the `data` payload of an older backup version to the next one. Keyed by the source version. */
const MIGRATIONS: Record<number, (data: unknown) => unknown> = {};

export function createBackup(data: BudgetData, now: Date = new Date()): BudgetBackup {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

export function serializeBackup(backup: BudgetBackup): string {
  return JSON.stringify(backup, null, 2);
}

export function backupFileName(now: Date = new Date()): string {
  return `budget-planner-backup-${now.toISOString().slice(0, 10)}.json`;
}

function fail(path: string, code: string, message: string): ParseBackupResult {
  return { ok: false, issues: [{ path, code, message }] };
}

/** Parses and validates backup file contents. Never throws; returns issues instead. */
export function parseBackup(text: string): ParseBackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail('backup', 'invalid-json', 'File is not valid JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return fail('backup', 'invalid-format', 'File is not a budget planner backup.');
  }
  const backup = parsed as Record<string, unknown>;
  if (backup.format !== BACKUP_FORMAT) {
    return fail('format', 'invalid-format', 'File is not a budget planner backup.');
  }
  const version = backup.version;
  if (!Number.isInteger(version) || (version as number) < 1) {
    return fail('version', 'invalid-version', 'Backup version is invalid.');
  }
  if ((version as number) > BACKUP_VERSION) {
    return fail('version', 'unsupported-version', 'Backup was created by a newer version of the app.');
  }

  let data = backup.data;
  for (let v = version as number; v < BACKUP_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (!migrate) {
      return fail('version', 'unsupported-version', 'Backup version cannot be upgraded.');
    }
    data = migrate(data);
  }

  const issues = validateBudgetData(data);
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, data: normalizeBudgetData(data as BudgetData) };
}
