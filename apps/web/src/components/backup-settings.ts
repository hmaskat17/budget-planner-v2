import { LitElement, html, css } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import {
  backupFileName,
  buildBudgetReport,
  buildReportDocument,
  createBackup,
  parseBackup,
  renderReportCsv,
  renderReportPdf,
  reportFileName,
  serializeBackup,
  type BudgetData,
  type ValidationIssue
} from '@budget-planner/core';
import { baseStyles } from '../ui/shared-styles.ts';
import { icon } from '../ui/icons.ts';
import { LocalizeController, getLocalePreference, money, percent, scenarioName, t } from '../i18n/index.ts';
import { downloadBackup, downloadFile, readBackupFile } from '../adapters/backup-file.ts';
import type { MessageKey } from '@budget-planner/preferences';

const KNOWN_ISSUE_CODES = ['invalid-json', 'invalid-format', 'invalid-version', 'unsupported-version'];

function issueMessage(issue: ValidationIssue): string {
  if (KNOWN_ISSUE_CODES.includes(issue.code)) {
    return t(`backup.issue.${issue.code}` as MessageKey);
  }
  return t('backup.issue.invalid-data', { path: issue.path });
}

/** Export and import of budget data as a versioned file. Import replaces all data after confirmation. */
@customElement('backup-settings')
export class BackupSettings extends LitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        position: relative;
        display: inline-block;
      }
      .toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 36px;
        padding: 0 12px;
        font-size: 0.85rem;
        color: var(--text);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
      }
      .toggle:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      .panel {
        position: absolute;
        right: 0;
        z-index: 20;
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: min(320px, calc(100vw - 32px));
        margin-top: 8px;
        padding: 16px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        box-shadow: 0 8px 24px rgb(0 0 0 / 0.15);
      }
      section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      section + section {
        padding-top: 14px;
        border-top: 1px solid var(--border-soft);
      }
      h2 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--text);
      }
      section button {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 40px;
        padding: 0 14px;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--accent);
        background: transparent;
        border: 1px dashed color-mix(in srgb, var(--accent) 45%, transparent);
        border-radius: var(--radius-sm);
      }
      section button:hover {
        background: color-mix(in srgb, var(--accent) 8%, transparent);
      }
      .success {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0;
        font-size: 1.05rem;
        font-weight: 600;
        color: var(--positive);
      }
      .info {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--muted);
      }
      .warning {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--negative);
      }
      .error {
        margin: 0;
        padding-left: 18px;
        font-size: 0.8125rem;
        color: var(--negative);
      }
      input[type='file'] {
        display: none;
      }
    `
  ];

  protected readonly _localize = new LocalizeController(this);

  @property({ attribute: false })
  data?: BudgetData;

  @state()
  private _open = false;

  @state()
  private _importErrors: string[] = [];

  @state()
  private _exportErrors: string[] = [];

  @state()
  private _status = '';

  @query('input[type="file"]')
  private _fileInput!: HTMLInputElement;

  private readonly _onDocumentPointerDown = (event: PointerEvent): void => {
    if (this._open && !event.composedPath().includes(this)) {
      this._setOpen(false);
    }
  };

  private readonly _onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (this._open && event.key === 'Escape') {
      this._setOpen(false);
    }
  };

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('pointerdown', this._onDocumentPointerDown);
    document.addEventListener('keydown', this._onDocumentKeyDown);
  }

  override disconnectedCallback(): void {
    document.removeEventListener('pointerdown', this._onDocumentPointerDown);
    document.removeEventListener('keydown', this._onDocumentKeyDown);
    super.disconnectedCallback();
  }

  private _setOpen(open: boolean): void {
    this._open = open;
    if (!open) {
      this._reset();
    }
  }

  private _reset(): void {
    this._importErrors = [];
    this._exportErrors = [];
    this._status = '';
  }

  private _export(): void {
    if (!this.data) {
      return;
    }
    this._reset();
    try {
      const now = new Date();
      downloadBackup(backupFileName(now), serializeBackup(createBackup(this.data, now)));
    } catch {
      this._exportErrors = [t('backup.exportFailed')];
    }
  }

  private _exportReport(format: 'pdf' | 'csv'): void {
    if (!this.data) {
      return;
    }
    this._reset();
    try {
      const now = new Date();
      const { numberLocale } = getLocalePreference();
      const lines = buildReportDocument(buildBudgetReport(this.data), {
        t: (key, params) => t(key as MessageKey, params),
        money,
        percent,
        scenarioName,
        generatedAt: now.toLocaleDateString(numberLocale)
      });
      if (format === 'pdf') {
        downloadFile(reportFileName('pdf', now), renderReportPdf(lines), 'application/pdf');
      } else {
        const decimalSeparator = new Intl.NumberFormat(numberLocale).format(1.5).includes(',') ? ',' : '.';
        const csv = renderReportCsv(lines, {
          decimalSeparator,
          delimiter: decimalSeparator === ',' ? ';' : ','
        });
        downloadFile(reportFileName('csv', now), csv, 'text/csv;charset=utf-8');
      }
    } catch {
      this._exportErrors = [t('backup.exportFailed')];
    }
  }

  private async _onFileChosen(): Promise<void> {
    const file = this._fileInput.files?.[0];
    this._fileInput.value = '';
    if (!file) {
      return;
    }
    this._reset();
    try {
      const result = parseBackup((await readBackupFile(file)).text);
      if ('data' in result) {
        this._status = t('backup.imported');
        this.dispatchEvent(
          new CustomEvent<BudgetData>('backup-import', { detail: result.data, bubbles: true, composed: true })
        );
      } else {
        this._importErrors = [t('backup.importFailed'), ...result.issues.slice(0, 5).map(issueMessage)];
      }
    } catch {
      this._importErrors = [t('backup.readError')];
    }
  }

  override render() {
    return html`
      <button
        type="button"
        id="backup-toggle"
        class="toggle"
        aria-expanded=${this._open ? 'true' : 'false'}
        aria-controls="backup-panel"
        @click=${() => this._setOpen(!this._open)}
      >
        ${icon('download', 16)}${t('backup.title')}
      </button>
      ${this._open
        ? html`
            <div id="backup-panel" class="panel" role="group" aria-label=${t('backup.title')}>
              <section aria-labelledby="restore-title">
                <h2 id="restore-title">${t('backup.restoreTitle')}</h2>
                <p class="warning">${t('backup.restoreWarning')}</p>
                <button type="button" id="import-data" @click=${() => this._fileInput.click()}>
                  ${icon('upload', 16)}${t('backup.import')}
                </button>
                <input
                  type="file"
                  id="import-file"
                  accept=".json,application/json"
                  aria-label=${t('backup.import')}
                  @change=${() => this._onFileChosen()}
                />
                ${this._importErrors.length
                  ? html`<ul class="error import-errors" role="alert">
                      ${this._importErrors.map((message) => html`<li>${message}</li>`)}
                    </ul>`
                  : ''}
                ${this._status
                  ? html`<p class="success" role="status">${icon('circleCheck', 28)}<span>${this._status}</span></p>`
                  : ''}
              </section>
              <section aria-labelledby="create-title">
                <h2 id="create-title">${t('backup.createTitle')}</h2>
                <p class="info">${t('backup.createInfo')}</p>
                <button type="button" id="export-data" @click=${() => this._export()}>
                  ${icon('download', 16)}${t('backup.export')}
                </button>
                ${this._exportErrors.length
                  ? html`<ul class="error export-errors" role="alert">
                      ${this._exportErrors.map((message) => html`<li>${message}</li>`)}
                    </ul>`
                  : ''}
              </section>
              <section aria-labelledby="report-title">
                <h2 id="report-title">${t('report.sectionTitle')}</h2>
                <p class="info">${t('report.info')}</p>
                <button type="button" id="export-report-pdf" @click=${() => this._exportReport('pdf')}>
                  ${icon('download', 16)}${t('report.exportPdf')}
                </button>
                <button type="button" id="export-report-csv" @click=${() => this._exportReport('csv')}>
                  ${icon('download', 16)}${t('report.exportCsv')}
                </button>
              </section>
            </div>
          `
        : ''}
    `;
  }
}
