import { describe, expect, it } from 'vitest';
import { decimalSeparator, toCsv } from './csv.ts';

const rows = [
  { name: 'Lan, Nguyễn', p: 0.35, n: 12, note: 'nói "hay"' },
  { name: 'Minh', p: null, n: 0, note: 'dòng 1\ndòng 2' },
];
const columns = [
  { label: 'Tên', value: (r: (typeof rows)[number]) => r.name },
  { label: 'Độ khó p', value: (r: (typeof rows)[number]) => r.p },
  { label: 'Số câu', value: (r: (typeof rows)[number]) => r.n },
  { label: 'Ghi chú', value: (r: (typeof rows)[number]) => r.note },
];

describe('toCsv', () => {
  it('starts with a BOM, quotes what needs quoting and uses CRLF', () => {
    const csv = toCsv(rows, columns, '.');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Tên,Độ khó p,Số câu,Ghi chú',
      '"Lan, Nguyễn",0.35,12,"nói ""hay"""',
      'Minh,,0,"dòng 1\ndòng 2"',
      '',
    ]);
  });

  it('writes decimals the way a Vietnamese Excel expects', () => {
    const csv = toCsv(rows, columns, ',');
    expect(csv).toContain('"Lan, Nguyễn","0,35",12');
  });

  it('detects the decimal separator of a locale', () => {
    expect(decimalSeparator('vi-VN')).toBe(',');
    expect(decimalSeparator('en-US')).toBe('.');
  });
});
