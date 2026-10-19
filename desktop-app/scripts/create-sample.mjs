import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const output = resolve('test-fixtures', 'sample-invoice.pdf');
await mkdir(dirname(output), { recursive: true });

const document = await PDFDocument.create();
const page = document.addPage([612, 792]);
const regular = await document.embedFont(StandardFonts.Helvetica);
const bold = await document.embedFont(StandardFonts.HelveticaBold);

page.drawText('NORTHLINE FIELD SUPPLIES', { x: 54, y: 730, size: 18, font: bold, color: rgb(.08, .17, .16) });
page.drawText('Invoice PP-1048', { x: 54, y: 696, size: 12, font: regular });
page.drawText('Issued: October 18, 2026', { x: 54, y: 676, size: 10, font: regular, color: rgb(.3, .35, .34) });

const rows = [
  ['Item', 'Qty', 'Unit price', 'Amount'],
  ['Document sleeves', '4', '$8.50', '$34.00'],
  ['Archive labels', '2', '$12.00', '$24.00'],
  ['Field binder', '1', '$19.50', '$19.50']
];
const xs = [54, 312, 388, 490];
rows.forEach((row, rowIndex) => {
  const y = 610 - rowIndex * 34;
  if (rowIndex === 0) page.drawRectangle({ x: 48, y: y - 8, width: 516, height: 26, color: rgb(.87, .95, .94) });
  row.forEach((cell, columnIndex) => page.drawText(cell, { x: xs[columnIndex], y, size: rowIndex === 0 ? 10 : 11, font: rowIndex === 0 ? bold : regular }));
});
page.drawText('Total', { x: 388, y: 454, size: 11, font: bold });
page.drawText('$77.50', { x: 490, y: 454, size: 11, font: bold });
page.drawText('Signature', { x: 54, y: 210, size: 10, font: regular, color: rgb(.3, .35, .34) });
page.drawLine({ start: { x: 54, y: 180 }, end: { x: 280, y: 180 }, thickness: 1, color: rgb(.6, .65, .63) });

await writeFile(output, await document.save());
console.log(output);
