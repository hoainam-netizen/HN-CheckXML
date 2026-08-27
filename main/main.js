const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { machineIdSync } = require('node-machine-id');
const ExcelJS = require('exceljs');
const mssql = require('mssql');
const util = require('util');
const path = require('path');
const fs = require('fs');
const { createStyledHeader, appendErrorRows } = require('./excelUtils');
const { autoUpdater } = require('electron-updater');
const Store = require('electron-store').default;
const { execFile } = require("child_process");

const HW_ID = machineIdSync();
let mainWindow;
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: isDev
      ? path.join(__dirname, '..', 'public', 'logo.ico') // chạy dev
      : path.join(process.resourcesPath, 'public', 'logo.ico'), // khi build
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.resolve(__dirname, '..', 'dist', 'index.html'));
  }
}

app.on('ready', () => {
  createWindow();

  if (!isDev) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.checkForUpdates();
  }
});

// --- UPDATE EVENTS ---
autoUpdater.on('update-available', () => {
  console.log('Có bản cập nhật mới');
  mainWindow.webContents.send('update-available');
});

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow.webContents.send('update-download-progress', {
    percent: progressObj.percent.toFixed(2),
    speed: progressObj.bytesPerSecond,
    transferred: progressObj.transferred,
    total: progressObj.total,
  });
});

autoUpdater.on('update-downloaded', () => {
  console.log('Tải xong bản cập nhật');
  mainWindow.webContents.send('update-ready-to-install');
});

autoUpdater.on('error', (err) => {
  console.error('Update error:', err);
});

// --- IPC từ renderer ---
ipcMain.on('install-update-now', () => {
  autoUpdater.quitAndInstall();
});

const hnCheckXmlDir = path.join(app.getPath('documents'), 'HNCheckXML');

const MCCT_ENDPOINT = 'https://egw.baohiemxahoi.gov.vn/api/TraCuuCCT/TraCuuTienMCCT';
const SQL_LOOKUP_CONFIG = {
  server: '192.168.1.252',
  database: 'PKDONGHIEU2019',
  user: 'sa',
  password: '123@lrco',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

ipcMain.handle('lookup-mcct', async (_event, { payload, headers }) => {
  const response = await fetch(MCCT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accessToken: headers.accessToken,
      tokenId: headers.tokenId,
      passwordHash: headers.passwordHash,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch {
    responseData = responseText;
  }

  if (!response.ok) {
    const message = typeof responseData === 'object' ? responseData?.GhiChu || responseData?.message : responseText;
    throw new Error(message || `MCCT API error: ${response.status}`);
  }

  return responseData;
});

ipcMain.handle('query-patient-by-makcb', async (_event, maKcb) => {
  const normalizedMaKcb = String(maKcb || '').trim();
  if (!normalizedMaKcb) return [];

  let pool;

  try {
    pool = await mssql.connect(SQL_LOOKUP_CONFIG);

    const result = await pool.request()
      .input('maKcb', mssql.VarChar(50), normalizedMaKcb)
      .query(`
        SELECT
          [makcb],
          [hoten],
          [ngaysinhTEXT],
          COALESCE(NULLIF(LTRIM(RTRIM([socmnd])), ''), [sobhxh]) AS [socmnd]
        FROM [PKDONGHIEU2019].[dbo].[dangky]
        WHERE [makcb] = @maKcb
      `);

    return result.recordset;
  } finally {
    if (pool) await pool.close();
  }
});

ipcMain.handle('update-patient-luyke', async (_event, { maKcb, luyke }) => {
  const normalizedMaKcb = String(maKcb || '').trim();
  const normalizedLuyke = String(luyke ?? '').replace(/,/g, '').trim();
  if (!normalizedMaKcb || !/^\d+(\.\d+)?$/.test(normalizedLuyke)) {
    throw new Error('Mã KCB hoặc tiền MCCT lũy kế không hợp lệ.');
  }

  let pool;
  try {
    pool = await mssql.connect(SQL_LOOKUP_CONFIG);
    const result = await pool.request()
      .input('maKcb', mssql.VarChar(50), normalizedMaKcb)
      .input('luyke', mssql.Decimal(18, 2), Number(normalizedLuyke))
      .query(`
        UPDATE [PKDONGHIEU2019].[dbo].[dangky]
        SET [luyke] = @luyke
        WHERE [makcb] = @maKcb;
        SELECT @@ROWCOUNT AS affectedRows;
      `);

    return { affectedRows: result.recordset?.[0]?.affectedRows || 0 };
  } finally {
    if (pool) await pool.close();
  }
});

// ===== JSON IPC =====
ipcMain.on('save-json', (event, { fileName, data }) => {
  if (!fs.existsSync(hnCheckXmlDir)) {
    fs.mkdirSync(hnCheckXmlDir);
  }
  const savePath = path.join(hnCheckXmlDir, `${fileName}.json`);
  try {
    fs.writeFileSync(savePath, JSON.stringify(data, null, 2), 'utf-8');
    event.reply('save-json-success', { path: savePath });
  } catch (error) {
    event.reply('save-json-error', error.message);
  }
});

ipcMain.handle('get-json-files', () => {
  if (!fs.existsSync(hnCheckXmlDir)) return [];
  return fs.readdirSync(hnCheckXmlDir).filter((f) => f.endsWith('.json'));
});

ipcMain.handle('get-hw-id', () => {
  return HW_ID;
});

ipcMain.handle('read-json-file', (event, fileName) => {
  const filePath = path.join(hnCheckXmlDir, fileName);
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
});

// ===== Excel IPC =====
ipcMain.handle('export-excel', async (event, sheetsData, fileName) => {
  try {
    const workbook = new ExcelJS.Workbook();

    // Sắp xếp sheet theo số thứ tự (XML1, XML2, XML3...)
    const sortedEntries = Object.entries(sheetsData).sort(([a], [b]) => {
      const aNum = parseInt(a.replace(/\D/g, '')) || 0;
      const bNum = parseInt(b.replace(/\D/g, '')) || 0;
      return aNum - bNum;
    });

    for (const [sheetName, rows] of sortedEntries) {
      const sheet = workbook.addWorksheet(sheetName);

      if (!rows.length) continue;

      // Header: lấy tất cả keys xuất hiện trong toàn bộ các dòng của sheet
      const headers = [];
      rows.forEach((row) => {
        Object.keys(row).forEach((key) => {
          if (!headers.includes(key)) {
            headers.push(key);
          }
        });
      });
      const headerRow = sheet.addRow(headers);

      headerRow.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };

      headerRow.alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };

      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF3F8A3E' },
        };
      });

      // Data
      rows.forEach((row) => {
        const rowValues = headers.map((header) => row[header] ?? '');
        sheet.addRow(rowValues);
      });

      // Auto width
      sheet.columns.forEach((column) => {
        let maxLength = 10;

        column.eachCell?.({ includeEmpty: true }, (cell) => {
          const length = cell.value ? cell.value.toString().length : 0;
          if (length > maxLength) maxLength = length;
        });

        column.width = Math.min(maxLength + 2, 50);
      });

      // Freeze header
      sheet.views = [
        {
          state: 'frozen',
          ySplit: 1,
        },
      ];
    }

    // Tạo mã thời gian ddMMyyyyHHmm
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');

    const dateCode =
      `${pad(now.getDate())}` +
      `${pad(now.getMonth() + 1)}` +
      `${now.getFullYear()}` +
      `${pad(now.getHours())}` +
      `${pad(now.getMinutes())}`;

    // Chọn nơi lưu
    const defaultFileName = fileName
      ? `${fileName}_${dateCode}.xlsx`
      : `HS3176_${dateCode}.xlsx`;

    const title = fileName
      ? `Xuất File Excel ${fileName}`
      : 'Xuất File Excel XML3176';

    const { filePath } = await dialog.showSaveDialog({
      title,
      defaultPath: path.join(
        app.getPath('documents'),
        defaultFileName
      ),
      filters: [
        {
          name: 'Excel Files',
          extensions: ['xlsx'],
        },
      ],
    });

    if (!filePath) return null;

    await workbook.xlsx.writeFile(filePath);

    // Mở file sau khi xuất
    await shell.openPath(filePath);

    return filePath;
  } catch (err) {
    console.error('Lỗi xuất Excel:', err);
    throw err;
  }
});


ipcMain.handle('export-excel-summary', async (event, sheetsData) => {
  try {
    const workbook = new ExcelJS.Workbook();

    const sortedEntries = Object.entries(sheetsData).sort(([a], [b]) => {
      const aNum = parseInt(a.replace(/\D/g, '')) || 0;
      const bNum = parseInt(b.replace(/\D/g, '')) || 0;
      return aNum - bNum;
    });

    for (const [sheetName, rows] of sortedEntries) {
      const sheet = workbook.addWorksheet(sheetName);
      if (!rows.length) continue;

      // ===== HEADER =====
      const headers = Object.keys(rows[0]);
      const headerRow = sheet.addRow(headers);

      headerRow.eachCell((cell) => {
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' }, // chữ trắng
        };

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF3F8A3E' }, // xanh da trời
        };

        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
        };
      });

      // ===== DATA =====
      rows.forEach((row) => {
        sheet.addRow(Object.values(row));
      });

      // ===== AUTO WIDTH =====
      sheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const val = cell.value ? cell.value.toString() : '';
          maxLength = Math.max(maxLength, val.length);
        });
        column.width = maxLength + 2;
      });

      // ===== FREEZE HEADER =====
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    }

    // ===== SAVE FILE =====
    const { filePath } = await dialog.showSaveDialog({
      title: 'Xuất File 01/BH (Excel)',
      defaultPath: path.join(
        app.getPath('documents'),
        `Mau_01_BH.xlsx`,
      ),
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
    });

    if (!filePath) return null;

    await workbook.xlsx.writeFile(filePath);
    await shell.openPath(filePath);

    return filePath;
  } catch (err) {
    throw err;
  }
});

function sanitizeSheetName(name) {
  return name
    .replace(/[\\/?*\[\]:]/g, '_') // bỏ ký tự cấm
    .substring(0, 31);
}

function createUniqueSheetName(workbook, baseName) {
  let name = sanitizeSheetName(baseName);
  let counter = 1;

  while (workbook.getWorksheet(name)) {
    const suffix = ` (${counter})`;
    const trimmedBase = sanitizeSheetName(baseName).substring(
      0,
      31 - suffix.length
    );
    name = trimmedBase + suffix;
    counter++;
  }

  return name;
}

ipcMain.handle('export-errors-excel', async (event, validationErrors) => {
  const workbook = new ExcelJS.Workbook();
  const title = 'PHẦN MỀM KIỂM LỖI XML - NGUYỄN QUANG HOÀI NAM';

  // Nhóm lỗi theo errorCode
  const groupedByCode = new Map();
  validationErrors.forEach((err) => {
    if (!groupedByCode.has(err.errorCode)) {
      groupedByCode.set(err.errorCode, []);
    }
    groupedByCode.get(err.errorCode).push(err);
  });

  // Sheet TẤT CẢ LỖI
  const allSheet = workbook.addWorksheet('TẤT CẢ LỖI');
  createStyledHeader(allSheet, title);
  appendErrorRows(allSheet, validationErrors, false, true);

  // Sheet theo mã lỗi
  for (const [code, errors] of groupedByCode) {
    const sheetName = createUniqueSheetName(workbook, code);
    const sheet = workbook.addWorksheet(sheetName);

    createStyledHeader(sheet, title);
    appendErrorRows(sheet, errors, true, false);
  }

  // Hỏi nơi lưu file
  // Hàm tạo mã ngẫu nhiên đơn giản
  const now = new Date();

  // Hàm tiện ích để thêm số 0 phía trước
  const pad = (n) => n.toString().padStart(2, '0');

  const dateStr = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}`;
  const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}`;

  const fileName = `FILEERRORS_${dateStr}${timeStr}.xlsx`;

  const { filePath } = await dialog.showSaveDialog({
    title: 'Xuất File Hồ Sơ Lỗi',
    defaultPath: path.join(
      app.getPath('documents'),
      fileName
    ),
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
  });

  if (!filePath) return null; // Cancel

  await workbook.xlsx.writeFile(filePath);
  await shell.openPath(filePath);

  return filePath;
});

ipcMain.handle('export-template-excel', async (event, columns, fileName) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Template');

  // HEADER
  const headerRow = sheet.addRow(columns);

  headerRow.font = { bold: true };

  headerRow.alignment = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true,
  };

  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };

    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE7F3FF' }, // xanh nhạt
    };
  });

  // AUTO WIDTH
  sheet.columns.forEach((column, i) => {
    const length = columns[i]?.length || 10;
    column.width = length + 5;
  });

  // FREEZE HEADER
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const { filePath } = await dialog.showSaveDialog({
    title: 'Xuất Template Excel',
    defaultPath: `${fileName}.xlsx`,
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
  });

  if (!filePath) return null;

  await workbook.xlsx.writeFile(filePath);
  await shell.openPath(filePath);

  return filePath;
});


const store = new Store({
  cwd: hnCheckXmlDir,
  name: 'DanhMucLoi',
});

ipcMain.handle('get-error-rules', () => {
  return store.get('errorRules', []); // nếu chưa có trả []
});

ipcMain.on('save-error-rules', (event, rules) => {
  store.set('errorRules', rules);
});

ipcMain.handle("sign-xml-with-exe", async (event, xmlContent) => {
  return new Promise((resolve, reject) => {

    const tempInput = path.join(app.getPath("temp"), `input_${Date.now()}.xml`);
    const tempOutput = path.join(app.getPath("temp"), `signed_${Date.now()}.xml`);

    fs.writeFileSync(tempInput, xmlContent, "utf8");

    const exePath = app.isPackaged
      ? path.join(process.resourcesPath, "SignXmlApp.exe")
      : path.join(process.cwd(), "resources", "SignXmlApp.exe");

    execFile(exePath, [tempInput, tempOutput], (error, stdout) => {

      if (error) {
        reject(error.message);
        return;
      }

      const result = stdout.trim();

      if (result.includes("SUCCESS")) {
        const signedXml = fs.readFileSync(tempOutput, "utf8");

        fs.unlinkSync(tempInput);
        fs.unlinkSync(tempOutput);

        resolve(signedXml);
      } else {
        reject(result);
      }
    });
  });
});

// Hàm lưu file XML ra máy tính
ipcMain.handle('save-file', async (event, { content, fileName }) => {
  try {
    // Kiểm tra xem content có tồn tại không trước khi lưu
    if (!content) throw new Error("Dữ liệu XML trống!");

    const { filePath } = await dialog.showSaveDialog({
      title: 'Lưu file XML',
      defaultPath: fileName,
      filters: [{ name: 'XML Files', extensions: ['xml'] }]
    });

    if (filePath) {
      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true };
    }
    return { success: false, message: "Người dùng đã hủy" };
  } catch (err) {
    return { success: false, message: err.message };
  }
});
