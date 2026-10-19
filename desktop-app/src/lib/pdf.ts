import { degrees, PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface TextRun {
  id: string;
  text: string;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
  viewX: number;
  viewY: number;
  viewWidth: number;
  viewHeight: number;
  fontName: string;
  fontFamily: string;
  fontSize: number;
  weight: string;
  italic: boolean;
  alignment: 'left' | 'center' | 'right';
  fontSource: 'embedded' | 'standard' | 'unavailable';
}

export interface FontChoice {
  name: string;
  bytes: Uint8Array;
}

export interface FidelityResult {
  status: 'pass' | 'warning' | 'fail';
  changedOutsidePixels: number;
  message: string;
}

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface PdfFormField {
  name: string;
  type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'unsupported';
  value: string;
  options?: string[];
}

export async function loadPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  return pdfjs.getDocument({ data: bytes.slice() }).promise;
}

export async function renderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number
): Promise<{ width: number; height: number; runs: TextRun[]; capturedFonts: Record<string, FontChoice> }> {
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas is unavailable');
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * ratio);
  canvas.height = Math.floor(viewport.height * ratio);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  await page.render({ canvasContext: context, viewport }).promise;

  const content = await page.getTextContent();
  const runs: TextRun[] = [];
  const capturedFonts: Record<string, FontChoice> = {};
  const commonObjects = (page as unknown as { commonObjs?: { get(name: string): unknown } }).commonObjs;
  Object.keys(content.styles).forEach((fontName) => {
    try {
      const fontObject = commonObjects?.get(fontName) as { data?: Uint8Array | ArrayBuffer; name?: string } | undefined;
      const data = fontObject?.data;
      const bytes = data instanceof Uint8Array ? data : data instanceof ArrayBuffer ? new Uint8Array(data) : null;
      if (bytes?.byteLength) {
        capturedFonts[fontName] = { name: fontObject?.name || content.styles[fontName]?.fontFamily || fontName, bytes: bytes.slice() };
      }
    } catch {
      // Some PDF.js font objects intentionally expose metrics only. The UI will
      // offer the local Font Vault instead of pretending an exact match exists.
    }
  });
  content.items.forEach((raw, index) => {
    if (!('str' in raw) || !raw.str.trim()) return;
    const item = raw as typeof raw & { str: string; transform: number[]; width: number; height: number; fontName: string };
    const style = content.styles[item.fontName];
    const pdfX = item.transform[4];
    const pdfY = item.transform[5];
    const fontSize = Math.max(1, Math.hypot(item.transform[0], item.transform[1]));
    const [viewX, baselineY] = viewport.convertToViewportPoint(pdfX, pdfY);
    const viewHeight = Math.max(fontSize * scale, item.height * scale, 8);
    const family = style?.fontFamily || item.fontName || 'Unknown embedded font';
    const lower = `${family} ${item.fontName}`.toLowerCase();
    const fontSource = capturedFonts[item.fontName]
      ? 'embedded'
      : isStandardPdfFontName(`${family} ${item.fontName}`) ? 'standard' : 'unavailable';
    runs.push({
      id: `${index}-${pdfX}-${pdfY}`,
      text: item.str,
      pdfX,
      pdfY,
      pdfWidth: Math.max(item.width, 1),
      pdfHeight: Math.max(item.height || fontSize, fontSize),
      viewX,
      viewY: baselineY - viewHeight,
      viewWidth: Math.max(item.width * scale, 4),
      viewHeight,
      fontName: item.fontName,
      fontFamily: family,
      fontSize,
      weight: lower.includes('bold') ? 'bold' : 'regular',
      italic: lower.includes('italic') || lower.includes('oblique'),
      alignment: 'left',
      fontSource
    });
  });
  inferAlignment(runs, viewport.width);
  return { width: viewport.width, height: viewport.height, runs, capturedFonts };
}

function isStandardPdfFontName(name: string): boolean {
  return /(helvetica|arial|times|courier|symbol|zapfdingbats|sans-serif|serif|monospace)/i.test(name);
}

export function canSafelyEditWithoutImportedFont(run: TextRun): boolean {
  return run.fontSource === 'standard';
}

function inferAlignment(runs: TextRun[], pageWidth: number): void {
  const rows = clusterRows(runs);
  rows.forEach((row) => {
    const left = Math.min(...row.map((run) => run.viewX));
    const right = Math.max(...row.map((run) => run.viewX + run.viewWidth));
    const centerOffset = Math.abs((left + right) / 2 - pageWidth / 2);
    const rightGap = pageWidth - right;
    row.forEach((run) => {
      if (centerOffset < pageWidth * 0.04) run.alignment = 'center';
      else if (rightGap < pageWidth * 0.07 && left > pageWidth * 0.35) run.alignment = 'right';
    });
  });
}

function clusterRows(runs: TextRun[]): TextRun[][] {
  const sorted = [...runs].sort((a, b) => a.viewY - b.viewY || a.viewX - b.viewX);
  const rows: TextRun[][] = [];
  for (const run of sorted) {
    const row = rows.find((candidate) => Math.abs(candidate[0].viewY - run.viewY) <= Math.max(5, run.viewHeight * 0.45));
    if (row) row.push(run);
    else rows.push([run]);
  }
  rows.forEach((row) => row.sort((a, b) => a.viewX - b.viewX));
  return rows;
}

export function extractTable(runs: TextRun[]): string[][] {
  return clusterRows(runs)
    .map((row) => {
      const cells: string[] = [];
      let current = '';
      let previousRight = -Infinity;
      for (const run of row) {
        const gap = run.viewX - previousRight;
        const split = current && gap > Math.max(22, run.viewHeight * 1.4);
        if (split) {
          cells.push(current.trim());
          current = run.text;
        } else {
          current = `${current}${current ? ' ' : ''}${run.text}`;
        }
        previousRight = run.viewX + run.viewWidth;
      }
      if (current.trim()) cells.push(current.trim());
      return cells;
    })
    .filter((row) => row.length >= 2);
}

export function rowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function csvCell(value: string): string {
  const escaped = value.replaceAll('"', '""');
  return /[",\r\n]/.test(value) ? `"${escaped}"` : escaped;
}

function standardFontFor(run: TextRun): StandardFonts {
  const name = `${run.fontName} ${run.fontFamily}`.toLowerCase();
  if (name.includes('courier') || name.includes('mono')) {
    if (run.weight === 'bold' && run.italic) return StandardFonts.CourierBoldOblique;
    if (run.weight === 'bold') return StandardFonts.CourierBold;
    if (run.italic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  if (name.includes('times') || name.includes('serif')) {
    if (run.weight === 'bold' && run.italic) return StandardFonts.TimesRomanBoldItalic;
    if (run.weight === 'bold') return StandardFonts.TimesRomanBold;
    if (run.italic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (run.weight === 'bold' && run.italic) return StandardFonts.HelveticaBoldOblique;
  if (run.weight === 'bold') return StandardFonts.HelveticaBold;
  if (run.italic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

export async function applyTextEdit(
  source: Uint8Array,
  pageNumber: number,
  run: TextRun,
  newText: string,
  alignment: TextRun['alignment'],
  customFont?: FontChoice
): Promise<Uint8Array> {
  if (!customFont && !canSafelyEditWithoutImportedFont(run)) {
    throw new Error('The original font is unavailable. Capture it from the document or choose a matching font from Font Vault.');
  }
  const doc = await PDFDocument.load(source.slice());
  doc.registerFontkit(fontkit);
  const page = doc.getPage(pageNumber - 1);
  const font = customFont
    ? await doc.embedFont(customFont.bytes.slice(), { subset: true })
    : await doc.embedFont(standardFontFor(run));
  const size = run.fontSize;
  const newWidth = font.widthOfTextAtSize(newText, size);
  let x = run.pdfX;
  if (alignment === 'center') x += (run.pdfWidth - newWidth) / 2;
  if (alignment === 'right') x += run.pdfWidth - newWidth;
  const coverWidth = Math.max(run.pdfWidth, newWidth) + 2;
  page.drawRectangle({
    x: Math.min(run.pdfX, x) - 1,
    y: run.pdfY - size * 0.23,
    width: coverWidth,
    height: Math.max(run.pdfHeight, size) * 1.15,
    color: rgb(1, 1, 1)
  });
  page.drawText(newText, { x, y: run.pdfY, size, font, color: rgb(0.09, 0.13, 0.12) });
  return doc.save({ useObjectStreams: true });
}

export async function applySignature(
  source: Uint8Array,
  pageNumber: number,
  imageBytes: Uint8Array,
  imageType: 'png' | 'jpg',
  xPercent: number,
  yPercent: number
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(source.slice());
  const page = doc.getPage(pageNumber - 1);
  const image = imageType === 'png' ? await doc.embedPng(imageBytes.slice()) : await doc.embedJpg(imageBytes.slice());
  const pageSize = page.getSize();
  const width = Math.min(pageSize.width * 0.28, 180);
  const height = width * (image.height / image.width);
  const x = Math.max(12, Math.min(pageSize.width - width - 12, (pageSize.width - width) * (xPercent / 100)));
  const y = Math.max(12, Math.min(pageSize.height - height - 12, (pageSize.height - height) * ((100 - yPercent) / 100)));
  page.drawImage(image, { x, y, width, height, opacity: 0.96 });
  return doc.save({ useObjectStreams: true });
}

export async function rotatePdfPage(source: Uint8Array, pageNumber: number, clockwise = true): Promise<Uint8Array> {
  const doc = await PDFDocument.load(source.slice());
  const page = doc.getPage(pageNumber - 1);
  const current = page.getRotation().angle;
  page.setRotation(degrees((current + (clockwise ? 90 : 270)) % 360));
  return doc.save({ useObjectStreams: true });
}

export async function deletePdfPage(source: Uint8Array, pageNumber: number): Promise<Uint8Array> {
  const doc = await PDFDocument.load(source.slice());
  if (doc.getPageCount() <= 1) throw new Error('A PDF must keep at least one page.');
  doc.removePage(pageNumber - 1);
  return doc.save({ useObjectStreams: true });
}

export async function duplicatePdfPage(source: Uint8Array, pageNumber: number): Promise<Uint8Array> {
  const doc = await PDFDocument.load(source.slice());
  const [copy] = await doc.copyPages(doc, [pageNumber - 1]);
  doc.insertPage(pageNumber, copy);
  return doc.save({ useObjectStreams: true });
}

export async function movePdfPage(source: Uint8Array, pageNumber: number, direction: -1 | 1): Promise<Uint8Array> {
  const sourceDoc = await PDFDocument.load(source.slice());
  const count = sourceDoc.getPageCount();
  const from = pageNumber - 1;
  const to = from + direction;
  if (to < 0 || to >= count) return source.slice();
  const order = Array.from({ length: count }, (_, index) => index);
  [order[from], order[to]] = [order[to], order[from]];
  const output = await PDFDocument.create();
  const pages = await output.copyPages(sourceDoc, order);
  pages.forEach((page) => output.addPage(page));
  return output.save({ useObjectStreams: true });
}

export async function extractPdfPage(source: Uint8Array, pageNumber: number): Promise<Uint8Array> {
  const sourceDoc = await PDFDocument.load(source.slice());
  const output = await PDFDocument.create();
  const [page] = await output.copyPages(sourceDoc, [pageNumber - 1]);
  output.addPage(page);
  return output.save({ useObjectStreams: true });
}

export async function listFormFields(source: Uint8Array): Promise<PdfFormField[]> {
  const doc = await PDFDocument.load(source.slice());
  return doc.getForm().getFields().map((field) => {
    if (field instanceof PDFTextField) return { name: field.getName(), type: 'text', value: field.getText() || '' };
    if (field instanceof PDFCheckBox) return { name: field.getName(), type: 'checkbox', value: field.isChecked() ? 'true' : 'false' };
    if (field instanceof PDFDropdown) return { name: field.getName(), type: 'dropdown', value: field.getSelected()[0] || '', options: field.getOptions() };
    if (field instanceof PDFRadioGroup) return { name: field.getName(), type: 'radio', value: field.getSelected() || '', options: field.getOptions() };
    return { name: field.getName(), type: 'unsupported', value: '' };
  });
}

export async function setFormFieldValue(source: Uint8Array, name: string, value: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(source.slice());
  const field = doc.getForm().getField(name);
  if (field instanceof PDFTextField) field.setText(value);
  else if (field instanceof PDFCheckBox) value === 'true' ? field.check() : field.uncheck();
  else if (field instanceof PDFDropdown) field.select(value);
  else if (field instanceof PDFRadioGroup) field.select(value);
  else throw new Error('This form field type is not editable yet.');
  return doc.save({ useObjectStreams: true });
}

export async function addSearchableOcrLayer(
  source: Uint8Array,
  pageNumber: number,
  words: OcrWord[],
  imageWidth: number,
  imageHeight: number
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(source.slice());
  const page = doc.getPage(pageNumber - 1);
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const word of words.filter((item) => item.text.trim() && item.confidence >= 35)) {
    const boxHeight = Math.max(1, word.bbox.y1 - word.bbox.y0);
    const size = Math.max(3, boxHeight * (height / imageHeight) * .82);
    page.drawText(word.text, {
      x: word.bbox.x0 * (width / imageWidth),
      y: height - word.bbox.y1 * (height / imageHeight),
      size,
      font,
      opacity: 0
    });
  }
  return doc.save({ useObjectStreams: true });
}

async function renderPixels(bytes: Uint8Array, pageNumber: number, scale: number) {
  const doc = await loadPdf(bytes);
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d', { alpha: false })!;
  await page.render({ canvasContext: context, viewport }).promise;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  await doc.destroy();
  return { pixels, width: canvas.width, height: canvas.height, viewport };
}

export async function validateTextEdit(
  before: Uint8Array,
  after: Uint8Array,
  pageNumber: number,
  run: TextRun
): Promise<FidelityResult> {
  const scale = 1.4;
  const [a, b] = await Promise.all([
    renderPixels(before.slice(), pageNumber, scale),
    renderPixels(after.slice(), pageNumber, scale)
  ]);
  const [x1, baseline] = a.viewport.convertToViewportPoint(run.pdfX, run.pdfY);
  const left = Math.max(0, Math.floor(x1 - 5));
  const top = Math.max(0, Math.floor(baseline - run.pdfHeight * scale * 1.5 - 5));
  const right = Math.min(a.width, Math.ceil(x1 + Math.max(run.pdfWidth * scale, 220) + 8));
  const bottom = Math.min(a.height, Math.ceil(baseline + run.fontSize * scale * 0.45 + 5));
  let changedOutsidePixels = 0;
  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) {
      if (x >= left && x <= right && y >= top && y <= bottom) continue;
      const index = (y * a.width + x) * 4;
      const delta = Math.abs(a.pixels[index] - b.pixels[index])
        + Math.abs(a.pixels[index + 1] - b.pixels[index + 1])
        + Math.abs(a.pixels[index + 2] - b.pixels[index + 2]);
      if (delta > 48) changedOutsidePixels += 1;
    }
  }
  if (changedOutsidePixels === 0) {
    return { status: 'pass', changedOutsidePixels, message: 'No visual changes detected outside the edited region.' };
  }
  if (changedOutsidePixels < 24) {
    return { status: 'warning', changedOutsidePixels, message: 'A few pixels changed outside the edit region. Review before saving.' };
  }
  return { status: 'fail', changedOutsidePixels, message: 'Unexpected page changes detected. Export is blocked.' };
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}
