import { describe, expect, it } from 'vitest';
import {
  buildBudgetReport,
  buildReportDocument,
  calculateBudgetSummary,
  renderReportCsv,
  renderReportPdf,
  type BudgetData,
  type ContributionMethod,
  type Entry,
  type ReportFormatter,
  type ScenarioState,
  type SharedExpenseEntry
} from '../index.js';

function state<TEntry extends Entry>(entries: TEntry[], name = 'Current'): ScenarioState<TEntry> {
  return {
    activeScenarioId: 'active',
    scenarios: [
      { id: 'active', name, entries },
      { id: 'other', name: 'Other', entries: [{ name: 'Ignored', amount: 99999 } as TEntry] }
    ]
  };
}

function makeData(method: ContributionMethod = 'proportional'): BudgetData {
  return {
    people: [
      { id: 'p1', name: 'Alex' },
      { id: 'p2', name: 'Sam' }
    ],
    incomeByPerson: {
      p1: state([{ name: 'Salary', amount: 3000 }]),
      p2: state([{ name: 'Salary', amount: 1500 }])
    },
    personalExpensesByPerson: {
      p1: state([{ name: 'Phone', amount: 200 }]),
      p2: state([{ name: 'Gym', amount: 100 }])
    },
    sharedExpenses: state<SharedExpenseEntry>([
      { name: 'Rent', amount: 900, personId: 'p1' },
      { name: 'Shared expense settlement', amount: 50, personId: 'p2', isSettlement: true }
    ]),
    assetsByPerson: { p1: [{ name: 'Cash', amount: 1000 }], p2: [] },
    personalSavingsByPerson: {
      p1: { sharedContributionPercent: 50, items: [{ id: 'a', name: 'Trip', percent: 50 }] },
      p2: { sharedContributionPercent: 0, items: [{ id: 'b', name: 'Fund', percent: 100 }] }
    },
    sharedSavings: { items: [{ id: 'c', name: 'House', percent: 25 }] },
    contributionSettings: { method, customPercentByPerson: { p1: 70, p2: 30 } }
  };
}

const formatter: ReportFormatter = {
  t: (key, params) => (params ? `${key}:${Object.values(params).join('|')}` : key),
  money: (amount) => `${amount.toFixed(2)} €`,
  percent: (value) => `${value.toFixed(1)} %`,
  scenarioName: (name) => name,
  generatedAt: '2026-01-01'
};

describe('buildBudgetReport', () => {
  it('uses active scenarios only and excludes settlement entries', () => {
    const report = buildBudgetReport(makeData());
    expect(report.totalIncome).toBe(4500);
    expect(report.sharedEntries.map((entry) => entry.name)).toEqual(['Rent']);
    expect(report.sharedExpenses).toBe(900);
    expect(report.people[0].incomeScenario).toBe('Current');
    expect(report.totalIncomeWithAssets).toBe(5500);
  });

  it('matches the household summary totals', () => {
    const data = makeData();
    const report = buildBudgetReport(data);
    const summary = calculateBudgetSummary(data);
    expect(report.netRemaining).toBeCloseTo(summary.remainingAfterSavings);
    expect(report.people.reduce((total, person) => total + person.netRemaining, 0)).toBeCloseTo(
      summary.remainingAfterSavings
    );
    expect(report.totalSavingsAllocated).toBeCloseTo(summary.totalSavingsAllocated);
  });

  it('computes per person savings and net remaining', () => {
    const [alex] = buildBudgetReport(makeData()).people;
    // remaining 3000 - 200 - 900 = 1900; half to shared savings, of which 25% is allocated
    expect(alex.remainingBeforeSavings).toBe(1900);
    expect(alex.sharedContribution).toBe(950);
    expect(alex.personalSavings.allocated).toBe(475);
    expect(alex.sharedSavingsAllocated).toBe(237.5);
    expect(alex.netRemaining).toBe(1900 - 475 - 237.5);
  });

  it('has no per person contributions when fully pooled', () => {
    expect(buildBudgetReport(makeData('fully-pooled')).contributions).toEqual([]);
  });

  it.each<ContributionMethod>(['equal', 'proportional', 'equal-leftover', 'custom'])(
    'builds contribution rows for %s',
    (method) => {
      const report = buildBudgetReport(makeData(method));
      expect(report.contributions).toHaveLength(2);
      expect(report.contributions[0].contribution.balance).toBeCloseTo(
        report.contributions[0].contribution.share - report.contributions[0].contribution.paid
      );
    }
  );

  it('handles an empty household', () => {
    const data = makeData();
    const empty: BudgetData = { ...data, people: [], incomeByPerson: {}, personalExpensesByPerson: {}, sharedExpenses: state<SharedExpenseEntry>([]) };
    const report = buildBudgetReport(empty);
    expect(report.people).toEqual([]);
    expect(report.netRemaining).toBe(0);
  });
});

describe('report document', () => {
  it('lays out the sections as equations', () => {
    const lines = buildReportDocument(buildBudgetReport(makeData()), formatter);
    const headings = lines.filter((line) => line.kind === 'heading').map((line) => (line as { text: string }).text);
    expect(headings).toEqual([
      'report.section.overview',
      'report.section.income',
      'report.section.expenses',
      'report.section.savings',
      'report.section.net',
      'report.section.contribution'
    ]);
    const equations = lines.filter((line) => line.kind === 'equation');
    const household = equations.find(
      (line) => line.kind === 'equation' && line.result.label === 'report.netRemaining' && line.terms.length === 3
    );
    expect(household?.kind === 'equation' && household.result.amount).toBeCloseTo(
      buildBudgetReport(makeData()).netRemaining
    );
  });

  it('falls back to a generic name for unnamed people', () => {
    const data = makeData();
    data.people[0].name = '  ';
    const lines = buildReportDocument(buildBudgetReport(data), formatter);
    expect(lines.some((line) => line.kind === 'subheading' && line.text.startsWith('report.personScenario:person.fallback'))).toBe(true);
  });
});

describe('renderReportCsv', () => {
  const lines = buildReportDocument(buildBudgetReport(makeData()), formatter);

  it('starts with a byte order mark and uses CRLF line breaks', () => {
    const csv = renderReportCsv(lines, { delimiter: ',', decimalSeparator: '.' });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('\r\n');
    expect(csv).toContain('  Salary,,3000.00');
  });

  it('uses the locale delimiter and decimal separator', () => {
    const csv = renderReportCsv(lines, { delimiter: ';', decimalSeparator: ',' });
    expect(csv).toContain('  Salary;;3000,00');
  });

  it('quotes special characters and neutralizes formulas', () => {
    const csv = renderReportCsv(
      [
        { kind: 'row', label: 'He said "hi", ok', value: '', level: 0 },
        { kind: 'row', label: '=SUM(A1)', value: '', level: 0 },
        { kind: 'row', label: 'Debt', value: '-5', amount: -5, level: 0 }
      ],
      { delimiter: ',', decimalSeparator: '.' }
    );
    expect(csv).toContain('"He said ""hi"", ok"');
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain('Debt,,-5.00');
  });
});

describe('renderReportPdf', () => {
  const asText = (bytes: Uint8Array) => Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

  it('writes a structurally valid PDF with correct xref offsets', () => {
    const text = asText(renderReportPdf(buildReportDocument(buildBudgetReport(makeData()), formatter)));
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    const xrefStart = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(xrefStart, xrefStart + 4)).toBe('xref');
    const entries = [...text.slice(xrefStart).matchAll(/(\d{10}) 00000 n /g)].map((match) => Number(match[1]));
    entries.forEach((offset, index) => {
      expect(text.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`);
    });
  });

  it('declares stream lengths that match the stream content', () => {
    const text = asText(renderReportPdf(buildReportDocument(buildBudgetReport(makeData()), formatter)));
    for (const match of text.matchAll(/\/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) {
      expect(match[2].length).toBe(Number(match[1]));
    }
  });

  it('adds pages for long reports and escapes text', () => {
    const lines = Array.from({ length: 120 }, (_, i) => ({
      kind: 'row' as const,
      label: `Item (${i}) \\ é €`,
      value: '1.00',
      level: 0 as const
    }));
    const text = asText(renderReportPdf(lines));
    expect(Number(/\/Count (\d+)/.exec(text)?.[1])).toBeGreaterThan(1);
    expect(text).toContain('Item \\(0\\) \\\\ \xe9 \x80');
  });

  it('replaces characters outside WinAnsi', () => {
    const text = asText(renderReportPdf([{ kind: 'title', text: 'Budget \u4e2d' }]));
    expect(text).toContain('(Budget ?)');
  });
});
