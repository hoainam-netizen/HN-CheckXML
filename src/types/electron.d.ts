export interface ElectronAPI {
  saveFile: any;
  signXml(xmlString: string): string | PromiseLike<string>;
  exportXml(arg0: { data: any[]; pin: string; }): unknown;
  lookupKCB: (kcbCode: string) => Promise<any>;
  // --- JSON ---
  saveJson: (fileName: string, data: any) => void;
  onSaveJsonSuccess: (callback: (info: { path: string }) => void) => void;
  removeSaveJsonSuccess: (callback: (info: { path: string }) => void) => void;
  onSaveJsonError: (callback: (error: string) => void) => void;
  removeSaveJsonError: (callback: (error: string) => void) => void;
  getJsonFiles: () => Promise<string[]>;
  readJsonFile: (fileName: string) => Promise<any>;
  getHwId: () => Promise<string>;

  // --- File ---
  openFileDialog?: (options?: OpenDialogOptions) => Promise<string[] | undefined>;

  // --- Excel ---
  exportExcel: (sheetsData: Record<string, any[]>, fileName?: string) => Promise<string>;
  exportExcelSummary: (sheetsData: Record<string, any[]>) => Promise<string>;
  exportErrorsExcel: (validationErrors: any[]) => Promise<string>;
  exportTemplateExcel: (columns: string[], fileName: string) => Promise<string>;
  // --- Rules ---
  getErrorRules: () => Promise<any>;
  saveErrorRules: (rules: any) => void;
  lookupMcct?: (payload: {
    payload: Record<string, string>;
    headers: Record<string, string>;
  }) => Promise<any>;

  // --- Update ---
  onUpdateAvailable: (callback: () => void) => void;
  onDownloadProgress: (
    callback: (_: any, data: { percent: number; speed: number }) => void,
  ) => void;
  onUpdateReady: (callback: () => void) => void;
  installUpdate: () => void;
  queryPatientByMaKcb: (maKcb: string) => Promise<Array<{
    makcb: string;
    hoten: string;
    ngaysinhTEXT: string;
    socmnd: string;
  }>>;
  updatePatientLuyke: (payload: { maKcb: string; luyke: string }) => Promise<{ affectedRows: number }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
