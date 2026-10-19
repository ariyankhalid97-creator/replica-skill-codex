import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { canSafelyEditWithoutImportedFont, deletePdfPage, duplicatePdfPage, extractPdfPage, extractTable, movePdfPage, rotatePdfPage, rowsToCsv, type TextRun } from './pdf';

const run = (text: string, x: number, y: number, width = 30): TextRun => ({
  id: `${text}-${x}-${y}`, text, viewX: x, viewY: y, viewWidth: width, viewHeight: 12,
  pdfX: x, pdfY: y, pdfWidth: width, pdfHeight: 12, fontName: 'Helvetica',
  fontFamily: 'Helvetica', fontSize: 12, weight: 'regular', italic: false, alignment: 'left', fontSource: 'standard'
});

describe('font safety', () => {
  it('allows a standard PDF font without imported bytes', () => {
    expect(canSafelyEditWithoutImportedFont(run('Safe', 10, 10))).toBe(true);
  });

  it('blocks an unavailable document font from silent substitution', () => {
    expect(canSafelyEditWithoutImportedFont({ ...run('Blocked', 10, 10), fontSource: 'unavailable' })).toBe(false);
  });
});

describe('table extraction', () => {
  it('clusters aligned text into rows and separated cells', () => {
    const table = extractTable([
      run('Item', 10, 10), run('Amount', 150, 10),
      run('Coffee', 10, 30), run('$4.50', 150, 30)
    ]);
    expect(table).toEqual([['Item', 'Amount'], ['Coffee', '$4.50']]);
  });

  it('escapes CSV values', () => {
    expect(rowsToCsv([['A', 'hello, world'], ['B', 'say "yes"']]))
      .toBe('A,"hello, world"\r\nB,"say ""yes"""');
  });
});

describe('page operations', () => {
  async function documentWithPages(count: number) {
    const doc = await PDFDocument.create();
    Array.from({ length: count }, (_, index) => doc.addPage([300 + index, 400]));
    return new Uint8Array(await doc.save());
  }

  it('rotates, duplicates, moves, extracts, and deletes without rasterizing pages', async () => {
    const source = await documentWithPages(2);
    const rotated = await PDFDocument.load(await rotatePdfPage(source, 1));
    expect(rotated.getPage(0).getRotation().angle).toBe(90);

    const duplicatedBytes = await duplicatePdfPage(source, 1);
    expect((await PDFDocument.load(duplicatedBytes)).getPageCount()).toBe(3);
    const moved = await PDFDocument.load(await movePdfPage(source, 1, 1));
    expect(moved.getPage(0).getWidth()).toBe(301);
    expect((await PDFDocument.load(await extractPdfPage(source, 2))).getPageCount()).toBe(1);
    expect((await PDFDocument.load(await deletePdfPage(source, 1))).getPageCount()).toBe(1);
  });

  it('refuses to delete the final page', async () => {
    await expect(deletePdfPage(await documentWithPages(1), 1)).rejects.toThrow('at least one page');
  });
});
