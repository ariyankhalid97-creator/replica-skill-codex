import { useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  BadgeCheck, CheckCircle2, ChevronLeft, ChevronRight, CloudDownload, Download,
  FilePenLine, FileSearch, FolderOpen, Grid3X3, LibraryBig, LockKeyhole,
  PenLine, RefreshCw, RotateCcw, Save, ShieldCheck, Sparkles, Type, Upload,
  X, ZoomIn, ZoomOut, ScanText, Files, Undo2, Redo2, RotateCw, Trash2,
  Copy, ArrowUp, ArrowDown, FormInput, DownloadCloud, History
} from 'lucide-react';
import {
  addSearchableOcrLayer, applySignature, applyTextEdit, bytesToDataUrl, dataUrlToBytes,
  deletePdfPage, duplicatePdfPage, extractPdfPage, extractTable, listFormFields,
  loadPdf, movePdfPage, renderPage, rotatePdfPage, rowsToCsv, setFormFieldValue,
  validateTextEdit, type FidelityResult, type FontChoice, type PdfFormField, type TextRun
} from './lib/pdf';
import logoUrl from './assets/privateparse-logo.png';

type Tool = 'viewer' | 'pages' | 'edit' | 'ocr' | 'extract' | 'forms' | 'sign';

interface SavedSignature {
  id: string;
  name: string;
  dataUrl: string;
  type: 'png' | 'jpg';
}

const SAVED_SIGNATURES_KEY = 'privateparse-signatures';

function getSavedSignatures(): SavedSignature[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_SIGNATURES_KEY) || '[]') as SavedSignature[];
  } catch {
    return [];
  }
}

function downloadInBrowser(name: string, bytes: Uint8Array, type: string) {
  const blob = new Blob([bytes.slice().buffer], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function SignaturePad({ onUse }: { onUse: (dataUrl: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = 560 * ratio;
    canvas.height = 220 * ratio;
    canvas.style.width = '100%';
    canvas.style.height = '110px';
    const context = canvas.getContext('2d')!;
    context.scale(ratio, ratio);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#17211f';
    context.lineWidth = 2.4;
  }, []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (560 / rect.width), y: (event.clientY - rect.top) * (110 / rect.height) };
  };

  const clear = () => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext('2d')!;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
  };

  return (
    <div className="signature-pad-wrap">
      <canvas
        ref={ref}
        className="signature-pad"
        aria-label="Draw your signature"
        onPointerDown={(event) => {
          drawing.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          const context = event.currentTarget.getContext('2d')!;
          const p = point(event);
          context.beginPath();
          context.moveTo(p.x, p.y);
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const context = event.currentTarget.getContext('2d')!;
          const p = point(event);
          context.lineTo(p.x, p.y);
          context.stroke();
        }}
        onPointerUp={() => { drawing.current = false; }}
      />
      <div className="row gap-sm">
        <button className="button ghost small" onClick={clear}><RotateCcw size={15} /> Clear</button>
        <button className="button secondary small" onClick={() => ref.current && onUse(ref.current.toDataURL('image/png'))}>
          Use drawing
        </button>
      </div>
    </div>
  );
}

function PageThumbnail({ doc, page, active, onSelect }: { doc: PDFDocumentProxy; page: number; active: boolean; onSelect: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let canceled = false;
    doc.getPage(page).then(async (pdfPage) => {
      if (canceled || !ref.current) return;
      const viewport = pdfPage.getViewport({ scale: .18 });
      ref.current.width = Math.ceil(viewport.width);
      ref.current.height = Math.ceil(viewport.height);
      await pdfPage.render({ canvasContext: ref.current.getContext('2d')!, viewport }).promise;
    }).catch(() => {});
    return () => { canceled = true; };
  }, [doc, page]);
  return <button className={`page-thumb ${active ? 'active' : ''}`} onClick={onSelect} aria-label={`Go to page ${page}`}><canvas ref={ref} /><span>{page}</span></button>;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const undoStack = useRef<Uint8Array[]>([]);
  const redoStack = useRef<Uint8Array[]>([]);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [originalBytes, setOriginalBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [runs, setRuns] = useState<TextRun[]>([]);
  const [selected, setSelected] = useState<TextRun | null>(null);
  const [tool, setTool] = useState<Tool>('viewer');
  const [editText, setEditText] = useState('');
  const [alignment, setAlignment] = useState<TextRun['alignment']>('left');
  const [fontChoice, setFontChoice] = useState<FontChoice | undefined>();
  const [fontOrigin, setFontOrigin] = useState<'captured' | 'vault' | 'one-time' | 'standard' | 'missing'>('missing');
  const [capturedFonts, setCapturedFonts] = useState<Record<string, FontChoice>>({});
  const [vaultFonts, setVaultFonts] = useState<Array<{ id: string; name: string }>>([]);
  const [fidelity, setFidelity] = useState<FidelityResult | null>(null);
  const [status, setStatus] = useState('Open a PDF to begin. Nothing is uploaded.');
  const [busy, setBusy] = useState(false);
  const [tableRows, setTableRows] = useState<string[][]>([]);
  const [appVersion, setAppVersion] = useState('0.3.1');
  const [updateState, setUpdateState] = useState<UpdateState>({ status: 'idle' });
  const [showUpdates, setShowUpdates] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const [signatureType, setSignatureType] = useState<'png' | 'jpg'>('png');
  const [signatureX, setSignatureX] = useState(68);
  const [signatureY, setSignatureY] = useState(78);
  const [saveSignature, setSaveSignature] = useState(false);
  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>(() => getSavedSignatures());
  const [historyVersion, setHistoryVersion] = useState(0);
  const [recoveryInfo, setRecoveryInfo] = useState<{ name: string; savedAt: string } | null>(null);
  const [ocrResult, setOcrResult] = useState<{ text: string; confidence: number; words: OcrWordResult[]; language: string; detectedLanguage?: string; detectionConfident?: boolean; downloaded?: boolean } | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrActivity, setOcrActivity] = useState('');
  const [ocrLanguage, setOcrLanguage] = useState('auto');
  const [ocrLanguages, setOcrLanguages] = useState<OcrLanguage[]>([]);
  const [formFields, setFormFields] = useState<PdfFormField[]>([]);

  useEffect(() => {
    if (!window.privateParse) return;
    window.privateParse.appInfo().then((info) => setAppVersion(info.version));
    window.privateParse.listVaultFonts().then(setVaultFonts).catch(() => setVaultFonts([]));
    window.privateParse.getRecoveryInfo().then(setRecoveryInfo).catch(() => setRecoveryInfo(null));
    window.privateParse.listOcrLanguages().then(setOcrLanguages).catch(() => setOcrLanguages([]));
    const stopUpdates = window.privateParse.onUpdateState(setUpdateState);
    const stopOcr = window.privateParse.onOcrProgress((state) => {
      setOcrProgress(Math.round(state.progress * 100));
      setOcrActivity(state.status === 'downloading-language' ? 'Downloading language pack' : state.status === 'detecting-language' ? 'Detecting language' : 'Recognizing');
    });
    return () => { stopUpdates(); stopOcr(); };
  }, []);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let canceled = false;
    setStatus('Rendering locally…');
    pdfDoc.getPage(pageNumber).then((page) => renderPage(page, canvasRef.current!, scale)).then((result) => {
      if (canceled) return;
      setRuns(result.runs);
      setCapturedFonts(result.capturedFonts);
      setCanvasSize({ width: result.width, height: result.height });
      setSelected(null);
      setEditText('');
      setFidelity(null);
      setFontChoice(undefined);
      setFontOrigin('missing');
      setStatus(`${result.runs.length} text objects found on page ${pageNumber}.`);
    }).catch((error: Error) => setStatus(`Could not render this page: ${error.message}`));
    return () => { canceled = true; };
  }, [pdfDoc, pageNumber, scale]);

  const replaceDocument = async (bytes: Uint8Array, message: string, nextPage = pageNumber) => {
    const doc = await loadPdf(bytes.slice());
    if (pdfDoc) await pdfDoc.destroy();
    setPdfBytes(bytes.slice());
    setPdfDoc(doc);
    setPageCount(doc.numPages);
    setPageNumber(Math.max(1, Math.min(nextPage, doc.numPages)));
    setStatus(message);
  };

  const commitDocument = async (edited: Uint8Array, message: string, nextPage = pageNumber) => {
    if (pdfBytes) undoStack.current = [...undoStack.current.slice(-9), pdfBytes.slice()];
    redoStack.current = [];
    await replaceDocument(edited, message, nextPage);
    setHistoryVersion((value) => value + 1);
    if (window.privateParse) await window.privateParse.saveRecovery({ name: fileName, data: edited.slice().buffer });
  };

  const openBytes = async (bytes: Uint8Array, name: string, recovered = false) => {
    setBusy(true);
    try {
      if (pdfDoc) await pdfDoc.destroy();
      const source = bytes.slice();
      const doc = await loadPdf(source);
      setPdfBytes(bytes.slice());
      setOriginalBytes(bytes.slice());
      setPdfDoc(doc);
      setFileName(name);
      setPageNumber(1);
      setPageCount(doc.numPages);
      setTool('viewer');
      setTableRows([]);
      undoStack.current = [];
      redoStack.current = [];
      setHistoryVersion((value) => value + 1);
      setStatus(recovered ? `Recovered ${name} from the local safety copy.` : `Opened ${name} locally.`);
    } catch (error) {
      setStatus(`Unable to open PDF: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    if (!pdfBytes || !undoStack.current.length) return;
    const previous = undoStack.current.pop()!;
    redoStack.current.push(pdfBytes.slice());
    await replaceDocument(previous, 'Undid the last document change.');
    setHistoryVersion((value) => value + 1);
  };

  const redo = async () => {
    if (!pdfBytes || !redoStack.current.length) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(pdfBytes.slice());
    await replaceDocument(next, 'Redid the document change.');
    setHistoryVersion((value) => value + 1);
  };

  const restoreRecovery = async () => {
    const recovered = await window.privateParse?.loadRecovery();
    if (recovered) await openBytes(new Uint8Array(recovered.data), recovered.name, true);
  };

  const openPdf = async () => {
    if (window.privateParse) {
      const file = await window.privateParse.openPdf();
      if (file) await openBytes(new Uint8Array(file.data), file.name);
    } else {
      fileInputRef.current?.click();
    }
  };

  const openSample = async () => {
    if (!window.privateParse?.openSample) {
      setStatus('The built-in sample is available in the packaged desktop app.');
      return;
    }
    setBusy(true);
    setStatus('Opening the built-in sample locally…');
    try {
      const file = await window.privateParse.openSample();
      await openBytes(new Uint8Array(file.data), file.name);
    } catch (error) {
      setStatus(`Unable to open the sample: ${(error as Error).message}`);
      setBusy(false);
    }
  };

  const chooseTool = (next: Tool) => {
    setTool(next);
    setFidelity(null);
    if (next === 'extract' && pdfBytes) runExtraction();
    if (next === 'forms' && pdfBytes) {
      listFormFields(pdfBytes).then(setFormFields).catch(() => setFormFields([]));
    }
  };

  const runExtraction = () => {
    if (!pdfBytes) return;
    const table = extractTable(runs);
    setTableRows(table);
    if (table.length) {
      setStatus(`Found ${table.length} possible table rows. Review before export.`);
    } else {
      setStatus('No multi-column rows found. Try another page or a cleaner table.');
    }
  };

  const runBatchExtraction = async () => {
    if (!window.privateParse) return;
    const files = await window.privateParse.openPdfs();
    if (!files.length) return;
    setBusy(true);
    setStatus(`Extracting first-page tables from ${files.length} PDFs locally…`);
    const combined: string[][] = [];
    try {
      for (const file of files) {
        const doc = await loadPdf(new Uint8Array(file.data));
        const page = await doc.getPage(1);
        const canvas = document.createElement('canvas');
        const result = await renderPage(page, canvas, 1);
        combined.push([`Source: ${file.name}`], ...extractTable(result.runs), []);
        await doc.destroy();
      }
      setTableRows(combined);
      setStatus(`Batch review ready: ${files.length} files processed without uploading.`);
    } catch (error) { setStatus(`Batch extraction stopped: ${(error as Error).message}`); }
    finally { setBusy(false); }
  };

  const applyEdit = async () => {
    if (!pdfBytes || !selected || !editText.trim()) return;
    setBusy(true);
    setStatus('Applying edit and comparing the page…');
    try {
      const before = pdfBytes.slice();
      const edited = await applyTextEdit(before, pageNumber, selected, editText, alignment, fontChoice);
      const check = await validateTextEdit(before, edited, pageNumber, selected);
      setFidelity(check);
      if (check.status === 'fail') {
        setStatus('Edit blocked: unexpected changes appeared outside the selected region.');
        return;
      }
      await commitDocument(edited, check.status === 'pass' ? 'Edit applied. Outside-region fidelity check passed.' : check.message);
    } catch (error) {
      setStatus(`Edit failed safely; the current document is unchanged. ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const importFont = async () => {
    if (!window.privateParse) return;
    const file = await window.privateParse.openFont();
    if (file) {
      setFontChoice({ name: file.name, bytes: new Uint8Array(file.data) });
      setFontOrigin('one-time');
      setStatus(`Loaded ${file.name}. Confirm it matches the document font before applying.`);
    }
  };

  const importVaultFont = async () => {
    if (!window.privateParse) return;
    const file = await window.privateParse.importVaultFont();
    if (!file) return;
    setFontChoice({ name: file.name, bytes: new Uint8Array(file.data) });
    setFontOrigin('vault');
    setVaultFonts(await window.privateParse.listVaultFonts());
    setStatus(`${file.name} is available in your private Font Vault.`);
  };

  const useVaultFont = async (id: string) => {
    if (!window.privateParse) return;
    const file = await window.privateParse.readVaultFont(id);
    if (!file) return;
    setFontChoice({ name: file.name, bytes: new Uint8Array(file.data) });
    setFontOrigin('vault');
    setStatus(`Using ${file.name} from Font Vault for this edit.`);
  };

  const selectTextRun = (run: TextRun) => {
    setSelected(run);
    setEditText(run.text);
    setAlignment(run.alignment);
    setFidelity(null);
    const captured = capturedFonts[run.fontName];
    if (captured) {
      setFontChoice(captured);
      setFontOrigin('captured');
      setStatus(`Captured ${captured.name} from this document for an exact local edit path.`);
    } else if (run.fontSource === 'standard') {
      setFontChoice(undefined);
      setFontOrigin('standard');
      setStatus(`${run.fontFamily} maps to a built-in PDF font.`);
    } else {
      setFontChoice(undefined);
      setFontOrigin('missing');
      setStatus('The document font could not be captured. Choose a matching local font before editing.');
    }
  };

  const checkForUpdates = async () => {
    if (!window.privateParse) return;
    setShowUpdates(true);
    setUpdateState(await window.privateParse.checkForUpdates());
  };

  const importSignature = async () => {
    if (!window.privateParse) return;
    const file = await window.privateParse.openSignatureImage();
    if (!file) return;
    const type = file.extension === '.png' ? 'png' : 'jpg';
    setSignatureType(type);
    setSignatureDataUrl(bytesToDataUrl(new Uint8Array(file.data), type === 'png' ? 'image/png' : 'image/jpeg'));
  };

  const placeSignature = async () => {
    if (!pdfBytes || !signatureDataUrl) return;
    setBusy(true);
    try {
      const imageBytes = dataUrlToBytes(signatureDataUrl);
      const edited = await applySignature(pdfBytes, pageNumber, imageBytes, signatureType, signatureX, signatureY);
      await commitDocument(edited, 'Signature placed locally. Save a copy when ready.');
      if (saveSignature) {
        const next = [...savedSignatures.filter((signature) => signature.dataUrl !== signatureDataUrl), {
          id: crypto.randomUUID(), name: `Signature ${savedSignatures.length + 1}`, dataUrl: signatureDataUrl, type: signatureType
        }];
        setSavedSignatures(next);
        localStorage.setItem(SAVED_SIGNATURES_KEY, JSON.stringify(next));
      }
    } catch (error) {
      setStatus(`Signature placement failed safely: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const changePageStructure = async (action: 'rotate' | 'delete' | 'duplicate' | 'up' | 'down') => {
    if (!pdfBytes) return;
    setBusy(true);
    try {
      const edited = action === 'rotate' ? await rotatePdfPage(pdfBytes, pageNumber)
        : action === 'delete' ? await deletePdfPage(pdfBytes, pageNumber)
          : action === 'duplicate' ? await duplicatePdfPage(pdfBytes, pageNumber)
            : await movePdfPage(pdfBytes, pageNumber, action === 'up' ? -1 : 1);
      const target = action === 'delete' ? Math.min(pageNumber, pageCount - 1)
        : action === 'duplicate' ? pageNumber + 1
          : action === 'up' ? Math.max(1, pageNumber - 1)
            : action === 'down' ? Math.min(pageCount, pageNumber + 1) : pageNumber;
      await commitDocument(edited, `Page ${action} completed locally.`, target);
    } catch (error) {
      setStatus(`Page operation stopped safely: ${(error as Error).message}`);
    } finally { setBusy(false); }
  };

  const extractCurrentPage = async () => {
    if (!pdfBytes) return;
    const bytes = await extractPdfPage(pdfBytes, pageNumber);
    const name = fileName.replace(/\.pdf$/i, '') + `-page-${pageNumber}.pdf`;
    if (window.privateParse) await window.privateParse.saveFile({ defaultName: name, kind: 'pdf', data: bytes.slice().buffer });
    else downloadInBrowser(name, bytes, 'application/pdf');
    setStatus(`Prepared page ${pageNumber} as a separate PDF.`);
  };

  const runOcr = async () => {
    if (!pdfBytes || !canvasRef.current || !window.privateParse) return;
    setBusy(true);
    setOcrProgress(0);
    setStatus('Running private on-device OCR…');
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvasRef.current!.toBlob((value) => value ? resolve(value) : reject(new Error('Could not capture page')), 'image/png'));
      const result = await window.privateParse.recognizeImage(await blob.arrayBuffer(), ocrLanguage);
      setOcrResult(result);
      setOcrLanguages(await window.privateParse.listOcrLanguages());
      const languageName = ocrLanguages.find((language) => language.code === result.language)?.name || result.language;
      const detectionMessage = ocrLanguage !== 'auto' ? '' : result.detectionConfident ? `Detected ${languageName}. ` : 'Language was ambiguous, so English was used; select a language manually if needed. ';
      setStatus(`${detectionMessage}OCR found ${result.words.length} words with ${result.confidence.toFixed(0)}% page confidence.${result.downloaded ? ' The language pack is now stored offline.' : ''}`);
    } catch (error) { setStatus(`OCR failed locally: ${(error as Error).message}`); }
    finally { setBusy(false); setOcrActivity(''); }
  };

  const applyOcrLayer = async () => {
    if (!pdfBytes || !ocrResult || !canvasRef.current) return;
    setBusy(true);
    try {
      const edited = await addSearchableOcrLayer(pdfBytes, pageNumber, ocrResult.words, canvasRef.current.width, canvasRef.current.height);
      await commitDocument(edited, 'Searchable OCR layer added without altering the scanned page image.');
    } catch (error) { setStatus(`OCR layer was not applied: ${(error as Error).message}`); }
    finally { setBusy(false); }
  };

  const updateFormField = async (field: PdfFormField, value: string) => {
    if (!pdfBytes) return;
    setBusy(true);
    try {
      const edited = await setFormFieldValue(pdfBytes, field.name, value);
      await commitDocument(edited, `Updated form field “${field.name}”.`);
      setFormFields(await listFormFields(edited));
    } catch (error) { setStatus(`Form field was not changed: ${(error as Error).message}`); }
    finally { setBusy(false); }
  };

  const savePdf = async () => {
    if (!pdfBytes) return;
    const defaultName = fileName.replace(/\.pdf$/i, '') + '-privateparse.pdf';
    if (window.privateParse) {
      const saved = await window.privateParse.saveFile({ defaultName, kind: 'pdf', data: pdfBytes.slice().buffer });
      if (saved) {
        await window.privateParse.clearRecovery();
        setRecoveryInfo(null);
        setStatus(`Saved a new copy to ${saved}`);
      }
    } else downloadInBrowser(defaultName, pdfBytes, 'application/pdf');
  };

  const exportCsv = async () => {
    if (!tableRows.length) return;
    const csv = new TextEncoder().encode(rowsToCsv(tableRows));
    const defaultName = fileName.replace(/\.pdf$/i, '') + '-table.csv';
    if (window.privateParse) {
      const saved = await window.privateParse.saveFile({ defaultName, kind: 'csv', data: csv.buffer });
      if (saved) setStatus(`Exported CSV to ${saved}`);
    } else downloadInBrowser(defaultName, csv, 'text/csv');
  };

  const selectionOverlay = useMemo(() => {
    if (!selected) return null;
    return { left: selected.viewX, top: selected.viewY, width: selected.viewWidth, height: selected.viewHeight };
  }, [selected]);

  return (
    <div className="app" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file?.type === 'application/pdf' || file?.name.toLowerCase().endsWith('.pdf')) {
        file.arrayBuffer().then((data) => openBytes(new Uint8Array(data), file.name));
      }
    }}>
      <input ref={fileInputRef} type="file" accept="application/pdf" hidden onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) file.arrayBuffer().then((data) => openBytes(new Uint8Array(data), file.name));
      }} />

      <header className="header">
        <div className="brand"><img className="brand-logo" src={logoUrl} alt="" /><div><span>PrivateParse</span><small>Precision PDF Workspace</small></div></div>
        <div className="privacy-pill"><ShieldCheck size={16} /><span><strong>Private workspace</strong> Files stay on this device</span></div>
        <div className="header-actions">
          <button className="icon-button" aria-label="Undo" title="Undo" disabled={!pdfBytes || !undoStack.current.length || busy} onClick={undo}><Undo2 size={17} /></button>
          <button className="icon-button" aria-label="Redo" title="Redo" disabled={!pdfBytes || !redoStack.current.length || busy} onClick={redo}><Redo2 size={17} /></button>
          <button className="button ghost update-button" onClick={checkForUpdates}><RefreshCw size={16} /> Updates</button>
          <button className="button secondary" onClick={openPdf}><FolderOpen size={17} /> Open PDF</button>
          <button className="button primary" disabled={!pdfBytes || busy} onClick={savePdf}><Save size={17} /> Save copy</button>
        </div>
      </header>

      <aside className="sidebar">
        <nav aria-label="Document tools">
          <button className={`nav-item ${tool === 'viewer' ? 'active' : ''}`} onClick={() => chooseTool('viewer')}><FileSearch size={19} /><span>Document</span></button>
          <button className={`nav-item ${tool === 'pages' ? 'active' : ''}`} onClick={() => chooseTool('pages')}><Files size={19} /><span>Organize pages</span></button>
          <p className="nav-label">Modify</p>
          <button className={`nav-item ${tool === 'edit' ? 'active' : ''}`} onClick={() => chooseTool('edit')}><FilePenLine size={19} /><span>Precision edit</span></button>
          <button className={`nav-item ${tool === 'ocr' ? 'active' : ''}`} onClick={() => chooseTool('ocr')}><ScanText size={19} /><span>OCR scan</span></button>
          <button className={`nav-item ${tool === 'extract' ? 'active' : ''}`} onClick={() => chooseTool('extract')}><Grid3X3 size={19} /><span>Extract data</span></button>
          <button className={`nav-item ${tool === 'forms' ? 'active' : ''}`} onClick={() => chooseTool('forms')}><FormInput size={19} /><span>Form fields</span></button>
          <button className={`nav-item ${tool === 'sign' ? 'active' : ''}`} onClick={() => chooseTool('sign')}><PenLine size={19} /><span>Fill & sign</span></button>
        </nav>

        <div className="trust-card"><span className="trust-icon"><ShieldCheck size={17} /></span><div><strong>Local processing</strong><p>No document content is sent to a server.</p></div></div>
        <div className="sidebar-footer"><img src={logoUrl} alt="" /><div><strong>PrivateParse Desktop</strong><span>Version {appVersion}</span></div><BadgeCheck size={16} /></div>
      </aside>

      <main className="workspace">
        {!pdfBytes ? (
          <section className="empty-state">
            <div className="hero-logo"><img src={logoUrl} alt="PrivateParse" /></div>
            <p className="eyebrow">Your private PDF workspace</p>
            <h1>Precise edits. Structured data. Zero uploads.</h1>
            <p>Inspect typography before you edit, capture document fonts when available, extract tables, and sign files entirely on this computer.</p>
            <div className="hero-actions"><button className="button primary large" onClick={openPdf}><FolderOpen size={19} /> Open a PDF</button>{window.privateParse && <button className="button secondary large" onClick={openSample}>Explore sample</button>}</div>
            {recoveryInfo && <button className="recovery-card" onClick={restoreRecovery}><History size={18} /><span><strong>Restore unsaved work</strong><small>{recoveryInfo.name} · {new Date(recoveryInfo.savedAt).toLocaleString()}</small></span></button>}
            <div className="assurance-row"><span><ShieldCheck size={15} /> Offline by design</span><span><Type size={15} /> Font-aware editing</span><span><Save size={15} /> Originals protected</span></div>
          </section>
        ) : (
          <>
            <div className="document-toolbar">
              <div className="file-title"><span>{fileName}</span><small>{pageCount} pages</small></div>
              <div className="page-controls">
                <button aria-label="Previous page" className="icon-button" disabled={pageNumber <= 1} onClick={() => setPageNumber((n) => n - 1)}><ChevronLeft size={18} /></button>
                <span>Page <strong>{pageNumber}</strong> of {pageCount}</span>
                <button aria-label="Next page" className="icon-button" disabled={pageNumber >= pageCount} onClick={() => setPageNumber((n) => n + 1)}><ChevronRight size={18} /></button>
              </div>
              <div className="zoom-controls">
                <button aria-label="Zoom out" className="icon-button" onClick={() => setScale((value) => Math.max(.65, value - .15))}><ZoomOut size={18} /></button>
                <span>{Math.round(scale * 100)}%</span>
                <button aria-label="Zoom in" className="icon-button" onClick={() => setScale((value) => Math.min(2.4, value + .15))}><ZoomIn size={18} /></button>
              </div>
            </div>
            <div className="page-filmstrip" aria-label="Page thumbnails">{pdfDoc && Array.from({ length: pageCount }, (_, index) => <PageThumbnail key={`${historyVersion}-${index + 1}`} doc={pdfDoc} page={index + 1} active={pageNumber === index + 1} onSelect={() => setPageNumber(index + 1)} />)}</div>
            <div className="stage-scroll">
              <div className="page-stage" style={{ width: canvasSize.width || undefined, height: canvasSize.height || undefined }}>
                <canvas ref={canvasRef} className="pdf-canvas" />
                {tool === 'edit' && runs.map((run) => (
                  <button
                    key={run.id}
                    className={`text-hitbox ${selected?.id === run.id ? 'selected' : ''}`}
                    style={{ left: run.viewX, top: run.viewY, width: run.viewWidth, height: run.viewHeight }}
                    aria-label={`Edit text: ${run.text}`}
                    title={run.text}
                    onClick={() => selectTextRun(run)}
                  />
                ))}
                {selectionOverlay && <div className="selection-label" style={{ left: selectionOverlay.left, top: Math.max(0, selectionOverlay.top - 25) }}>Selected text</div>}
                {tool === 'sign' && signatureDataUrl && (
                  <img className="signature-preview" src={signatureDataUrl} alt="Signature placement preview" style={{ left: `${signatureX}%`, top: `${signatureY}%` }} />
                )}
              </div>
            </div>
          </>
        )}
        <footer className="statusbar"><span className={busy ? 'pulse' : ''}>{status}</span><span>{busy ? 'Working locally…' : 'Ready'}</span></footer>
      </main>

      <aside className="inspector">
        {tool === 'viewer' && <ViewerInspector changed={Boolean(originalBytes && pdfBytes && undoStack.current.length)} historyVersion={historyVersion} />}
        {tool === 'pages' && (
          <section><p className="eyebrow">Page studio</p><h2>Organize page {pageNumber}</h2><p className="muted">Every structural change can be undone. The original file is never overwritten.</p><div className="action-grid"><button className="button secondary" onClick={() => changePageStructure('rotate')}><RotateCw size={17} /> Rotate 90°</button><button className="button secondary" onClick={() => changePageStructure('duplicate')}><Copy size={17} /> Duplicate</button><button className="button secondary" disabled={pageNumber === 1} onClick={() => changePageStructure('up')}><ArrowUp size={17} /> Move earlier</button><button className="button secondary" disabled={pageNumber === pageCount} onClick={() => changePageStructure('down')}><ArrowDown size={17} /> Move later</button><button className="button secondary" onClick={extractCurrentPage}><DownloadCloud size={17} /> Extract page</button><button className="button danger" disabled={pageCount <= 1} onClick={() => changePageStructure('delete')}><Trash2 size={17} /> Delete page</button></div><div className="safety-card"><ShieldCheck size={17} /><span><strong>Recoverable changes</strong>Use Undo in the title bar before saving.</span></div></section>
        )}
        {tool === 'edit' && (
          <section>
            <p className="eyebrow">Precision text edit</p>
            <h2>{selected ? 'Style detected' : 'Select text on the page'}</h2>
            {!selected ? <p className="muted">Click any highlighted text object. PrivateParse will inspect its typography before allowing an edit.</p> : (
              <>
                <dl className="style-grid">
                  <div><dt>Reported font</dt><dd>{selected.fontFamily}</dd></div>
                  <div><dt>PDF resource</dt><dd className="mono">{selected.fontName}</dd></div>
                  <div><dt>Size</dt><dd>{selected.fontSize.toFixed(1)} pt</dd></div>
                  <div><dt>Style</dt><dd>{selected.weight}{selected.italic ? ' italic' : ''}</dd></div>
                  <div><dt>Alignment</dt><dd>{selected.alignment}</dd></div>
                  <div><dt>Position</dt><dd>{selected.pdfX.toFixed(0)}, {selected.pdfY.toFixed(0)}</dd></div>
                </dl>
                <div className={`match-card ${fontOrigin !== 'missing' ? 'exact' : 'warning'}`}>
                  {fontOrigin !== 'missing' ? <CheckCircle2 size={18} /> : <Sparkles size={18} />}
                  <div><strong>{fontOrigin === 'captured' ? 'Document font captured' : fontOrigin === 'vault' ? 'Font Vault match selected' : fontOrigin === 'one-time' ? 'One-time font selected' : fontOrigin === 'standard' ? 'Built-in PDF font matched' : 'Exact font unavailable'}</strong><span>{fontChoice ? fontChoice.name : fontOrigin === 'standard' ? 'PrivateParse can use a standard PDF font without replacing the page image.' : 'Editing is blocked until you choose a matching TTF/OTF. PrivateParse will not silently substitute a different font.'}</span></div>
                </div>
                <div className="font-actions"><button className="button secondary full" onClick={importFont}><Upload size={16} /> Use once</button><button className="button secondary full" onClick={importVaultFont}><LibraryBig size={16} /> Add to vault</button></div>
                {!!vaultFonts.length && <label className="field"><span>Font Vault</span><select defaultValue="" onChange={(event) => event.target.value && useVaultFont(event.target.value)}><option value="" disabled>Choose a saved font</option>{vaultFonts.map((font) => <option key={font.id} value={font.id}>{font.name}</option>)}</select></label>}
                <label className="field"><span>Replacement text</span><textarea value={editText} onChange={(event) => setEditText(event.target.value)} rows={4} /></label>
                <label className="field"><span>Alignment</span><select value={alignment} onChange={(event) => setAlignment(event.target.value as TextRun['alignment'])}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
                <button className="button primary full" disabled={busy || editText === selected.text || fontOrigin === 'missing'} onClick={applyEdit}>Apply and verify fidelity</button>
                {fidelity && <div className={`fidelity ${fidelity.status}`}><strong>{fidelity.status === 'pass' ? 'Fidelity check passed' : 'Review required'}</strong><span>{fidelity.message}</span><small>{fidelity.changedOutsidePixels} changed pixels outside the edit region</small></div>}
              </>
            )}
          </section>
        )}
        {tool === 'extract' && (
          <section>
            <p className="eyebrow">Table extraction</p>
            <h2>Review before export</h2>
            <p className="muted">PrivateParse groups aligned text into rows and columns. Every value remains editable before export.</p>
            {!tableRows.length ? <div className="empty-panel">No table detected on this page.</div> : (
              <div className="table-wrap">
                <table><tbody>{tableRows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}><input aria-label={`Row ${rowIndex + 1}, column ${cellIndex + 1}`} value={cell} onChange={(event) => setTableRows((rows) => rows.map((existingRow, r) => r === rowIndex ? existingRow.map((value, c) => c === cellIndex ? event.target.value : value) : existingRow))} /></td>)}</tr>)}</tbody></table>
              </div>
            )}
            <div className="stack"><button className="button secondary full" onClick={runExtraction}><RotateCcw size={16} /> Run this page again</button><button className="button secondary full" onClick={runBatchExtraction}><Files size={16} /> Batch first-page extraction</button><button className="button primary full" disabled={!tableRows.length} onClick={exportCsv}><Download size={16} /> Export reviewed CSV</button></div>
          </section>
        )}
        {tool === 'ocr' && (
          <section>
            <p className="eyebrow">Offline OCR</p><h2>Make scans searchable</h2>
            <p className="muted">Choose a language or let PrivateParse detect it. Missing recognition packs are downloaded once, saved privately, and then work offline.</p>
            <label className="field"><span>Document language</span><select value={ocrLanguage} onChange={(event) => { setOcrLanguage(event.target.value); setOcrResult(null); }}><option value="auto">Detect automatically</option>{ocrLanguages.map((language) => <option key={language.code} value={language.code}>{language.name}{language.installed ? ' · ready offline' : ' · downloads on use'}</option>)}</select></label>
            <button className="button primary full" disabled={busy} onClick={runOcr}><ScanText size={17} /> {busy ? `${ocrActivity || 'Recognizing'} ${ocrProgress}%` : 'Detect and recognize page'}</button>
            {ocrResult && <><div className="language-result"><span>Language used</span><strong>{ocrLanguages.find((language) => language.code === ocrResult.language)?.name || ocrResult.language}</strong><small>{ocrLanguage === 'auto' && !ocrResult.detectionConfident ? 'Detection was ambiguous · choose manually if needed' : ocrResult.downloaded ? 'Pack downloaded and ready offline' : 'Local pack used'}</small></div><div className="ocr-score"><strong>{ocrResult.confidence.toFixed(0)}%</strong><span>page confidence · {ocrResult.words.length} words</span></div><label className="field"><span>Recognized text</span><textarea rows={12} value={ocrResult.text} readOnly /></label><button className="button secondary full" onClick={applyOcrLayer}>Add searchable text layer</button></>}
            <p className="privacy-note"><LockKeyhole size={15} /> PDF pages are never uploaded. Auto mode may contact jsDelivr only to retrieve a missing open-source language model.</p>
          </section>
        )}
        {tool === 'forms' && (
          <section><p className="eyebrow">Interactive forms</p><h2>Fill existing PDF fields</h2><p className="muted">Only real AcroForm fields are edited. Flattened scans are routed through OCR instead.</p>{!formFields.length ? <div className="empty-panel">No interactive form fields were found in this PDF.</div> : <div className="form-list">{formFields.map((field) => <label className="field" key={field.name}><span>{field.name}</span>{field.type === 'checkbox' ? <select value={field.value} onChange={(event) => updateFormField(field, event.target.value)}><option value="false">Unchecked</option><option value="true">Checked</option></select> : field.options ? <select value={field.value} onChange={(event) => updateFormField(field, event.target.value)}>{field.options.map((option) => <option key={option}>{option}</option>)}</select> : <input disabled={field.type === 'unsupported'} defaultValue={field.value} onBlur={(event) => event.target.value !== field.value && updateFormField(field, event.target.value)} />}</label>)}</div>}<div className="safety-card"><ShieldCheck size={17} /><span><strong>Honest signing</strong>Visual signatures are clearly labeled. Certificate-based digital signing is not simulated.</span></div></section>
        )}
        {tool === 'sign' && (
          <section>
            <p className="eyebrow">Fill & sign</p>
            <h2>Use an existing signature or create one</h2>
            <SignaturePad onUse={(dataUrl) => { setSignatureDataUrl(dataUrl); setSignatureType('png'); }} />
            <div className="divider"><span>or</span></div>
            <button className="button secondary full" onClick={importSignature}><Upload size={16} /> Import PNG or JPEG</button>
            {!!savedSignatures.length && <div className="saved-signatures"><span>Saved on this device</span>{savedSignatures.map((signature) => <button key={signature.id} onClick={() => { setSignatureDataUrl(signature.dataUrl); setSignatureType(signature.type); }}><img src={signature.dataUrl} alt={signature.name} /><span>{signature.name}</span></button>)}</div>}
            {signatureDataUrl && <>
              <div className="signature-card"><img src={signatureDataUrl} alt="Selected signature" /><span>Preview only · image signature, not certificate signing</span></div>
              <label className="field"><span>Horizontal position</span><input type="range" min="0" max="100" value={signatureX} onChange={(event) => setSignatureX(Number(event.target.value))} /></label>
              <label className="field"><span>Vertical position</span><input type="range" min="0" max="100" value={signatureY} onChange={(event) => setSignatureY(Number(event.target.value))} /></label>
              <label className="check-row"><input type="checkbox" checked={saveSignature} onChange={(event) => setSaveSignature(event.target.checked)} /><span>Save on this device after placing</span></label>
              <p className="privacy-note"><LockKeyhole size={15} /> “Use once” is the default. Saved signatures remain in this app's local storage.</p>
              <button className="button primary full" disabled={busy} onClick={placeSignature}>Place signature</button>
            </>}
          </section>
        )}
      </aside>

      {showUpdates && <UpdateCenter state={updateState} version={appVersion} onClose={() => setShowUpdates(false)} />}
    </div>
  );
}

function UpdateCenter({ state, version, onClose }: { state: UpdateState; version: string; onClose: () => void }) {
  const canDownload = state.status === 'available';
  const canInstall = state.status === 'ready';
  const title = state.status === 'available' ? `PrivateParse ${state.version} is available`
    : state.status === 'ready' ? 'Update ready to install'
      : state.status === 'current' ? 'PrivateParse is up to date'
        : state.status === 'downloading' ? `Downloading update ${state.percent ?? 0}%`
          : state.status === 'error' ? 'Could not check for updates'
            : state.status === 'development' ? 'Update service is ready'
              : 'Checking for updates';
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="update-center" role="dialog" aria-modal="true" aria-labelledby="update-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Close" onClick={onClose}><X size={20} /></button><div className="update-hero"><span><CloudDownload size={24} /></span><div><p className="eyebrow">Product updates</p><h2 id="update-title">{title}</h2></div></div><p>Installed version {version}. Updates are checked against the official PrivateParse release feed and downloaded only when you approve them.</p>{state.status === 'downloading' && <div className="progress"><span style={{ width: `${state.percent ?? 0}%` }} /></div>}{state.message && <div className="update-message">{state.message}</div>}<div className="row gap-sm update-actions">{canDownload && <button className="button primary" onClick={() => window.privateParse?.downloadUpdate()}>Download update</button>}{canInstall && <button className="button primary" onClick={() => window.privateParse?.installUpdate()}>Restart and install</button>}<button className="button secondary" onClick={onClose}>{canDownload || canInstall ? 'Later' : 'Close'}</button></div></section></div>;
}

function ViewerInspector({ changed }: { changed: boolean; historyVersion: number }) {
  return <section><p className="eyebrow">Document workspace</p><h2>Work precisely, keep control</h2><p className="muted">Inspect text, extract structured data, run OCR, organize pages, fill forms, and sign without sending document contents away from this computer.</p>{changed && <div className="change-badge"><History size={16} /><span><strong>Working copy changed</strong>Your original remains untouched. Undo is available.</span></div>}<div className="promise-list"><div><ShieldCheck size={18} /><span><strong>No upload</strong>Document bytes stay local.</span></div><div><Type size={18} /><span><strong>Font-aware edits</strong>Unavailable fonts block unsafe substitution.</span></div><div><ScanText size={18} /><span><strong>On-device OCR</strong>Scans become searchable without a server.</span></div><div><Save size={18} /><span><strong>Save a copy</strong>The original remains untouched.</span></div></div><div className="safety-card"><LockKeyhole size={17} /><span><strong>Security boundary</strong>PrivateParse will not call a white rectangle “redaction” or an image a certificate signature.</span></div></section>;
}

export default App;
