/**
 * CSV for Excel and Google Sheets. A UTF-8 byte order mark keeps Vietnamese
 * text intact in Excel. Columns are separated by commas; decimals use the
 * separator of the viewer's locale (Vietnamese Windows reads "0,35" as a number),
 * and any value containing a comma, quote or line break is quoted.
 */

// Byte order mark: tells Excel the file is UTF-8.
const BOM = String.fromCharCode(0xfeff);
const CRLF = String.fromCharCode(13, 10);

export interface CsvColumn<T> {
  label: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

export function decimalSeparator(locale?: string): string {
  return new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.';
}

function cell(v: string | number | boolean | null | undefined, decimal: string): string {
  if (v === null || v === undefined) return '';
  let s: string;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '';
    s = Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000).replace('.', decimal);
  } else {
    s = String(v);
  }
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[], decimal = decimalSeparator()): string {
  const lines = [
    columns.map((c) => cell(c.label, decimal)).join(','),
    ...rows.map((r) => columns.map((c) => cell(c.value(r), decimal)).join(',')),
  ];
  return BOM + lines.join(CRLF) + CRLF;
}

/** Hands the CSV to the browser as a file download. */
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
