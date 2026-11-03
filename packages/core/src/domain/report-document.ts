import type { BudgetReport, ReportPool } from './report.js';

export interface EquationTerm {
  /** Operator placed before the term; empty for the first term. */
  op: '' | '+' | '-' | '×';
  label: string;
  value: string;
  amount?: number;
}

export type ReportLine =
  | { kind: 'title'; text: string }
  | { kind: 'subtitle'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'subheading'; text: string }
  | { kind: 'row'; label: string; detail?: string; value: string; amount?: number; level: 0 | 1; strong?: boolean }
  | { kind: 'equation'; terms: EquationTerm[]; result: EquationTerm }
  | { kind: 'note'; text: string };

/** Platform-supplied text and number formatting, so the report follows the user's language and regional settings. */
export interface ReportFormatter {
  t(key: string, params?: Record<string, string | number>): string;
  money(amount: number): string;
  /** `value` is a plain percentage such as 66.67. */
  percent(value: number): string;
  scenarioName(name: string): string;
  generatedAt: string;
}

const EPSILON = 0.005;

export function buildReportDocument(report: BudgetReport, f: ReportFormatter): ReportLine[] {
  const lines: ReportLine[] = [];
  const name = (person: { name: string }) => person.name.trim() || f.t('person.fallback');
  const nameById = (id: string | undefined) => {
    const person = report.people.find((row) => row.person.id === id)?.person;
    return person ? name(person) : '';
  };
  const term = (op: EquationTerm['op'], label: string, amount: number): EquationTerm => ({
    op,
    label,
    value: f.money(amount),
    amount
  });
  const row = (
    label: string,
    amount: number,
    options: { level?: 0 | 1; strong?: boolean; detail?: string } = {}
  ): ReportLine => ({
    kind: 'row',
    label,
    detail: options.detail,
    value: f.money(amount),
    amount,
    level: options.level ?? 0,
    strong: options.strong
  });
  const scenarioHeading = (person: string, scenario: string) =>
    f.t('report.personScenario', { person, scenario: f.scenarioName(scenario) });
  const pool = (target: ReportPool, poolLabel: string) => {
    lines.push(row(poolLabel, target.pool));
    target.items.forEach((item) =>
      lines.push(row(item.name, item.amount, { level: 1, detail: f.percent(item.percent) }))
    );
    lines.push(row(f.t('report.allocated'), target.allocated, { detail: f.percent(target.allocatedPercent) }));
    lines.push(row(f.t('report.unallocated'), target.unallocated, { detail: f.percent(target.unallocatedPercent) }));
  };

  lines.push({ kind: 'title', text: f.t('report.title') });
  lines.push({ kind: 'subtitle', text: f.t('report.generated', { date: f.generatedAt }) });

  lines.push({ kind: 'heading', text: f.t('report.section.overview') });
  lines.push({
    kind: 'equation',
    terms: [
      term('', f.t('report.income'), report.totalIncome),
      term('-', f.t('report.expenses'), report.totalExpenses),
      term('-', f.t('report.savings'), report.totalSavingsAllocated)
    ],
    result: term('', f.t('report.netRemaining'), report.netRemaining)
  });

  lines.push({ kind: 'heading', text: f.t('report.section.income') });
  report.people.forEach((person) => {
    lines.push({ kind: 'subheading', text: scenarioHeading(name(person.person), person.incomeScenario) });
    person.incomeEntries.forEach((entry) => lines.push(row(entry.name, entry.amount, { level: 1 })));
    lines.push(row(f.t('report.totalIncome'), person.income, { strong: true }));
  });
  lines.push(row(f.t('report.householdIncome'), report.totalIncome, { strong: true }));
  lines.push({ kind: 'subheading', text: f.t('report.assets') });
  report.people.forEach((person) =>
    person.assetEntries.forEach((entry) =>
      lines.push(row(entry.name, entry.amount, { level: 1, detail: name(person.person) }))
    )
  );
  lines.push(row(f.t('report.totalAssets'), report.totalAssets, { strong: true }));
  lines.push({
    kind: 'equation',
    terms: [term('', f.t('report.householdIncome'), report.totalIncome), term('+', f.t('report.totalAssets'), report.totalAssets)],
    result: term('', f.t('report.totalWithAssets'), report.totalIncomeWithAssets)
  });

  lines.push({ kind: 'heading', text: f.t('report.section.expenses') });
  report.people.forEach((person) => {
    lines.push({ kind: 'subheading', text: scenarioHeading(name(person.person), person.expenseScenario) });
    person.personalExpenseEntries.forEach((entry) => lines.push(row(entry.name, entry.amount, { level: 1 })));
    lines.push(row(f.t('report.totalPersonalExpenses'), person.personalExpenses, { strong: true }));
  });
  lines.push({
    kind: 'subheading',
    text: f.t('report.sharedExpenses', { scenario: f.scenarioName(report.sharedScenario) })
  });
  report.sharedEntries.forEach((entry) =>
    lines.push(row(entry.name, entry.amount, { level: 1, detail: nameById(entry.personId) }))
  );
  report.people.forEach((person) =>
    lines.push(row(f.t('report.paidBy', { person: name(person.person) }), person.sharedPaid))
  );
  lines.push(row(f.t('report.totalSharedExpenses'), report.sharedExpenses, { strong: true }));
  lines.push({
    kind: 'equation',
    terms: [
      term('', f.t('report.totalPersonalExpenses'), report.totalPersonalExpenses),
      term('+', f.t('report.totalSharedExpenses'), report.sharedExpenses)
    ],
    result: term('', f.t('report.totalExpenses'), report.totalExpenses)
  });

  lines.push({ kind: 'heading', text: f.t('report.section.savings') });
  report.people.forEach((person) => {
    lines.push({ kind: 'subheading', text: name(person.person) });
    lines.push(row(f.t('report.remainingBeforeSavings'), person.remainingBeforeSavings));
    lines.push(
      row(f.t('report.sharedContribution'), person.sharedContribution, {
        detail: f.percent(person.sharedContributionPercent)
      })
    );
    pool(person.personalSavings, f.t('report.personalSavingsPool'));
  });
  lines.push({ kind: 'subheading', text: f.t('report.sharedSavings') });
  pool(report.sharedSavings, f.t('report.sharedSavingsPool'));
  lines.push(row(f.t('report.totalAllocated'), report.totalSavingsAllocated, { strong: true }));
  lines.push(row(f.t('report.totalUnallocated'), report.totalSavingsUnallocated, { strong: true }));

  lines.push({ kind: 'heading', text: f.t('report.section.net') });
  report.people.forEach((person) => {
    lines.push({ kind: 'subheading', text: name(person.person) });
    lines.push({
      kind: 'equation',
      terms: [
        term('', f.t('report.income'), person.income),
        term('-', f.t('report.personalExpenses'), person.personalExpenses),
        term('-', f.t('report.sharedExpensesPaid'), person.sharedPaid),
        term('-', f.t('report.savings'), person.savingsAllocated)
      ],
      result: term('', f.t('report.netRemaining'), person.netRemaining)
    });
  });
  lines.push({ kind: 'subheading', text: f.t('report.household') });
  lines.push({
    kind: 'equation',
    terms: [
      term('', f.t('report.income'), report.totalIncome),
      term('-', f.t('report.expenses'), report.totalExpenses),
      term('-', f.t('report.savings'), report.totalSavingsAllocated)
    ],
    result: term('', f.t('report.netRemaining'), report.netRemaining)
  });

  lines.push({ kind: 'heading', text: f.t('report.section.contribution') });
  lines.push({
    kind: 'row',
    label: f.t('report.method'),
    value: f.t(`method.${report.contributionMethod}`),
    level: 0
  });
  if (report.contributionMethod === 'fully-pooled') {
    lines.push({ kind: 'note', text: f.t('report.pooledNote') });
  }
  report.contributions.forEach(({ person, contribution, personalExpenses }) => {
    lines.push({ kind: 'subheading', text: name(person) });
    const shareTerm = term('', f.t('report.share'), contribution.share);
    if (report.contributionMethod === 'equal-leftover') {
      lines.push({
        kind: 'equation',
        terms: [
          term('', f.t('report.income'), contribution.income),
          term('-', f.t('report.personalExpenses'), personalExpenses),
          term('-', f.t('report.equalLeftover'), contribution.income - personalExpenses - contribution.share)
        ],
        result: shareTerm
      });
    } else {
      lines.push({
        kind: 'equation',
        terms: [
          term('', f.t('report.totalSharedExpenses'), report.contributionSharedTotal),
          { op: '×', label: f.t('report.percentage'), value: f.percent(contribution.percent) }
        ],
        result: shareTerm
      });
    }
    lines.push({
      kind: 'equation',
      terms: [shareTerm, term('-', f.t('report.paid'), contribution.paid)],
      result: term('', f.t('report.balance'), contribution.balance)
    });
    const status =
      Math.abs(contribution.balance) < EPSILON
        ? f.t('report.settled')
        : contribution.balance > 0
          ? f.t('report.owes')
          : f.t('report.owed');
    lines.push(row(status, Math.abs(contribution.balance), { strong: true }));
  });

  return lines;
}
