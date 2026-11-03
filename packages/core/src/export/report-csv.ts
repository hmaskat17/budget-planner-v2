import type { BudgetReport } from '../domain/report.js';
import type { ReportFormatter } from '../domain/report-document.js';

export interface CsvOptions {
  /** Use `;` for locales with a decimal comma so spreadsheets split columns correctly. */
  delimiter: ',' | ';';
  decimalSeparator: '.' | ',';
}

/** Prevents spreadsheet applications from evaluating cell content as a formula. */
function neutralize(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function quote(cell: string, delimiter: string): string {
  return /["\r\n]/.test(cell) || cell.includes(delimiter) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

interface CsvRecord {
  section: string;
  person: string;
  category: string;
  item: string;
  percent?: number;
  amount?: number;
}

/**
 * Flat, one-record-per-item table that works with filters, pivot tables and imports.
 * Contains no totals, layout rows or formatted numbers: sum the Amount column per section instead.
 */
function buildRecords(report: BudgetReport, f: ReportFormatter): CsvRecord[] {
  const records: CsvRecord[] = [];
  const name = (person: { name: string }) => person.name.trim() || f.t('person.fallback');
  const personName = (id: string | undefined) => {
    const match = report.people.find((row) => row.person.id === id);
    return match ? name(match.person) : '';
  };

  const income = f.t('report.section.income');
  const expenses = f.t('report.section.expenses');
  const savings = f.t('report.section.savings');
  const net = f.t('report.section.net');
  const contribution = f.t('report.section.contribution');

  report.people.forEach((row) => {
    const person = name(row.person);
    row.incomeEntries.forEach((entry) =>
      records.push({ section: income, person, category: f.t('report.csv.income'), item: entry.name, amount: entry.amount })
    );
    row.assetEntries.forEach((entry) =>
      records.push({ section: income, person, category: f.t('report.csv.asset'), item: entry.name, amount: entry.amount })
    );
  });

  report.people.forEach((row) =>
    row.personalExpenseEntries.forEach((entry) =>
      records.push({
        section: expenses,
        person: name(row.person),
        category: f.t('report.csv.personalExpense'),
        item: entry.name,
        amount: entry.amount
      })
    )
  );
  report.sharedEntries.forEach((entry) =>
    records.push({
      section: expenses,
      person: personName(entry.personId),
      category: f.t('report.csv.sharedExpense'),
      item: entry.name,
      amount: entry.amount
    })
  );

  report.people.forEach((row) => {
    const person = name(row.person);
    records.push({
      section: savings,
      person,
      category: f.t('report.csv.sharedContribution'),
      item: '',
      percent: row.sharedContributionPercent,
      amount: row.sharedContribution
    });
    const personal = f.t('report.csv.personalSavings');
    row.personalSavings.items.forEach((item) =>
      records.push({ section: savings, person, category: personal, item: item.name, percent: item.percent, amount: item.amount })
    );
    records.push({
      section: savings,
      person,
      category: personal,
      item: f.t('report.unallocated'),
      percent: row.personalSavings.unallocatedPercent,
      amount: row.personalSavings.unallocated
    });
  });
  const shared = f.t('report.csv.sharedSavings');
  report.sharedSavings.items.forEach((item) =>
    records.push({ section: savings, person: '', category: shared, item: item.name, percent: item.percent, amount: item.amount })
  );
  records.push({
    section: savings,
    person: '',
    category: shared,
    item: f.t('report.unallocated'),
    percent: report.sharedSavings.unallocatedPercent,
    amount: report.sharedSavings.unallocated
  });

  report.people.forEach((row) =>
    records.push({ section: net, person: name(row.person), category: f.t('report.netRemaining'), item: '', amount: row.netRemaining })
  );

  records.push({ section: contribution, person: '', category: f.t('report.method'), item: f.t(`method.${report.contributionMethod}`) });
  report.contributions.forEach(({ person, contribution: row }) => {
    const label = name(person);
    records.push({ section: contribution, person: label, category: f.t('report.share'), item: '', percent: row.percent, amount: row.share });
    records.push({ section: contribution, person: label, category: f.t('report.paid'), item: '', amount: row.paid });
    records.push({ section: contribution, person: label, category: f.t('report.balance'), item: '', amount: row.balance });
  });

  return records;
}

/** Renders the report as a flat CSV table with a UTF-8 byte order mark so spreadsheets detect the encoding. */
export function renderReportCsv(report: BudgetReport, f: ReportFormatter, options: CsvOptions): string {
  const number = (value: number | undefined) =>
    value === undefined ? '' : value.toFixed(2).replace('.', options.decimalSeparator);
  const header = ['section', 'person', 'category', 'item', 'percent', 'amount'].map((key) => f.t(`report.csv.${key}`));
  const rows = [
    header.map((cell) => quote(neutralize(cell), options.delimiter)),
    ...buildRecords(report, f).map((record) => [
      ...[record.section, record.person, record.category, record.item].map((cell) =>
        quote(neutralize(cell), options.delimiter)
      ),
      number(record.percent),
      number(record.amount)
    ])
  ];
  return `\uFEFF${rows.map((cells) => cells.join(options.delimiter)).join('\r\n')}\r\n`;
}
