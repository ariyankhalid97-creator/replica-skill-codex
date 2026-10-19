/// <reference types="vite/client" />

interface PickedBinaryFile {
  name: string;
  path?: string;
  extension?: string;
  data: ArrayBuffer;
}

interface Window {
  privateParse?: {
    openPdf(): Promise<PickedBinaryFile | null>;
    openPdfs(): Promise<PickedBinaryFile[]>;
    openSample(): Promise<PickedBinaryFile>;
    openSignatureImage(): Promise<PickedBinaryFile | null>;
    openFont(): Promise<PickedBinaryFile | null>;
    importVaultFont(): Promise<PickedBinaryFile | null>;
    listVaultFonts(): Promise<Array<{ id: string; name: string }>>;
    readVaultFont(id: string): Promise<PickedBinaryFile | null>;
    saveFile(payload: { defaultName: string; kind: 'pdf' | 'csv'; data: ArrayBuffer }): Promise<string | null>;
    saveRecovery(payload: { name: string; data: ArrayBuffer }): Promise<boolean>;
    getRecoveryInfo(): Promise<{ name: string; savedAt: string } | null>;
    loadRecovery(): Promise<(PickedBinaryFile & { savedAt: string }) | null>;
    clearRecovery(): Promise<boolean>;
    recognizeImage(data: ArrayBuffer): Promise<{ text: string; confidence: number; words: OcrWordResult[] }>;
    onOcrProgress(callback: (state: { status: string; progress: number }) => void): () => void;
    appInfo(): Promise<{ version: string; packaged: boolean }>;
    checkForUpdates(): Promise<UpdateState>;
    downloadUpdate(): Promise<UpdateState>;
    installUpdate(): Promise<void>;
    onUpdateState(callback: (state: UpdateState) => void): () => void;
  };
}

interface OcrWordResult {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'current' | 'downloading' | 'ready' | 'error' | 'development';
  version?: string;
  percent?: number;
  message?: string;
}
