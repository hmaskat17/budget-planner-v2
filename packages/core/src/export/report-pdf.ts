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
const OPERATOR_WIDTH = 16;

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
  text: '0.1 0.1 0.12',
  muted: '0.42 0.44 0.48',
  band: '0.9 0.92 0.97',
  highlight: '0.86 0.93 0.88',
  rule: '0.78 0.8 0.84'
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

  line(x1: number, x2: number, atY: number, color = COLORS.rule): void {
    const y = (PAGE_HEIGHT - atY).toFixed(2);
    this.ops.push(`${color} RG 0.5 w ${x1.toFixed(2)} ${y} m ${x2.toFixed(2)} ${y} l S`);
  }
}

function fitText(raw: string, font: Font, maxSize: number, maxWidth: number): number {
  const width = measureText(raw, font, maxSize);
  return width > maxWidth ? Math.max(5, (maxSize * maxWidth) / width) : maxSize;
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

function drawRow(page: PageBuilder, line: Extract<ReportLine, { kind: 'row' }>): void {
  const size = 9.5;
  const font: Font = line.strong ? 'F2' : 'F1';
  const indent = line.level ? 14 : 0;
  const valueWidth = 110;
  const detailWidth = line.detail ? 120 : 0;
  const labelWidth = CONTENT_WIDTH - indent - valueWidth - detailWidth - 8;
  const labelLines = wrap(encode(line.label), font, size, labelWidth);
  const height = labelLines.length * 12 + 3;
  page.ensure(height);
  if (line.strong) {
    page.line(MARGIN, PAGE_WIDTH - MARGIN, page.y);
  }
  const baseline = page.y + 10;
  labelLines.forEach((text, index) => page.text(text, MARGIN + indent, baseline + index * 12, font, size));
  if (line.detail) {
    const detail = truncate(encode(line.detail), 'F1', 8.5, detailWidth);
    page.aligned(detail, MARGIN + CONTENT_WIDTH - valueWidth - detailWidth, detailWidth - 8, 'right', baseline, 'F1', 8.5, COLORS.muted);
  }
  page.aligned(encode(line.value), MARGIN + CONTENT_WIDTH - valueWidth, valueWidth, 'right', baseline, font, size);
  page.y += height;
}

function drawEquation(page: PageBuilder, line: Extract<ReportLine, { kind: 'equation' }>): void {
  const columns = line.terms.length + 1;
  const operators = line.terms.filter((term) => term.op).length + 1;
  const columnWidth = (CONTENT_WIDTH - operators * OPERATOR_WIDTH) / columns;
  const labelSize = 7;
  const labelLines = (term: EquationTerm) => wrap(encode(term.label), 'F1', labelSize, columnWidth - 4).slice(0, 3);
  const all = [...line.terms, line.result];
  const maxLabelLines = Math.max(...all.map((term) => labelLines(term).length));
  const height = 22 + maxLabelLines * 9 + 8;
  page.ensure(height + 6);
  page.y += 4;
  const top = page.y;
  page.rect(MARGIN, top, CONTENT_WIDTH, height, COLORS.band);

  let x = MARGIN;
  all.forEach((term, index) => {
    const isResult = index === all.length - 1;
    const op = isResult ? '=' : term.op;
    if (op) {
      page.aligned(op, x, OPERATOR_WIDTH, 'center', top + 20, 'F2', 12, COLORS.muted);
      x += OPERATOR_WIDTH;
    }
    if (isResult) {
      page.rect(x + 1, top + 3, columnWidth - 2, height - 6, COLORS.highlight);
    }
    const value = encode(term.value);
    const size = fitText(value, 'F2', 11, columnWidth - 4);
    page.aligned(value, x, columnWidth, 'center', top + 17, 'F2', size);
    labelLines(term).forEach((text, lineIndex) =>
      page.aligned(text, x, columnWidth, 'center', top + 28 + lineIndex * 9, 'F1', labelSize, COLORS.muted)
    );
    x += columnWidth;
  });
  page.y = top + height + 4;
}

function drawLine(page: PageBuilder, line: ReportLine): void {
  switch (line.kind) {
    case 'title':
      page.ensure(30);
      page.text(encode(line.text), MARGIN, page.y + 20, 'F2', 20);
      page.y += 28;
      break;
    case 'subtitle':
      page.ensure(16);
      page.text(encode(line.text), MARGIN, page.y + 9, 'F1', 9, COLORS.muted);
      page.y += 14;
      break;
    case 'heading':
      page.ensure(70);
      page.y += 10;
      page.rect(MARGIN, page.y, CONTENT_WIDTH, 22, COLORS.band);
      page.text(encode(line.text), MARGIN + 8, page.y + 15, 'F2', 12);
      page.y += 28;
      break;
    case 'subheading': {
      const lines = wrap(encode(line.text), 'F2', 10, CONTENT_WIDTH);
      page.ensure(40 + lines.length * 13);
      page.y += 6;
      lines.forEach((text, index) => page.text(text, MARGIN, page.y + 10 + index * 13, 'F2', 10));
      page.y += lines.length * 13 + 3;
      break;
    }
    case 'note': {
      const lines = wrap(encode(line.text), 'F1', 9, CONTENT_WIDTH);
      page.ensure(lines.length * 12 + 4);
      lines.forEach((text, index) => page.text(text, MARGIN, page.y + 10 + index * 12, 'F1', 9, COLORS.muted));
      page.y += lines.length * 12 + 4;
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
