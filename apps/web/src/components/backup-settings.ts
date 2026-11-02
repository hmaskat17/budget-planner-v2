import { LitElement, html, css } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import {
  backupFileName,
  createBackup,
  parseBackup,
  serializeBackup,
  type BudgetData,
  type ValidationIssue
} from '@budget-planner/core';
import { baseStyles } from '../ui/shared-styles.ts';
import { icon } from '../ui/icons.ts';
import { LocalizeController, t } from '../i18n/index.ts';
import { downloadBackup, readBackupFile } from '../adapters/backup-file.ts';
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
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .actions button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .hint,
      .status {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--muted);
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
  private _pending?: { name: string; data: BudgetData };

  @state()
  private _errors: string[] = [];

  @state()
  private _status = '';

  @query('input[type="file"]')
  private _fileInput!: HTMLInputElement;

  private readonly _onDocumentPointerDown = (event: PointerEvent): void => {
    if (this._open && !event.composedPath().includes(this)) {
      this._open = false;
    }
  };

  private readonly _onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (this._open && event.key === 'Escape') {
      this._open = false;
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

  private _reset(): void {
    this._pending = undefined;
    this._errors = [];
    this._status = '';
  }

  private _export(): void {
    if (!this.data) {
      return;
    }
    this._reset();
    const now = new Date();
    downloadBackup(backupFileName(now), serializeBackup(createBackup(this.data, now)));
    this._status = t('backup.exported');
  }

  private async _onFileChosen(): Promise<void> {
    const file = this._fileInput.files?.[0];
    this._fileInput.value = '';
    if (!file) {
      return;
    }
    this._reset();
    try {
      const { name, text } = await readBackupFile(file);
      const result = parseBackup(text);
      if ('data' in result) {
        this._pending = { name, data: result.data };
      } else {
        this._errors = [t('backup.importFailed'), ...result.issues.slice(0, 5).map(issueMessage)];
      }
    } catch {
      this._errors = [t('backup.readError')];
    }
  }

  private _confirmImport(): void {
    if (!this._pending) {
      return;
    }
    const { data } = this._pending;
    this._reset();
    this._status = t('backup.imported');
    this.dispatchEvent(new CustomEvent<BudgetData>('backup-import', { detail: data, bubbles: true, composed: true }));
  }

  override render() {
    return html`
      <button
        type="button"
        id="backup-toggle"
        class="toggle"
        aria-expanded=${this._open ? 'true' : 'false'}
        aria-controls="backup-panel"
        @click=${() => (this._open = !this._open)}
      >
        ${icon('download', 16)}${t('backup.title')}
      </button>
      ${this._open
        ? html`
            <div id="backup-panel" class="panel" role="group" aria-label=${t('backup.title')}>
              <div class="actions">
                <button type="button" id="export-data" @click=${() => this._export()}>
                  ${icon('download', 16)}${t('backup.export')}
                </button>
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
              </div>
              <p class="hint">${t('backup.hint')}</p>
              ${this._pending
                ? html`
                    <p class="status" role="alert">${t('backup.confirm', { file: this._pending.name })}</p>
                    <div class="actions">
                      <button type="button" id="confirm-import" @click=${() => this._confirmImport()}>
                        ${t('backup.confirmReplace')}
                      </button>
                      <button type="button" id="cancel-import" @click=${() => this._reset()}>
                        ${t('backup.cancel')}
                      </button>
                    </div>
                  `
                : ''}
              ${this._errors.length
                ? html`<ul class="error" role="alert">
                    ${this._errors.map((message) => html`<li>${message}</li>`)}
                  </ul>`
                : ''}
              ${this._status ? html`<p class="status" role="status">${this._status}</p>` : ''}
            </div>
          `
        : ''}
    `;
  }
}
