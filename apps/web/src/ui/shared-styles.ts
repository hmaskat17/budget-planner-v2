import { css } from 'lit';

/** Shared form, button, row and stat styles; colors come from the :root tokens and --accent. */
export const baseStyles = css`
  :host {
    display: block;
    font-family: var(--font);
  }
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 14px;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text);
  }
  h3 .icon {
    color: var(--muted);
  }
  .icon {
    flex: none;
  }

  input,
  select {
    font: inherit;
    font-size: 0.9rem;
    color: var(--text);
    height: 36px;
    min-width: 0;
    padding: 0 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    transition: border-color 0.12s, box-shadow 0.12s;
  }
  input[type='number'] {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  input::placeholder {
    color: var(--muted);
  }
  input:hover,
  select:hover {
    border-color: var(--muted);
  }
  input:focus-visible,
  select:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
  }
  input[readonly] {
    background: var(--border-soft);
    color: var(--muted);
  }

  button {
    font: inherit;
    cursor: pointer;
  }
  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  /* Icon-only button (remove, rename, delete). */
  .remove-entry-input,
  .remove-item-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 32px;
    height: 32px;
    padding: 0;
    color: var(--muted);
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
  }
  .remove-entry-input:hover,
  .remove-item-btn:hover {
    color: var(--negative);
    background: var(--negative-bg);
  }
  .entry-spacer {
    visibility: hidden;
  }

  /* Text-style "add" button. */
  .add-entry-button,
  .add-item-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    padding: 6px 10px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--accent);
    background: transparent;
    border: 1px dashed color-mix(in srgb, var(--accent) 45%, transparent);
    border-radius: var(--radius-sm);
  }
  .add-entry-button:hover,
  .add-item-btn:hover {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .entry-inputs {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .entry-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(72px, 100px) 32px;
    align-items: center;
    gap: 8px;
  }
  .entry-row input,
  .entry-row select {
    width: 100%;
  }

  .stat-row,
  .metric-row,
  .balance-row,
  .person-subtotal-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    font-size: 0.9rem;
    color: var(--text-2);
    font-variant-numeric: tabular-nums;
  }
  .highlight {
    padding-top: 10px;
    margin-top: 10px;
    border-top: 1px solid var(--border);
    font-weight: 600;
    color: var(--text);
  }

  /* Total line at the bottom of a list. */
  .person-total,
  .household-total {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 16px 0 0;
    padding-top: 12px;
    border-top: 1px solid var(--border);
    font-size: 0.9rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .total-amount,
  .household-total strong {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text);
  }

  .negative {
    color: var(--negative);
  }
`;
