const { contextBridge, ipcRenderer } = require('electron');

const saveSuccessWrappers = new Map();
const saveErrorWrappers = new Map();

contextBridge.exposeInMainWorld('electronAPI', {
  saveJson: (fileName, data) => ipcRenderer.send('save-json', { fileName, data }),

  onSaveJsonSuccess: (callback) => {
    const wrapper = (event, info) => callback(info);
    saveSuccessWrappers.set(callback, wrapper);
    ipcRenderer.on('save-json-success', wrapper);
  },
  removeSaveJsonSuccess: (callback) => {
    const wrapper = saveSuccessWrappers.get(callback);
    if (wrapper) {
      ipcRenderer.removeListener('save-json-success', wrapper);
      saveSuccessWrappers.delete(callback);
    }
  },

  onSaveJsonError: (callback) => {
    const wrapper = (event, error) => callback(error);
    saveErrorWrappers.set(callback, wrapper);
    ipcRenderer.on('save-json-error', wrapper);
  },
  removeSaveJsonError: (callback) => {
    const wrapper = saveErrorWrappers.get(callback);
    if (wrapper) {
      ipcRenderer.removeListener('save-json-error', wrapper);
      saveErrorWrappers.delete(callback);
    }
  },

  exportTemplateExcel: (columns, fileName) =>
    ipcRenderer.invoke("export-template-excel", columns, fileName),

  getJsonFiles: () => ipcRenderer.invoke('get-json-files'),
  readJsonFile: (fileName) => ipcRenderer.invoke('read-json-file', fileName),
  getHwId: () => ipcRenderer.invoke('get-hw-id'),

  exportExcel: (sheetsData, fileName) => ipcRenderer.invoke('export-excel', sheetsData, fileName),
  exportExcelSummary: (sheetsData) => ipcRenderer.invoke('export-excel-summary', sheetsData),
  exportErrorsExcel: (errors) => ipcRenderer.invoke('export-errors-excel', errors),

  getErrorRules: () => ipcRenderer.invoke('get-error-rules'),
  saveErrorRules: (rules) => ipcRenderer.send('save-error-rules', rules),
  lookupMcct: (payload) => ipcRenderer.invoke('lookup-mcct', payload),
  queryPatientByMaKcb: (maKcb) => ipcRenderer.invoke('query-patient-by-makcb', maKcb),
  updatePatientLuyke: (payload) => ipcRenderer.invoke('update-patient-luyke', payload),

  onUpdateAvailable: (callback) => ipcRenderer.on("update-available", callback),
  onDownloadProgress: (callback) => ipcRenderer.on("update-download-progress", callback),
  onUpdateReady: (callback) => ipcRenderer.on("update-ready-to-install", callback),
  installUpdate: () => ipcRenderer.send("install-update-now"),

  signXml: (xml) => ipcRenderer.invoke("sign-xml-with-exe", xml),
  saveFile: (xml) => ipcRenderer.invoke("save-file", xml),

});
