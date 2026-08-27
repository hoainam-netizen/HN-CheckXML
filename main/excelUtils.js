// excelUtils.js
const ExcelJS = require('exceljs');

function createStyledHeader(sheet, title) {
  sheet.mergeCells('A1', 'H1');
  const cell = sheet.getCell('A1');
  cell.value = title;
  cell.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '3f8a3e' },
  };
}

function appendErrorRows(sheet, errors, includeExtraColumns = false, isAllSheet = false) {
  const allExtraKeys = includeExtraColumns
    ? Array.from(new Set(errors.flatMap((e) => Object.keys(e.extra || {}))))
    : [];

  const baseHeaders = ['MA_LK', 'HO_TEN', 'NGAY_SINH', 'GIOI_TINH', 'NGAY_VAO', 'NGAY_RA'];

  const commonHeaders = [
    ...(isAllSheet ? ['MA_DKBD'] : []),
    'MA_LOAI_KCB',
    'MA_KHOA',
    'MA_CSKCB',
    ...(isAllSheet ? ['LOAI_HS'] : []),
  ];

  const headerRow = sheet.addRow([
    ...baseHeaders,
    ...commonHeaders,
    ...allExtraKeys,
    'CHI_TIET_LOI',
  ]);

  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number, column: headerRow.cellCount },
  };

  errors.forEach((err) => {
    const baseData = [
      err.maLk || 'N/A',
      err.hoTen || 'N/A',
      err.ngaySinh || 'N/A',
      err.gioiTinh || 'N/A',
      err.ngayVao || 'N/A',
      err.ngayRa || 'N/A',
    ];

    const commonData = [
      ...(isAllSheet ? [err.maDkbd || 'N/A'] : []),
      err.maLoaiKcb || 'N/A',
      err.maKhoa || 'N/A',
      err.maCskcb || 'N/A',
      ...(isAllSheet ? [err.sheetName] : []),
    ];

    const row = sheet.addRow([
      ...baseData,
      ...commonData,
      ...allExtraKeys.map((key) => err.extra?.[key] || ''),
      err.errorMessage,
    ]);

    const errorCell = row.getCell(row.cellCount);
    errorCell.font = { color: { argb: 'FFFF0000' } };
  });
}

module.exports = { createStyledHeader, appendErrorRows };
