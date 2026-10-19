const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { autoUpdater } = require('electron-updater');
const { createWorker } = require('tesseract.js');
const english = require('@tesseract.js-data/eng');
const { chooseDetectedLanguage } = require('./language-detection.cjs');

let mainWindow = null;
const ocrWorkers = new Map();
const OCR_LANGUAGES = [
  ['eng', 'English'], ['spa', 'Spanish'], ['fra', 'French'], ['deu', 'German'],
  ['ita', 'Italian'], ['por', 'Portuguese'], ['nld', 'Dutch'], ['tur', 'Turkish'],
  ['pol', 'Polish'], ['rus', 'Russian'], ['ukr', 'Ukrainian'], ['ara', 'Arabic'],
  ['urd', 'Urdu'], ['hin', 'Hindi'], ['ben', 'Bengali'], ['chi_sim', 'Chinese (Simplified)'],
  ['jpn', 'Japanese'], ['kor', 'Korean']
].map(([code, name]) => ({ code, name }));
const OCR_LANGUAGE_CODES = new Set(OCR_LANGUAGES.map((language) => language.code));
const FRANC_TO_TESSERACT = {
  eng: 'eng', spa: 'spa', fra: 'fra', deu: 'deu', ita: 'ita', por: 'por', nld: 'nld',
  tur: 'tur', pol: 'pol', rus: 'rus', ukr: 'ukr', arb: 'ara', urd: 'urd', hin: 'hin',
  ben: 'ben', cmn: 'chi_sim', jpn: 'jpn', kor: 'kor'
};
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function bytesForRenderer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function sendUpdateState(state) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updates:state', state);
  }
  return state;
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.on('checking-for-update', () => sendUpdateState({ status: 'checking' }));
autoUpdater.on('update-available', (info) => sendUpdateState({ status: 'available', version: info.version }));
autoUpdater.on('update-not-available', () => sendUpdateState({ status: 'current', version: app.getVersion() }));
autoUpdater.on('download-progress', (progress) => sendUpdateState({ status: 'downloading', percent: Math.round(progress.percent) }));
autoUpdater.on('update-downloaded', (info) => sendUpdateState({ status: 'ready', version: info.version }));
autoUpdater.on('error', (error) => sendUpdateState({ status: 'error', message: error.message }));

async function fontVaultDirectory() {
  const directory = path.join(app.getPath('userData'), 'font-vault');
  await fs.mkdir(directory, { recursive: true });
  return directory;
}

async function recoveryDirectory() {
  const directory = path.join(app.getPath('userData'), 'recovery');
  await fs.mkdir(directory, { recursive: true });
  return directory;
}

async function ocrModelsDirectory() {
  const directory = path.join(app.getPath('userData'), 'ocr-models');
  await fs.mkdir(directory, { recursive: true });
  return directory;
}

function sendOcrProgress(state) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ocr:progress', state);
}

async function fileExists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function ensureOcrLanguage(language) {
  if (!OCR_LANGUAGE_CODES.has(language)) throw new Error('This OCR language is not supported by this build.');
  const directory = await ocrModelsDirectory();
  const destination = path.join(directory, `${language}.traineddata.gz`);
  if (await fileExists(destination)) return { directory, downloaded: false };
  const temporary = `${destination}.download`;
  try {
    if (language === 'eng') {
      const packageRoot = path.dirname(english.langPath);
      const source = path.join(packageRoot, '4.0.0_best_int', 'eng.traineddata.gz');
      await fs.copyFile(app.isPackaged ? source.replace('app.asar', 'app.asar.unpacked') : source, temporary);
    } else {
      const url = `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${language}@1.0.0/4.0.0_best_int/${language}.traineddata.gz`;
      sendOcrProgress({ status: 'downloading-language', progress: 0, language });
      const response = await fetch(url, { redirect: 'error' });
      if (!response.ok || !response.body) throw new Error(`Could not download the ${language} OCR pack (${response.status}).`);
      const expectedLength = Number(response.headers.get('content-length') || 0);
      if (expectedLength > 40 * 1024 * 1024) throw new Error('The OCR language pack exceeded the safe download limit.');
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > 40 * 1024 * 1024) throw new Error('The OCR language pack exceeded the safe download limit.');
        chunks.push(Buffer.from(value));
        sendOcrProgress({ status: 'downloading-language', progress: expectedLength ? received / expectedLength : 0, language });
      }
      const archive = Buffer.concat(chunks);
      if (archive.length < 100000 || archive[0] !== 0x1f || archive[1] !== 0x8b) throw new Error('The downloaded OCR language pack was invalid.');
      await fs.writeFile(temporary, archive);
    }
    await fs.rename(temporary, destination);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
  return { directory, downloaded: true };
}

async function getOcrWorker(language) {
  if (!ocrWorkers.has(language)) {
    const { directory, downloaded } = await ensureOcrLanguage(language);
    const bundledWorkerPath = path.join(path.dirname(require.resolve('tesseract.js')), 'worker-script', 'node', 'index.js');
    const workerPath = app.isPackaged ? bundledWorkerPath.replace('app.asar', 'app.asar.unpacked') : bundledWorkerPath;
    const cachePath = path.join(app.getPath('userData'), 'ocr-cache');
    await fs.mkdir(cachePath, { recursive: true });
    const promise = createWorker(language, undefined, {
      langPath: directory,
      workerPath,
      cachePath,
      gzip: true,
      logger: sendOcrProgress
    }).catch((error) => {
      ocrWorkers.delete(language);
      throw error;
    });
    ocrWorkers.set(language, { promise, downloaded });
  }
  const entry = ocrWorkers.get(language);
  return { worker: await entry.promise, downloaded: entry.downloaded };
}

function safeFontId(name) {
  const stem = path.basename(name, path.extname(name)).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'font';
  return `${stem}-${Date.now()}${path.extname(name).toLowerCase()}`;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#F4F7F5',
    title: 'PrivateParse',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#FFFFFF',
      symbolColor: '#102331',
      height: 72
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.setMenuBarVisibility(false);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  mainWindow = win;
  win.on('closed', () => { mainWindow = null; });
}

ipcMain.handle('file:open-pdf', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PDF documents', extensions: ['pdf'] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const data = await fs.readFile(filePath);
  return { name: path.basename(filePath), path: filePath, data: bytesForRenderer(data) };
});

ipcMain.handle('file:open-pdfs', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'PDF documents', extensions: ['pdf'] }]
  });
  if (result.canceled) return [];
  return Promise.all(result.filePaths.map(async (filePath) => ({
    name: path.basename(filePath), path: filePath, data: bytesForRenderer(await fs.readFile(filePath))
  })));
});

ipcMain.handle('file:open-sample', async () => {
  const filePath = path.join(app.getAppPath(), 'test-fixtures', 'sample-invoice.pdf');
  const data = await fs.readFile(filePath);
  return { name: 'sample-invoice.pdf', path: filePath, data: bytesForRenderer(data) };
});

ipcMain.handle('file:open-image', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Signature image', extensions: ['png', 'jpg', 'jpeg'] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const data = await fs.readFile(filePath);
  return { name: path.basename(filePath), extension: path.extname(filePath).toLowerCase(), data: bytesForRenderer(data) };
});

ipcMain.handle('file:open-font', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'OpenType font', extensions: ['ttf', 'otf'] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const data = await fs.readFile(filePath);
  return { name: path.basename(filePath), data: bytesForRenderer(data) };
});

ipcMain.handle('font:vault-import', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'OpenType font', extensions: ['ttf', 'otf'] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const source = result.filePaths[0];
  const directory = await fontVaultDirectory();
  const id = safeFontId(source);
  const destination = path.join(directory, id);
  await fs.copyFile(source, destination);
  const data = await fs.readFile(destination);
  return { id, name: path.basename(source), data: bytesForRenderer(data) };
});

ipcMain.handle('font:vault-list', async () => {
  const directory = await fontVaultDirectory();
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && /\.(ttf|otf)$/i.test(entry.name))
    .map((entry) => ({ id: entry.name, name: entry.name.replace(/-\d+(?=\.(ttf|otf)$)/i, '') }));
});

ipcMain.handle('font:vault-read', async (_event, id) => {
  if (typeof id !== 'string' || path.basename(id) !== id || !/\.(ttf|otf)$/i.test(id)) return null;
  const filePath = path.join(await fontVaultDirectory(), id);
  const data = await fs.readFile(filePath);
  return { id, name: id.replace(/-\d+(?=\.(ttf|otf)$)/i, ''), data: bytesForRenderer(data) };
});

ipcMain.handle('file:save', async (_event, payload) => {
  const result = await dialog.showSaveDialog({
    defaultPath: payload.defaultName,
    filters: payload.kind === 'csv'
      ? [{ name: 'CSV file', extensions: ['csv'] }]
      : [{ name: 'PDF document', extensions: ['pdf'] }]
  });
  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, Buffer.from(payload.data));
  return result.filePath;
});

ipcMain.handle('recovery:save', async (_event, payload) => {
  const directory = await recoveryDirectory();
  await fs.writeFile(path.join(directory, 'latest.pdf'), Buffer.from(payload.data));
  await fs.writeFile(path.join(directory, 'latest.json'), JSON.stringify({ name: payload.name, savedAt: new Date().toISOString() }), 'utf8');
  return true;
});

ipcMain.handle('recovery:info', async () => {
  try {
    return JSON.parse(await fs.readFile(path.join(await recoveryDirectory(), 'latest.json'), 'utf8'));
  } catch { return null; }
});

ipcMain.handle('recovery:load', async () => {
  try {
    const directory = await recoveryDirectory();
    const [data, meta] = await Promise.all([
      fs.readFile(path.join(directory, 'latest.pdf')),
      fs.readFile(path.join(directory, 'latest.json'), 'utf8').then(JSON.parse)
    ]);
    return { ...meta, data: bytesForRenderer(data) };
  } catch { return null; }
});

ipcMain.handle('recovery:clear', async () => {
  const directory = await recoveryDirectory();
  await Promise.all(['latest.pdf', 'latest.json'].map((name) => fs.rm(path.join(directory, name), { force: true })));
  return true;
});

async function recognizeWithLanguage(data, language) {
  const { worker, downloaded } = await getOcrWorker(language);
  const result = await worker.recognize(Buffer.from(data), {}, { text: true, blocks: true });
  const words = (result.data.blocks || []).flatMap((block) => block.paragraphs)
    .flatMap((paragraph) => paragraph.lines).flatMap((line) => line.words)
    .map((word) => ({ text: word.text, confidence: word.confidence, bbox: word.bbox }));
  return { text: result.data.text, confidence: result.data.confidence, words, language, downloaded };
}

ipcMain.handle('ocr:languages', async () => {
  const modelDirectory = await ocrModelsDirectory();
  const cacheDirectory = path.join(app.getPath('userData'), 'ocr-cache');
  return Promise.all(OCR_LANGUAGES.map(async (language) => ({
    ...language,
    installed: language.code === 'eng'
      || await fileExists(path.join(modelDirectory, `${language.code}.traineddata.gz`))
      || await fileExists(path.join(cacheDirectory, `${language.code}.traineddata`))
  })));
});

ipcMain.handle('ocr:recognize', async (_event, payload) => {
  const data = payload?.data || payload;
  const requestedLanguage = payload?.language || 'auto';
  if (requestedLanguage !== 'auto') return recognizeWithLanguage(data, requestedLanguage);
  sendOcrProgress({ status: 'detecting-language', progress: 0 });
  const preliminary = await recognizeWithLanguage(data, 'eng');
  const { francAll } = await import('franc-min');
  const ranked = francAll(preliminary.text, { minLength: 20, only: Object.keys(FRANC_TO_TESSERACT) });
  const detection = chooseDetectedLanguage(ranked, FRANC_TO_TESSERACT);
  const detectionConfident = detection.confident;
  const detectedIso = detection.iso;
  const detectedLanguage = detection.language;
  if (detectedLanguage === 'eng') return { ...preliminary, detectedLanguage, detectedIso, detectionConfident };
  const recognized = await recognizeWithLanguage(data, detectedLanguage);
  return { ...recognized, detectedLanguage, detectedIso, detectionConfident };
});

ipcMain.handle('app:info', () => ({ version: app.getVersion(), packaged: app.isPackaged }));

ipcMain.handle('updates:check', async () => {
  if (!app.isPackaged) return sendUpdateState({ status: 'development', version: app.getVersion(), message: 'Updates are enabled in installed builds.' });
  sendUpdateState({ status: 'checking' });
  try {
    await autoUpdater.checkForUpdates();
    return { status: 'checking' };
  } catch (error) {
    return sendUpdateState({ status: 'error', message: error.message });
  }
});

ipcMain.handle('updates:download', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { status: 'downloading' };
  } catch (error) {
    return sendUpdateState({ status: 'error', message: error.message });
  }
});

ipcMain.handle('updates:install', () => {
  autoUpdater.quitAndInstall(false, true);
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  for (const entry of ocrWorkers.values()) entry.promise.then((worker) => worker.terminate()).catch(() => {});
});
