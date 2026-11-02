import { describe, expect, it } from 'vitest';
import { backupFileName, BACKUP_VERSION, createBackup, parseBackup, serializeBackup } from './budget-backup.ts';
import { createDefaultBudgetData } from '../domain/budget-state.ts';
import { generateSampleBudget } from '../domain/sample-data.ts';

describe('budget backup', () => {
  it('round-trips budget data', () => {
    const data = generateSampleBudget();
    const result = parseBackup(serializeBackup(createBackup(data)));
    expect(result).toEqual({ ok: true, data });
  });

  it('stamps format, version and date', () => {
    const backup = createBackup(createDefaultBudgetData('A'), new Date('2026-03-04T10:00:00Z'));
    expect(backup).toMatchObject({ format: 'budget-planner-backup', version: BACKUP_VERSION });
    expect(backup.exportedAt).toBe('2026-03-04T10:00:00.000Z');
    expect(backupFileName(new Date('2026-03-04T10:00:00Z'))).toBe('budget-planner-backup-2026-03-04.json');
  });

  it.each([
    ['not json', '{oops', 'invalid-json'],
    ['array', '[]', 'invalid-format'],
    ['wrong format', '{"format":"other","version":1,"data":{}}', 'invalid-format'],
    ['bad version', '{"format":"budget-planner-backup","version":"x","data":{}}', 'invalid-version'],
    ['newer version', '{"format":"budget-planner-backup","version":99,"data":{}}', 'unsupported-version']
  ])('rejects %s', (_name, text, code) => {
    const result = parseBackup(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].code).toBe(code);
    }
  });

  it('reports validation issues for invalid data', () => {
    const backup = createBackup({ ...createDefaultBudgetData('A'), people: [] });
    const result = parseBackup(serializeBackup(backup));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'invalid-count')).toBe(true);
    }
  });

  it('normalizes missing per-person data', () => {
    const data = createDefaultBudgetData('A');
    const text = JSON.stringify({ ...createBackup(data), data: { ...data, assetsByPerson: {} } });
    const result = parseBackup(text);
    expect(result.ok && result.data.assetsByPerson['person-1']).toEqual([]);
  });
});
