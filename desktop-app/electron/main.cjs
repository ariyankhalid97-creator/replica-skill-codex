const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { autoUpdater } = require('electron-updater');
const { createWorker } = require('tesseract.js');
const english = require('@tesseract.js-data/eng');

let mainWindow = null;
let ocrWorkerPromise = null;
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

async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    const langPath = app.isPackaged ? english.langPath.replace('app.asar', 'app.asar.unpacked') : english.langPath;
    ocrWorkerPromise = createWorker('eng', undefined, {
      langPath,
      gzip: english.gzip,
      logger: (message) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ocr:progress', message);
      }
    }).catch((error) => {
      ocrWorkerPromise = null;
      throw error;
    });
  }
  return ocrWorkerPromise;
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

ipcMain.handle('ocr:recognize', async (_event, data) => {
  const worker = await getOcrWorker();
  const result = await worker.recognize(Buffer.from(data), {}, { text: true, blocks: true });
  const words = (result.data.blocks || []).flatMap((block) => block.paragraphs)
    .flatMap((paragraph) => paragraph.lines).flatMap((line) => line.words)
    .map((word) => ({ text: word.text, confidence: word.confidence, bbox: word.bbox }));
  return { text: result.data.text, confidence: result.data.confidence, words };
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
  if (ocrWorkerPromise) ocrWorkerPromise.then((worker) => worker.terminate()).catch(() => {});
});
