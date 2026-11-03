import type { EquationTerm, ReportLine } from '../domain/report-document.js';

/*
 * Minimal dependency-free PDF 1.4 writer for the budget report.
 * Uses the built-in Helvetica fonts with WinAnsi encoding, so only Latin-1 text and the euro sign are
 * supported; any other character is written as "?".
 */

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;
const FOOTER_SPACE = 28;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const OPERATOR_WIDTH = 22;

type Font = 'F1' | 'F2';

/** Helvetica glyph widths (1/1000 em) for ASCII 32..126, in order. */
const REGULAR_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556,
  556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334,
  260, 334, 584
];

/** Helvetica-Bold glyph widths for ASCII 32..126, in order. */
const BOLD_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611,
  556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389,
  280, 389, 584
];

const COLORS = {
  text: '0.09 0.1 0.13',
  muted: '0.36 0.39 0.45',
  accent: '0.14 0.28 0.55',
  onAccent: '1 1 1',
  onAccentMuted: '0.82 0.88 0.97',
  card: '0.92 0.94 0.98',
  stripe: '0.955 0.96 0.97',
  rule: '0.55 0.58 0.64',
  negative: '0.75 0.1 0.1'
};

/** Maps a character to the single WinAnsi byte (as a char) that represents it. */
function toWinAnsi(char: string): string {
  const code = char.charCodeAt(0);
  if (char === '\u00a0' || char === '\u202f' || char === '\u2009' || char === '\u2007') {
    return ' ';
  }
  if (char === '\u2212' || char === '\u2013' || char === '\u2014') {
    return '-';
  }
  if (char === '\u20ac') {
    return '\x80';
  }
  if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa1 && code <= 0xff)) {
    return char;
  }
  return code < 0x20 ? ' ' : '?';
}

function encode(text: string): string {
  return Array.from(text, toWinAnsi).join('');
}

function glyphWidth(char: string, font: Font): number {
  const widths = font === 'F2' ? BOLD_WIDTHS : REGULAR_WIDTHS;
  const code = char.charCodeAt(0);
  if (code >= 32 && code <= 126) {
    return widths[code - 32];
  }
  if (char === '\u00d7') {
    return 584;
  }
  const base = char.normalize('NFD').charCodeAt(0);
  return base >= 32 && base <= 126 ? widths[base - 32] : 556;
}

/** Width in points of already-encoded text. */
export function measureText(encoded: string, font: Font, size: number): number {
  let width = 0;
  for (const char of encoded) {
    width += glyphWidth(char, font);
  }
  return (width * size) / 1000;
}

function escapeText(encoded: string): string {
  return encoded.replace(/[\\()]/g, (char) => `\\${char}`);
}

function wrap(encoded: string, font: Font, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  const flush = () => {
    if (current) {
      lines.push(current);
      current = '';
    }
  };
  for (const word of encoded.split(' ').filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureText(candidate, font, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    flush();
    let rest = word;
    while (measureText(rest, font, size) > maxWidth && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && measureText(rest.slice(0, cut), font, size) > maxWidth) {
        cut -= 1;
      }
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    current = rest;
  }
  flush();
  return lines.length ? lines : [''];
}

class PageBuilder {
  readonly pages: string[][] = [];
  private ops: string[] = [];
  /** Distance from the top of the page to the current drawing position. */
  y = MARGIN;
  /** Alternating row backgrounds make it easier to follow a row across the page. */
  stripe = false;

  constructor() {
    this.newPage();
  }

  newPage(): void {
    this.ops = [];
    this.pages.push(this.ops);
    this.y = MARGIN;
  }

  ensure(height: number): void {
    if (this.y + height > PAGE_HEIGHT - MARGIN - FOOTER_SPACE) {
      this.newPage();
    }
  }

  text(raw: string, x: number, baselineY: number, font: Font, size: number, color = COLORS.text): void {
    this.ops.push(
      `BT /${font} ${size} Tf ${color} rg ${x.toFixed(2)} ${(PAGE_HEIGHT - baselineY).toFixed(2)} Td (${escapeText(raw)}) Tj ET`
    );
  }

  /** Draws text aligned within [x, x + width]. */
  aligned(raw: string, x: number, width: number, align: 'left' | 'right' | 'center', baselineY: number, font: Font, size: number, color?: string): void {
    const textWidth = measureText(raw, font, size);
    const offset = align === 'left' ? 0 : align === 'right' ? width - textWidth : (width - textWidth) / 2;
    this.text(raw, x + Math.max(0, offset), baselineY, font, size, color);
  }

  rect(x: number, top: number, width: number, height: number, color: string): void {
    this.ops.push(`${color} rg ${x.toFixed(2)} ${(PAGE_HEIGHT - top - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`);
  }

  line(x1: number, x2: number, atY: number, color = COLORS.rule, width = 0.5): void {
    const y = (PAGE_HEIGHT - atY).toFixed(2);
    this.ops.push(`${color} RG ${width} w ${x1.toFixed(2)} ${y} m ${x2.toFixed(2)} ${y} l S`);
  }
}

function fitText(raw: string, font: Font, maxSize: number, maxWidth: number): number {
  const width = measureText(raw, font, maxSize);
  return width > maxWidth ? Math.max(6, (maxSize * maxWidth) / width) : maxSize;
}

function truncate(encoded: string, font: Font, size: number, maxWidth: number): string {
  if (measureText(encoded, font, size) <= maxWidth) {
    return encoded;
  }
  let text = encoded;
  while (text.length > 1 && measureText(`${text}...`, font, size) > maxWidth) {
    text = text.slice(0, -1);
  }
  return `${text}...`;
}

const BODY_SIZE = 10.5;
const ROW_HEIGHT = 17;
const VALUE_WIDTH = 100;
const DETAIL_WIDTH = 110;

const amountColor = (amount: number | undefined): string =>
  amount !== undefined && amount < -0.005 ? COLORS.negative : COLORS.text;

function drawRow(page: PageBuilder, line: Extract<ReportLine, { kind: 'row' }>): void {
  const font: Font = line.strong ? 'F2' : 'F1';
  const indent = line.level ? 16 : 6;
  const detailWidth = line.detail ? DETAIL_WIDTH : 0;
  const labelWidth = CONTENT_WIDTH - indent - VALUE_WIDTH - detailWidth - 12;
  const labelLines = wrap(encode(line.label), font, BODY_SIZE, labelWidth);
  const height = labelLines.length * 13 + 4;
  page.ensure(Math.max(height, ROW_HEIGHT));
  const top = page.y;
  if (line.strong) {
    page.line(MARGIN, PAGE_WIDTH - MARGIN, top, COLORS.rule, 0.8);
    page.stripe = false;
  } else {
    if (page.stripe) {
      page.rect(MARGIN, top, CONTENT_WIDTH, Math.max(height, ROW_HEIGHT), COLORS.stripe);
    }
    page.stripe = !page.stripe;
  }
  const baseline = top + 12.5;
  labelLines.forEach((text, index) => page.text(text, MARGIN + indent, baseline + index * 13, font, BODY_SIZE));
  if (line.detail) {
    const detail = truncate(encode(line.detail), 'F1', 9.5, detailWidth - 10);
    page.aligned(detail, MARGIN + CONTENT_WIDTH - VALUE_WIDTH - detailWidth, detailWidth - 10, 'right', baseline, 'F1', 9.5, COLORS.muted);
  }
  page.aligned(encode(line.value), MARGIN + CONTENT_WIDTH - VALUE_WIDTH - 6, VALUE_WIDTH, 'right', baseline, font, BODY_SIZE, amountColor(line.amount));
  page.y = top + Math.max(height, ROW_HEIGHT);
}

function drawEquation(page: PageBuilder, line: Extract<ReportLine, { kind: 'equation' }>): void {
  const all = [...line.terms, line.result];
  const columnWidth = (CONTENT_WIDTH - (all.length - 1) * OPERATOR_WIDTH) / all.length;
  const labelSize = 8.5;
  const labelLines = (term: EquationTerm) => wrap(encode(term.label), 'F1', labelSize, columnWidth - 8).slice(0, 2);
  const labelHeight = Math.max(...all.map((term) => labelLines(term).length)) * 10.5;
  const height = 12 + labelHeight + 22;
  page.ensure(height + 12);
  page.y += 6;
  const top = page.y;

  let x = MARGIN;
  all.forEach((term, index) => {
    const isResult = index === all.length - 1;
    const op = isResult ? '=' : term.op;
    if (index > 0) {
      if (op) {
        page.aligned(op, x, OPERATOR_WIDTH, 'center', top + height / 2 + 6, 'F2', 16, COLORS.accent);
      }
      x += OPERATOR_WIDTH;
    }
    page.rect(x, top, columnWidth, height, isResult ? COLORS.accent : COLORS.card);
    labelLines(term).forEach((text, lineIndex) =>
      page.aligned(text, x, columnWidth, 'center', top + 14 + lineIndex * 10.5, 'F1', labelSize, isResult ? COLORS.onAccentMuted : COLORS.muted)
    );
    const value = encode(term.value);
    const size = fitText(value, 'F2', 14, columnWidth - 8);
    const color = isResult ? COLORS.onAccent : amountColor(term.amount);
    page.aligned(value, x, columnWidth, 'center', top + 14 + labelHeight + 11, 'F2', size, color);
    x += columnWidth;
  });
  page.y = top + height + 8;
  page.stripe = false;
}

function drawLine(page: PageBuilder, line: ReportLine): void {
  switch (line.kind) {
    case 'title':
      page.ensure(36);
      page.text(encode(line.text), MARGIN, page.y + 24, 'F2', 24, COLORS.accent);
      page.y += 32;
      break;
    case 'subtitle':
      page.ensure(18);
      page.text(encode(line.text), MARGIN, page.y + 10, 'F1', 10, COLORS.muted);
      page.y += 18;
      break;
    case 'heading':
      page.ensure(120);
      page.y += 14;
      page.rect(MARGIN, page.y, CONTENT_WIDTH, 26, COLORS.accent);
      page.text(encode(line.text), MARGIN + 10, page.y + 18, 'F2', 14, COLORS.onAccent);
      page.y += 32;
      page.stripe = false;
      break;
    case 'subheading': {
      const lines = wrap(encode(line.text), 'F2', 11.5, CONTENT_WIDTH);
      page.ensure(80 + lines.length * 14);
      page.y += 10;
      lines.forEach((text, index) => page.text(text, MARGIN, page.y + 11 + index * 14, 'F2', 11.5, COLORS.accent));
      page.y += lines.length * 14 + 2;
      page.line(MARGIN, PAGE_WIDTH - MARGIN, page.y, COLORS.accent, 1);
      page.y += 3;
      page.stripe = false;
      break;
    }
    case 'note': {
      const lines = wrap(encode(line.text), 'F1', 10, CONTENT_WIDTH);
      page.ensure(lines.length * 13 + 6);
      lines.forEach((text, index) => page.text(text, MARGIN, page.y + 11 + index * 13, 'F1', 10, COLORS.muted));
      page.y += lines.length * 13 + 6;
      break;
    }
    case 'row':
      drawRow(page, line);
      break;
    case 'equation':
      drawEquation(page, line);
      break;
  }
}

/** Renders the report document as a PDF file. The output is deterministic for a given document. */
export function renderReportPdf(lines: readonly ReportLine[]): Uint8Array<ArrayBuffer> {
  const page = new PageBuilder();
  lines.forEach((line) => drawLine(page, line));

  const total = page.pages.length;
  const streams = page.pages.map((ops, index) => {
    const label = encode(`${index + 1} / ${total}`);
    const footer = `BT /F1 8 Tf ${COLORS.muted} rg ${((PAGE_WIDTH - measureText(label, 'F1', 8)) / 2).toFixed(2)} ${(MARGIN - 8).toFixed(2)} Td (${escapeText(label)}) Tj ET`;
    return [...ops, footer].join('\n');
  });

  const title = lines.find((line) => line.kind === 'title');
  const objects: string[] = [];
  const add = (body: string): number => objects.push(body);
  add('<< /Type /Catalog /Pages 2 0 R >>');
  const firstPageObject = 6;
  add(`<< /Type /Pages /Count ${total} /Kids [${streams.map((_, i) => `${firstPageObject + i * 2} 0 R`).join(' ')}] >>`);
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  add(`<< /Title (${escapeText(encode(title?.kind === 'title' ? title.text : ''))}) /Producer (Budget Planner) >>`);
  streams.forEach((stream, index) => {
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${firstPageObject + index * 2 + 1} 0 R >>`
    );
    add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  let output = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(output.length);
    output += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    output += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const bytes = new Uint8Array(new ArrayBuffer(output.length));
  for (let i = 0; i < output.length; i += 1) {
    bytes[i] = output.charCodeAt(i) & 0xff;
  }
  return bytes;
}
