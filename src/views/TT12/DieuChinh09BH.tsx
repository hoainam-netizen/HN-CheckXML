import React, { useEffect, useMemo, useRef, useState } from 'react';
import { notification } from 'antd';
import { AlertTriangle, CheckCircle2, FileDown, FileUp, LoaderCircle } from 'lucide-react';
import { create } from 'xmlbuilder2';
import { v4 as uuidv4 } from 'uuid';
import { base64ToXml, isBase64, parseXmlToJson } from 'src/utils/Base64Helper';

type Row = Record<string, string>;
type Sheets = Record<string, Row[]>;
type Change = { stt: number; table: string; field: string; original: string; adjusted: string; reason: string; originalRow: Row; adjustedRow: Row };
type MoneyComparison = { field: string; label: string; xml1: number; xml2: number; xml3: number; total: number; difference: number };

const MONEY_FIELDS = [
  ['T_TONGCHI_BV', 'Tổng chi BV'],
  ['T_TONGCHI_BH', 'Tổng chi BH'],
  ['T_BHTT', 'Bảo hiểm thanh toán'],
  ['T_THUOC', 'Tiền thuốc'],
  ['T_VTYT', 'Tiền vật tư y tế'],
  ['T_BNCCT', 'Bệnh nhân cùng chi trả'],
  ['T_BNTT', 'Bệnh nhân tự trả'],
  ['T_NGUONKHAC', 'Nguồn khác'],
  ['T_NGUONKHAC_NSSN', 'Nguồn khác - NSNN'],
  ['T_NGUONKHAC_VTNN', 'Nguồn khác - viện trợ nước ngoài'],
  ['T_NGUONKHAC_VTTN', 'Nguồn khác - viện trợ trong nước'],
  ['T_NGUONKHAC_CL', 'Nguồn khác - còn lại'],
] as const;

const parseMoney = (value: unknown) => {
  const text = normalizeValue(value).replace(/,/g, '');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);

const readHoso = (xml: string): Sheets => {
  const document = new DOMParser().parseFromString(xml, 'text/xml');
  const result: Sheets = {};
  const files = Array.from(document.getElementsByTagName('FILEHOSO'));
  if (files.length) {
    files.forEach((file) => {
      const rawName = file.getElementsByTagName('LOAIHOSO')[0]?.textContent?.trim() || 'XML1';
      const name = rawName.replace(/\s/g, '').toUpperCase() === 'XML1' ? 'XML1' : rawName;
      const content = file.getElementsByTagName('NOIDUNGFILE')[0]?.textContent?.trim() || '';
      if (isBase64(content)) result[name] = [...(result[name] || []), ...parseXmlToJson(base64ToXml(content))];
    });
  } else {
    result.XML1 = parseXmlToJson(xml);
  }
  return result;
};

const importHoso = async (file: File) => readHoso(await file.text());

const normalizeValue = (value: unknown) => String(value ?? '').trim();

const getRowKey = (row: Row, index: number) => {
  const maLk = normalizeValue(row.MA_LK);
  const stt = normalizeValue(row.STT || row.STT_XML);
  const idCp = normalizeValue(row.ID_CP);
  const serviceCode = normalizeValue(row.MA_DICH_VU || row.MA_THUOC || row.MA_VAT_TU || row.MA_DVKT);
  if (maLk && stt) return `MA_LK:${maLk}|STT:${stt}`;
  if (maLk && idCp) return `MA_LK:${maLk}|ID_CP:${idCp}`;
  if (maLk && serviceCode) return `MA_LK:${maLk}|CODE:${serviceCode}`;
  const stableFields = ['XML1_ID', 'MA_BN', 'ID_CP'];
  const field = stableFields.find((name) => normalizeValue(row[name]));
  return field ? `${field}:${normalizeValue(row[field])}` : `INDEX:${index}`;
};

const getRowFingerprint = (row: Row) => Object.keys(row).sort().map((field) => `${field}=${normalizeValue(row[field])}`).join('\u0001');

const matchRow = (oldRows: Row[], newRows: Row[], index: number) => {
  const oldRow = oldRows[index];
  if (!oldRow) return undefined;
  const exactIndex = newRows.findIndex((row) => getRowFingerprint(row) === getRowFingerprint(oldRow));
  if (exactIndex >= 0) return newRows[exactIndex];
  const key = getRowKey(oldRow, index);
  return newRows.find((row, candidateIndex) => getRowKey(row, candidateIndex) === key) || newRows[index];
};

const compareSheets = (original: Sheets, adjusted: Sheets, reasonFor: (field: string) => string): Change[] => {
  const changes: Change[] = [];
  Object.keys(original).forEach((table) => {
    const oldRows = original[table] || [];
    const newRows = adjusted[table] || [];
    const unusedRows = new Set(newRows.map((_, index) => index));
    oldRows.forEach((oldRow, index) => {
      const exactIndex = newRows.findIndex((row, candidateIndex) => unusedRows.has(candidateIndex) && getRowFingerprint(row) === getRowFingerprint(oldRow));
      const key = getRowKey(oldRow, index);
      const keyIndex = newRows.findIndex((row, candidateIndex) => unusedRows.has(candidateIndex) && getRowKey(row, candidateIndex) === key);
      const fallbackIndex = unusedRows.has(index) ? index : -1;
      const matchedIndex = exactIndex >= 0 ? exactIndex : keyIndex >= 0 ? keyIndex : fallbackIndex;
      const newRow = matchedIndex >= 0 ? newRows[matchedIndex] : undefined;
      if (matchedIndex >= 0) unusedRows.delete(matchedIndex);
      if (!newRow) return;
      Array.from(new Set([...Object.keys(oldRow), ...Object.keys(newRow)])).forEach((field) => {
        const originalValue = normalizeValue(oldRow[field]);
        const adjustedValue = normalizeValue(newRow[field]);
        if (originalValue !== adjustedValue) changes.push({ stt: changes.length + 1, table, field, original: originalValue, adjusted: adjustedValue, reason: reasonFor(field), originalRow: oldRow, adjustedRow: newRow });
      });
    });
  });
  return changes;
};

const findXml1 = (sheets: Sheets, id: string) => {
  const rows = sheets.XML1 || Object.values(sheets).flat().filter((row) => row.MA_LK);
  return rows.find((row) => row.XML1_ID === id) || rows[0];
};

const getKyQt = (dateValue: string, fallback: string) => {
  const digits = dateValue.replace(/\D/g, '');
  if (/^\d{8,}$/.test(digits)) return digits.slice(0, 6);
  const parts = dateValue.split(/[./-]/);
  if (parts.length === 3 && parts[2].length === 4) return `${parts[2]}${parts[1].padStart(2, '0')}`;
  return fallback || '';
};

const DieuChinh09BH: React.FC = () => {
  const [api, contextHolder] = notification.useNotification();
  const originalRef = useRef<HTMLInputElement>(null);
  const adjustedRef = useRef<HTMLInputElement>(null);
  const [original, setOriginal] = useState<Sheets>({});
  const [adjusted, setAdjusted] = useState<Sheets>({});
  const [status, setStatus] = useState<'1' | '2'>('1');
  const [xml1Id, setXml1Id] = useState('');
  const [reasonEdits, setReasonEdits] = useState<Record<string, string>>({});
  const [selectedChangeIndex, setSelectedChangeIndex] = useState(0);
  const [selectedRows, setSelectedRows] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState('__changes__');
  const [meta, setMeta] = useState(() => ({
    maCskcb: localStorage.getItem('DieuChinh09BH_MA_CSKCB') || '',
    nguoiLap: localStorage.getItem('DieuChinh09BH_NGUOILAPBIEU') || '',
    thuTruong: localStorage.getItem('DieuChinh09BH_THUTRUONG_DV') || '',
  }));
  const [loading, setLoading] = useState(false);

  const originalXml1 = useMemo(() => findXml1(original, xml1Id) || original.XML1?.[0], [original, xml1Id]);
  const adjustedXml1 = useMemo(() => findXml1(adjusted, xml1Id), [adjusted, xml1Id]);
  const changes = useMemo(() => compareSheets(original, adjusted, (field) => reasonEdits[field] || `Sửa ${field}`), [original, adjusted, reasonEdits]);
  const moneyComparisons = useMemo<MoneyComparison[]>(() => {
    if (!originalXml1?.MA_LK) return [];

    const sourceRows = Object.entries(adjusted)
      .filter(([table]) => /^XML[23]$/i.test(table))
      .flatMap(([table, rows]) => rows.filter((row) => normalizeValue(row.MA_LK) === normalizeValue(originalXml1.MA_LK)).map((row) => ({ table: table.toUpperCase(), row })));
    const sum = (table: string, field: string, condition: (row: Row) => boolean = () => true) =>
      sourceRows.reduce((total, source) => total + (source.table === table && condition(source.row) ? parseMoney(source.row[field]) : 0), 0);
    const sumAll = (field: string) => sourceRows.reduce((total, source) => total + parseMoney(source.row[field]), 0);
    const totalBh = sumAll('THANH_TIEN_BH');
    const bncct = sumAll('T_BNCCT');

    return MONEY_FIELDS.map(([field, label]) => {
      const sourceField = field === 'T_TONGCHI_BV' ? 'THANH_TIEN_BV' : field === 'T_TONGCHI_BH' ? 'THANH_TIEN_BH' : field;
      const xml2 = field === 'T_THUOC'
        ? sum('XML2', 'THANH_TIEN_BV')
        : field === 'T_VTYT'
          ? sum('XML2', 'THANH_TIEN_BV', (row) => normalizeValue(row.MA_NHOM) === '10')
          : field === 'T_BHTT'
            ? sum('XML2', 'THANH_TIEN_BH') - sum('XML2', 'T_BNCCT')
            : sum('XML2', sourceField);
      const xml3 = field === 'T_THUOC' || field === 'T_VTYT'
        ? 0
        : field === 'T_BHTT'
          ? sum('XML3', 'THANH_TIEN_BH') - sum('XML3', 'T_BNCCT')
          : sum('XML3', sourceField);
      const total = field === 'T_BHTT' ? totalBh - bncct : xml2 + xml3;
      const xml1 = parseMoney(adjustedXml1?.[field] ?? originalXml1[field]);
      return { field, label, xml1, xml2, xml3, total, difference: total - xml1 };
    });
  }, [adjusted, adjustedXml1, originalXml1]);
  const selectedChange = changes[selectedChangeIndex] || changes[0];
  const validMatch = Boolean(originalXml1 && (status === '1' || adjustedXml1?.MA_LK === originalXml1.MA_LK));

  useEffect(() => {
    if (selectedChangeIndex >= changes.length) setSelectedChangeIndex(Math.max(0, changes.length - 1));
  }, [changes.length, selectedChangeIndex]);

  const updateMeta = (key: keyof typeof meta, value: string) => {
    const storageKey = { maCskcb: 'DieuChinh09BH_MA_CSKCB', nguoiLap: 'DieuChinh09BH_NGUOILAPBIEU', thuTruong: 'DieuChinh09BH_THUTRUONG_DV' }[key];
    localStorage.setItem(storageKey, value);
    setMeta((current) => ({ ...current, [key]: value }));
  };

  const resetAdjustedToOriginal = () => {
    setAdjusted(Object.fromEntries(Object.entries(original).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])));
    setReasonEdits({});
    setSelectedRows({});
    setSelectedChangeIndex(0);
    setStatus('1');
    setActiveTab('__changes__');
  };

  const loadFile = async (event: React.ChangeEvent<HTMLInputElement>, target: 'original' | 'adjusted') => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const sheets = await importHoso(file);
      if (target === 'original') {
        setOriginal(sheets);
        setActiveTab('__changes__');
        setXml1Id(sheets.XML1?.[0]?.XML1_ID || '');
        setAdjusted(Object.fromEntries(Object.entries(sheets).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])));
        setReasonEdits({});
      } else {
        const importedXml1 = findXml1(sheets, xml1Id);
        if (!originalXml1 || !importedXml1 || importedXml1.MA_LK !== originalXml1.MA_LK) {
          api.error({ message: 'Hồ sơ điều chỉnh phải có MA_LK trùng hồ sơ gốc' });
          return;
        }
        setAdjusted(sheets);
      }
      api.success({ message: target === 'original' ? 'Đã import hồ sơ gốc' : 'Đã import hồ sơ điều chỉnh' });
    } catch (error) {
      api.error({ message: 'Không thể đọc hồ sơ XML', description: String(error) });
    } finally {
      event.target.value = '';
    }
  };

  const updateCell = (table: string, rowIndex: number, field: string, value: string) => {
    setAdjusted((current) => ({
      ...current,
      [table]: (current[table] || []).map((row, index) => index === rowIndex ? { ...row, [field]: value } : row),
    }));
    setStatus('2');
  };

  const buildXml = () => {
    const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('HOSO_DIEUCHINH_GD');
    const hoso = root.ele('TT_HOSO', { Id: `Id-${uuidv4()}` });
    const form = hoso.ele('TT_MAU');
    form.ele('MAU_SO').txt('09/BH');
    form.ele('MA_CSKCB').txt(meta.maCskcb);
    form.ele('NGUOILAPBIEU').txt(meta.nguoiLap);
    form.ele('THUTRUONG_DV').txt(meta.thuTruong);
    const ngayRa = originalXml1?.NGAY_RA || '';
    form.ele('NGAYTHANGNAM').txt(new Date().toISOString().slice(0, 10).replace(/-/g, ''));
    const xml1 = hoso.ele('TT_XML1');
    const xml1Fields: Array<[string, string]> = [['XML1_ID', xml1Id], ['MA_LK', originalXml1?.MA_LK || ''], ['MA_BN', originalXml1?.MA_BN || ''], ['HO_TEN', originalXml1?.HO_TEN || originalXml1?.HO_TEN_BN || ''], ['MA_THE', originalXml1?.MA_THE || originalXml1?.MA_THE_BHYT || ''], ['NGAY_VAO', originalXml1?.NGAY_VAO || ''], ['NGAY_RA', ngayRa], ['KY_QT', getKyQt(ngayRa, originalXml1?.KY_QT || '')], ['TRANGTHAI', status]];
    xml1Fields.forEach(([key, value]) => xml1.ele(key).txt(value));
    const adjustment = hoso.ele('TT_DIEUCHINH');
    const list = adjustment.ele('DS_XML1_DIEUCHINH');
    changes.filter((change) => change.table === 'XML1').forEach((change) => {
      const item = list.ele('TT_XML1_DC');
      item.ele('STT').txt(String(change.stt));
      item.ele('TRUONG_TT_GOC').txt(change.field);
      item.ele('TT_GOC').txt(change.original);
      item.ele('TRUONG_TT_DIEUCHINH').txt(change.field);
      item.ele('TT_DIEUCHINH').txt(change.adjusted);
      item.ele('LYDO_DIEUCHINH').txt(change.reason);
    });
    const costList = adjustment.ele('DSCP_DIEUCHINH');
    changes.filter((change) => change.table !== 'XML1').forEach((change) => {
      const cost = costList.ele('CHIPHI');
      const tableNumber = change.table.match(/XML(\d+)/i)?.[1] || '';
      cost.ele('STT').txt(String(change.adjustedRow.STT || change.originalRow.STT || change.stt));
      cost.ele('SOBANG_XML').txt(tableNumber);
      cost.ele('ID_CP').txt(normalizeValue(change.adjustedRow.ID_CP || change.originalRow.ID_CP));
      cost.ele('STT_XML').txt(normalizeValue(change.adjustedRow.STT_XML || change.originalRow.STT_XML || change.adjustedRow.STT || change.originalRow.STT));
      cost.ele('NGAY_YL').txt(normalizeValue(change.adjustedRow.NGAY_YL || change.originalRow.NGAY_YL));
      cost.ele('TRANGTHAI').txt('2');
      cost.ele('TRUONG_TT_GOC').txt(change.field);
      cost.ele('TT_GOC').txt(change.original);
      cost.ele('LYDO').txt('');
      cost.ele('TUCHOI').txt('');
      cost.ele('TRUONG_TT_DIEUCHINH').txt(change.field);
      cost.ele('TT_DIEUCHINH').txt(change.adjusted);
      cost.ele('LYDO_DIEUCHINH').txt(change.reason);
    });
    root.ele('CHUKYDONVI');
    return root.end({ prettyPrint: true });
  };

  const exportAndSign = async () => {
    if (!originalXml1 || !meta.maCskcb || !meta.nguoiLap || !meta.thuTruong) return api.warning({ message: 'Vui lòng import hồ sơ gốc và nhập đủ thông tin mẫu 09/BH' });
    if (!normalizeValue(xml1Id)) {
      const shouldContinue = window.confirm(
        'Bạn chưa nhập XML1_ID. Nên nhập XML1_ID để giám định khớp đúng hồ sơ. Bạn có muốn tiếp tục xuất không?'
      );
      if (!shouldContinue) return;
    }
    if (status === '2' && !adjustedXml1) return api.warning({ message: 'Vui lòng import hồ sơ đã điều chỉnh' });
    if (status === '2' && !validMatch) return api.error({ message: 'Hồ sơ điều chỉnh không cùng MA_LK với hồ sơ gốc' });
    if (status === '2' && !changes.length) return api.warning({ message: 'Không có thay đổi để lập hồ sơ điều chỉnh' });
    setLoading(true);
    try {
      const signed = await window.electronAPI.signXml(buildXml());
      if (!signed) return;
      await window.electronAPI.saveFile({ content: signed, fileName: 'Mẫu 09BH - Hồ sơ điều chỉnh.xml' });
      api.success({ message: 'Đã ký số và lưu hồ sơ 09/BH' });
    } catch (error: any) {
      api.error({ message: 'Lỗi xuất hồ sơ', description: error?.message || String(error) });
    } finally { setLoading(false); }
  };

  const restoreOriginal = resetAdjustedToOriginal;

  return (
  <div className="min-h-screen bg-[#f4f7f6] text-slate-800">
    {contextHolder}

    {/* Background decoration */}
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-emerald-200/20 blur-3xl" />
      <div className="absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-blue-200/20 blur-3xl" />
    </div>

    <div className="relative mx-auto max-w-[1500px] space-y-6 px-4 py-5 md:px-6 lg:px-8">

      {/* =========================================================
          HEADER
      ========================================================= */}
      <header className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.06)]">
        <div className="relative px-5 py-6 md:px-7">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-50 blur-2xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-200">
                <FileDown size={27} strokeWidth={2.2} />
              </div>

              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
                    Thay thế hồ sơ 09/BH
                  </h1>

                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
                    XML
                  </span>
                </div>

                <p className="max-w-2xl text-sm leading-6 text-slate-500 md:text-[15px]">
                  Lập hồ sơ thu hồi hoặc điều chỉnh từ hồ sơ XML.
                  Đối chiếu dữ liệu gốc, cập nhật nội dung và xuất hồ sơ ký số.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
                  originalXml1
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    originalXml1 ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                />
                {originalXml1 ? "Đã nạp hồ sơ" : "Chưa có hồ sơ"}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================
          IMPORT + CONFIG
      ========================================================= */}
      <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.05)]">

        <div className="border-b border-slate-100 px-5 py-4 md:px-7">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900">
                1. Nạp hồ sơ
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Chọn hồ sơ gốc và hồ sơ đã điều chỉnh để thực hiện đối chiếu.
              </p>
            </div>

            <div className="hidden rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-500 md:block">
              Hỗ trợ định dạng .XML
            </div>
          </div>
        </div>

        <div className="p-5 md:p-7">

          {/* Import cards */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

            {/* Hồ sơ gốc */}
            <button
              type="button"
              onClick={() => originalRef.current?.click()}
              className="group relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-white p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/60"
            >
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-100/60 transition-transform duration-300 group-hover:scale-125" />

              <div className="relative flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-200">
                  <FileUp size={22} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-black text-slate-800">
                      Hồ sơ gốc
                    </span>

                    {original.XML1?.length ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                        ĐÃ NẠP
                      </span>
                    ) : (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold text-blue-700">
                        BẮT BUỘC
                      </span>
                    )}
                  </div>

                  <p className="truncate text-xs text-slate-500">
                    {original.XML1?.length
                      ? "Hồ sơ đã được nạp. Nhấn để chọn lại."
                      : "Chọn file XML hồ sơ ban đầu để bắt đầu."}
                  </p>
                </div>

                <div className="text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-blue-500">
                  →
                </div>
              </div>
            </button>

            {/* Hồ sơ điều chỉnh */}
            <button
              type="button"
              onClick={() => adjustedRef.current?.click()}
              disabled={status === "1" || !originalXml1}
              className="group relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100/60 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-100/60 transition-transform duration-300 group-hover:scale-125" />

              <div className="relative flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-200">
                  <FileUp size={22} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-black text-slate-800">
                      Hồ sơ đã điều chỉnh
                    </span>

                    {status === "1" ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-500">
                        KHÔNG ÁP DỤNG
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                        ĐIỀU CHỈNH
                      </span>
                    )}
                  </div>

                  <p className="truncate text-xs text-slate-500">
                    {!originalXml1
                      ? "Cần nạp hồ sơ gốc trước."
                      : status === "1"
                        ? "Chế độ thu hồi không cần hồ sơ điều chỉnh."
                        : "Chọn file XML đã điều chỉnh để đối chiếu."}
                  </p>
                </div>

                <div className="text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-emerald-500">
                  →
                </div>
              </div>
            </button>
          </div>

          <input
            ref={originalRef}
            type="file"
            accept=".xml"
            onChange={(e) => loadFile(e, "original")}
            className="hidden"
          />

          <input
            ref={adjustedRef}
            type="file"
            accept=".xml"
            onChange={(e) => loadFile(e, "adjusted")}
            className="hidden"
          />

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
              Thông tin hồ sơ
            </span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          {/* Config */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">

            {/* Status */}
            <label className="group">
              <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                Loại xử lý
              </span>

              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => {
                    const nextStatus = e.target.value as "1" | "2";
                    if (nextStatus === "1") return resetAdjustedToOriginal();
                    setStatus(nextStatus);
                  }}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 pr-9 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                >
                  <option value="1">
                    1 - Thu hồi đề nghị thanh toán
                  </option>
                  <option value="2">
                    2 - Đề nghị điều chỉnh
                  </option>
                </select>

                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  ▾
                </span>
              </div>
            </label>

            {/* XML1 ID */}
            <label className="group">
              <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                XML1_ID
              </span>

              <input
                value={xml1Id}
                onChange={(e) => setXml1Id(e.target.value)}
                placeholder="Nhập XML1_ID"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
              />
            </label>

            {/* MA_CSKCB */}
            <label className="group">
              <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                MA_CSKCB
              </span>

              <input
                value={meta.maCskcb}
                onChange={(e) =>
                  updateMeta("maCskcb", e.target.value)
                }
                placeholder="Mã cơ sở KCB"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
              />
            </label>

            {/* Người lập */}
            <label className="group">
              <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                NGUOILAPBIEU
              </span>

              <input
                value={meta.nguoiLap}
                onChange={(e) =>
                  updateMeta("nguoiLap", e.target.value)
                }
                placeholder="Người lập biểu"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
              />
            </label>

            {/* Thủ trưởng */}
            <label className="group">
              <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                THUTRUONG_DV
              </span>

              <input
                value={meta.thuTruong}
                onChange={(e) =>
                  updateMeta("thuTruong", e.target.value)
                }
                placeholder="Thủ trưởng đơn vị"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
              />
            </label>
          </div>
        </div>
      </section>

      {/* =========================================================
          ORIGINAL PATIENT INFO
      ========================================================= */}
      {originalXml1 && (
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.05)]">

          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-7">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <FileDown size={19} />
              </div>

              <div>
                <h2 className="text-sm font-black text-slate-900">
                  Thông tin hồ sơ gốc
                </h2>
                <p className="text-xs text-slate-500">
                  Dữ liệu được lấy từ XML1 để đối chiếu.
                </p>
              </div>
            </div>

            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-extrabold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              ĐÃ NẠP
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 md:p-7">
            {[
              ["MA_LK", originalXml1.MA_LK],
              ["MA_BN", originalXml1.MA_BN],
              [
                "HỌ TÊN",
                originalXml1.HO_TEN || originalXml1.HO_TEN_BN,
              ],
              [
                "MA_THE",
                originalXml1.MA_THE || originalXml1.MA_THE_BHYT,
              ],
              ["NGÀY VÀO", originalXml1.NGAY_VAO],
              ["NGÀY RA", originalXml1.NGAY_RA],
              [
                "KỲ QT",
                getKyQt(
                  originalXml1.NGAY_RA || "",
                  originalXml1.KY_QT || ""
                ),
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="group min-w-0 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 transition hover:border-emerald-100 hover:bg-emerald-50/40"
              >
                <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  {label}
                </div>

                <div
                  className="break-words text-sm font-bold text-slate-700"
                  title={String(value || "")}
                >
                  {value || "-"}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================
          TABS
      ========================================================= */}
      {Object.keys(adjusted).length > 0 && (
        <div className="sticky top-2 z-30">
          <nav className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-lg shadow-slate-200/30 backdrop-blur-xl">

            <div className="flex gap-1 overflow-x-auto scrollbar-thin">

              {/* Money comparison tab */}
              <button
                type="button"
                onClick={() => setActiveTab("__totals__")}
                className={`group flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all ${
                  activeTab === "__totals__"
                    ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-md shadow-cyan-200"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${activeTab === "__totals__" ? "bg-white/20" : "bg-cyan-50 text-cyan-600"}`}>
                  ₫
                </span>
                <span>Tổng tiền</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${activeTab === "__totals__" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {moneyComparisons.filter((item) => Math.abs(item.difference) > 0.01).length}
                </span>
              </button>

              {/* Changes tab */}
              <button
                type="button"
                onClick={() => setActiveTab("__changes__")}
                className={`group flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all ${
                  activeTab === "__changes__"
                    ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-200"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-lg ${
                    activeTab === "__changes__"
                      ? "bg-white/20"
                      : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  ✓
                </span>

                <span>Tất cả thay đổi</span>

                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    activeTab === "__changes__"
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {changes.length}
                </span>
              </button>

              {/* Table tabs */}
              {Object.keys(adjusted).map((table) => (
                <button
                  type="button"
                  key={table}
                  onClick={() => setActiveTab(table)}
                  className={`group flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all ${
                    activeTab === table
                      ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-200"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span>{table}</span>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      activeTab === table
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {adjusted[table].length}
                  </span>
                </button>
              ))}
            </div>
          </nav>
        </div>
      )}

      {activeTab === "__totals__" && originalXml1 && (
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-100 bg-gradient-to-r from-cyan-50/70 via-white to-white px-5 py-5 md:px-7">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900">Đối chiếu tổng tiền</h2>
                <p className="mt-1 text-xs text-slate-500">Cộng XML2 và XML3 theo MA_LK, sau đó so với các chỉ tiêu tổng trên XML1.</p>
              </div>
              <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-extrabold ${moneyComparisons.every((item) => Math.abs(item.difference) <= 0.01) ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {moneyComparisons.every((item) => Math.abs(item.difference) <= 0.01) ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                {moneyComparisons.every((item) => Math.abs(item.difference) <= 0.01) ? "KHỚP" : `${moneyComparisons.filter((item) => Math.abs(item.difference) > 0.01).length} CHỈ TIÊU LỆCH`}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-5 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Chỉ tiêu</th>
                  <th className="px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-wide text-blue-600">XML1</th>
                  <th className="px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-wide text-cyan-700">XML2 + XML3</th>
                  <th className="px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Lệch</th>
                  <th className="px-5 py-3 text-center text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {moneyComparisons.map((item) => {
                  const matched = Math.abs(item.difference) <= 0.01;
                  return (
                    <tr key={item.field} className={`border-b transition ${matched ? "border-slate-100 hover:bg-slate-50/50" : "border-amber-100 bg-amber-50/50"}`}>
                      <td className="px-5 py-2.5"><div className="font-bold text-slate-700">{item.field}</div><div className="text-[11px] text-slate-400">{item.label}</div></td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-700">{formatMoney(item.xml1)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-cyan-700">{formatMoney(item.total)}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${matched ? "text-slate-400" : "text-amber-700"}`}>{formatMoney(item.difference)}</td>
                      <td className="px-5 py-2.5 text-center">{matched ? <CheckCircle2 className="mx-auto text-emerald-500" size={18} /> : <AlertTriangle className="mx-auto text-amber-500" size={18} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* =========================================================
          TABLE CONTENT
      ========================================================= */}
      {Object.entries(adjusted).map(([table, rows]) => {
        if (activeTab !== table) return null;

        const originalRows = original[table] || [];
        const selectedIndex = selectedRows[table] ?? 0;
        const selectedRow = rows[selectedIndex];

        const selectedOriginal = selectedRow
          ? matchRow(rows, originalRows, selectedIndex)
          : originalRows[selectedIndex];

        const fields = Array.from(
          new Set([
            ...(selectedOriginal
              ? Object.keys(selectedOriginal)
              : []),
            ...(selectedRow ? Object.keys(selectedRow) : []),
          ])
        );

        /* =========================================================
            XML1
        ========================================================= */
        if (table === "XML1") {
          return (
            <section
              key={table}
              className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.05)]"
            >
              <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50/70 via-white to-white px-5 py-5 md:px-7">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-200">
                      <span className="text-sm font-black">01</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-black text-slate-900">
                          XML1
                        </h2>

                        <span className="text-sm text-slate-400">
                          ·
                        </span>

                        <span className="text-sm font-medium text-slate-500">
                          Tổng hợp
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        Hồ sơ XML1 luôn hiển thị đầy đủ để đối chiếu.
                      </p>
                    </div>
                  </div>

                  <span className="w-fit rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-extrabold text-blue-700 ring-1 ring-blue-100">
                    1 DÒNG
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[1000px] w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      <th className="w-[20%] px-5 py-3.5 text-left text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                        Trường
                      </th>

                      <th className="w-[27%] px-4 py-3.5 text-left text-[11px] font-extrabold uppercase tracking-wide text-emerald-600">
                        Giá trị điều chỉnh
                      </th>

                      <th className="w-[27%] px-4 py-3.5 text-left text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                        Giá trị gốc
                      </th>

                      <th className="w-[26%] px-4 py-3.5 text-left text-[11px] font-extrabold uppercase tracking-wide text-amber-600">
                        Lý do điều chỉnh
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {fields.map((field) => {
                      const changed =
                        normalizeValue(selectedRow?.[field]) !==
                        normalizeValue(selectedOriginal?.[field]);

                      return (
                        <tr
                          key={`${table}-${field}`}
                          className={`border-b transition ${
                            changed
                              ? "border-amber-100 bg-amber-50/50"
                              : "border-slate-100 hover:bg-slate-50/50"
                          }`}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              {changed && (
                                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                              )}

                              <span className="font-bold text-slate-700">
                                {field}
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-2">
                            <input
                              value={selectedRow?.[field] || ""}
                              onChange={(e) =>
                                updateCell(
                                  table,
                                  selectedIndex,
                                  field,
                                  e.target.value
                                )
                              }
                              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:ring-4 ${
                                changed
                                  ? "border-amber-300 bg-white font-bold text-emerald-700 focus:border-emerald-500 focus:ring-emerald-50"
                                  : "border-slate-200 bg-white text-slate-700 focus:border-emerald-400 focus:ring-emerald-50"
                              }`}
                            />
                          </td>

                          <td className="max-w-[280px] px-4 py-3">
                            <div
                              className="truncate rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500"
                              title={String(
                                selectedOriginal?.[field] || ""
                              )}
                            >
                              {selectedOriginal?.[field] || "-"}
                            </div>
                          </td>

                          <td className="px-3 py-2">
                            <input
                              value={
                                changed
                                  ? reasonEdits[field] ??
                                    `Sửa ${field}`
                                  : ""
                              }
                              onChange={(e) =>
                                setReasonEdits((current) => ({
                                  ...current,
                                  [field]: e.target.value,
                                }))
                              }
                              disabled={!changed}
                              placeholder={
                                changed
                                  ? `Nhập lý do sửa ${field}`
                                  : "-"
                              }
                              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 ${
                                changed
                                  ? "border-amber-200 bg-white text-slate-700"
                                  : "border-transparent bg-transparent text-slate-400"
                              }`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        }

        /* =========================================================
            OTHER XML TABLES
        ========================================================= */
        return (
          <section
            key={table}
            className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.05)]"
          >
            {/* Header */}
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-5 md:px-7">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md">
                    <span className="text-xs font-black">
                      {table.replace("XML", "").padStart(2, "0")}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-black text-slate-900">
                        {table}
                      </h2>

                      <span className="text-sm text-slate-400">
                        ·
                      </span>

                      <span className="text-sm font-medium text-slate-500">
                        Chi tiết
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      Chọn một dòng để xem và chỉnh sửa dữ liệu.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-extrabold text-slate-600">
                    {rows.length} DÒNG
                  </span>

                  <span className="hidden rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-extrabold text-blue-600 sm:inline-flex">
                    CÓ THỂ CHỈNH SỬA
                  </span>
                </div>
              </div>
            </div>

            {/* Main split */}
            <div className="grid grid-cols-1 md:grid-cols-[290px_minmax(0,1fr)]">

              {/* LEFT - ROW LIST */}
              <div className="border-b border-slate-100 bg-slate-50/40 p-3 md:border-b-0 md:border-r">
                <div className="mb-2 flex items-center justify-between px-2 py-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Danh sách dòng
                  </span>

                  <span className="text-[10px] font-bold text-slate-400">
                    {rows.length} dòng
                  </span>
                </div>

                <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                  {rows.map((row, rowIndex) => {
                    const isSelected =
                      selectedIndex === rowIndex;

                    const title =
                      row.MA_DICH_VU ||
                      row.MA_THUOC ||
                      row.MA_VAT_TU ||
                      row.MA_LK ||
                      row.STT ||
                      `Hồ sơ ${rowIndex + 1}`;

                    const subtitle =
                      row.TEN_DICH_VU ||
                      row.TEN_THUOC ||
                      row.TEN_VAT_TU ||
                      row.NGAY_YL ||
                      "";

                    return (
                      <button
                        type="button"
                        key={`${table}-row-${rowIndex}`}
                        onClick={() =>
                          setSelectedRows((current) => ({
                            ...current,
                            [table]: rowIndex,
                          }))
                        }
                        className={`group w-full rounded-2xl border p-3.5 text-left transition-all ${
                          isSelected
                            ? "border-blue-300 bg-blue-50 shadow-md shadow-blue-100/50"
                            : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[10px] font-extrabold uppercase tracking-wider ${
                              isSelected
                                ? "text-blue-500"
                                : "text-slate-400"
                            }`}
                          >
                            Dòng {rowIndex + 1}
                          </span>

                          {isSelected && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">
                              ✓
                            </span>
                          )}
                        </div>

                        <div
                          className={`mt-1.5 truncate text-sm font-black ${
                            isSelected
                              ? "text-blue-800"
                              : "text-slate-700"
                          }`}
                          title={String(title)}
                        >
                          {title}
                        </div>

                        <div
                          className="mt-1 truncate text-xs text-slate-500"
                          title={String(subtitle)}
                        >
                          {subtitle || "Không có mô tả"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT - DETAIL */}
              <div className="min-w-0 p-5 md:p-7">
                {selectedRow ? (
                  <>
                    {/* Detail header */}
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-600">
                            {table}
                          </span>

                          <span className="text-slate-300">/</span>

                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Dòng {selectedIndex + 1}
                          </span>
                        </div>

                        <h3 className="text-xl font-black tracking-tight text-slate-900">
                          Chi tiết hồ sơ
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          Các trường được đánh dấu màu vàng là trường
                          đang khác dữ liệu gốc.
                        </p>
                      </div>

                      <span className="flex w-fit items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-extrabold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        CÓ THỂ CHỈNH SỬA
                      </span>
                    </div>

                    {/* Detail table */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <div className="overflow-x-auto">
                        <table className="min-w-[760px] w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/80">
                              <th className="w-[25%] px-4 py-3.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                Trường
                              </th>

                              <th className="w-[40%] px-3 py-3.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
                                Giá trị điều chỉnh
                              </th>

                              <th className="w-[35%] px-4 py-3.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                Giá trị gốc
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {fields.map((field) => {
                              const changed =
                                normalizeValue(
                                  selectedRow[field]
                                ) !==
                                normalizeValue(
                                  selectedOriginal?.[field]
                                );

                              return (
                                <tr
                                  key={`${table}-${selectedIndex}-${field}`}
                                  className={`border-b transition last:border-0 ${
                                    changed
                                      ? "border-amber-100 bg-amber-50/50"
                                      : "border-slate-100 hover:bg-slate-50/50"
                                  }`}
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      {changed && (
                                        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                                      )}

                                      <span className="font-bold text-slate-700">
                                        {field}
                                      </span>
                                    </div>
                                  </td>

                                  <td className="px-3 py-2">
                                    <input
                                      value={
                                        selectedRow[field] || ""
                                      }
                                      onChange={(e) =>
                                        updateCell(
                                          table,
                                          selectedIndex,
                                          field,
                                          e.target.value
                                        )
                                      }
                                      className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:ring-4 ${
                                        changed
                                          ? "border-amber-300 bg-white font-bold text-emerald-700 focus:border-emerald-500 focus:ring-emerald-50"
                                          : "border-slate-200 bg-white text-slate-700 focus:border-emerald-400 focus:ring-emerald-50"
                                      }`}
                                    />
                                  </td>

                                  <td className="px-4 py-3">
                                    <div
                                      className="max-w-[350px] truncate rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500"
                                      title={String(
                                        selectedOriginal?.[
                                          field
                                        ] || ""
                                      )}
                                    >
                                      {selectedOriginal?.[field] ||
                                        "-"}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Changed count */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                      <span className="text-xs font-semibold text-slate-500">
                        Trạng thái đối chiếu
                      </span>

                      <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-extrabold text-amber-700">
                        {
                          fields.filter(
                            (field) =>
                              normalizeValue(
                                selectedRow[field]
                              ) !==
                              normalizeValue(
                                selectedOriginal?.[field]
                              )
                          ).length
                        }{" "}
                        trường thay đổi
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
                      <FileDown size={28} />
                    </div>

                    <h3 className="font-black text-slate-700">
                      Chưa có dữ liệu dòng
                    </h3>

                    <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
                      Chọn một dòng ở danh sách bên trái để xem
                      chi tiết.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}

      {/* =========================================================
          REASON SECTION
      ========================================================= */}
      {activeTab !== "__changes__" &&
        activeTab !== "XML1" && (
          <section className="overflow-hidden rounded-3xl border border-amber-200/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.04)]">

            <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 to-white px-5 py-5 md:px-7">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    !
                  </div>

                  <div>
                    <h2 className="text-sm font-black text-amber-900">
                      Lý do điều chỉnh
                    </h2>

                    <p className="mt-1 text-xs text-amber-700/80">
                      Chỉ hiển thị các trường đang khác giá trị gốc.
                    </p>
                  </div>
                </div>

                <span className="w-fit rounded-full bg-amber-100 px-3 py-1.5 text-[10px] font-extrabold text-amber-700">
                  {changes.filter(
                    (change) => change.table === activeTab
                  ).length}{" "}
                  THAY ĐỔI
                </span>
              </div>
            </div>

            <div className="divide-y divide-amber-100">
              {changes
                .filter((change) => change.table === activeTab)
                .map((change) => (
                  <div
                    key={`reason-${change.table}-${change.field}-${change.stt}`}
                    className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[180px_minmax(180px,1fr)_minmax(280px,1.5fr)] md:items-center md:px-7"
                  >
                    <div>
                      <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Trường
                      </div>

                      <div className="truncate text-sm font-black text-slate-700">
                        {change.field}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Giá trị mới
                      </div>

                      <div
                        className="truncate rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700"
                        title={change.adjusted}
                      >
                        {change.adjusted || "(trống)"}
                      </div>
                    </div>

                    <label className="min-w-0">
                      <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-amber-600">
                        Lý do điều chỉnh
                      </span>

                      <input
                        value={
                          reasonEdits[change.field] ??
                          change.reason
                        }
                        onChange={(e) =>
                          setReasonEdits((current) => ({
                            ...current,
                            [change.field]: e.target.value,
                          }))
                        }
                        placeholder="Nhập lý do điều chỉnh..."
                        className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50"
                      />
                    </label>
                  </div>
                ))}

              {!changes.some(
                (change) => change.table === activeTab
              ) && (
                <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                    ✓
                  </div>

                  <p className="text-sm font-bold text-slate-600">
                    Chưa có thay đổi trong bảng này
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Tất cả dữ liệu hiện đang giống hồ sơ gốc.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

      {/* =========================================================
          ALL CHANGES
      ========================================================= */}
      {activeTab === "__changes__" && (
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.05)]">

          {/* Header */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/70 via-white to-white px-5 py-5 md:px-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-200">
                  ✓
                </div>

                <div>
                  <h2 className="text-base font-black text-slate-900">
                    Các trường đã thay đổi
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Chọn một thay đổi để xem và cập nhật lý do điều chỉnh.
                  </p>
                </div>
              </div>

              <span
                className={`w-fit rounded-full px-3.5 py-1.5 text-[11px] font-extrabold ${
                  changes.length
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                ({changes.length}) THAY ĐỔI
              </span>
            </div>
          </div>

          {changes.length ? (
            <div className="grid min-h-[430px] grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]">

              {/* Change list */}
              <div className="border-b border-slate-100 bg-slate-50/40 p-3 md:border-b-0 md:border-r">
                <div className="mb-2 px-2 py-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Danh sách thay đổi
                  </span>
                </div>

                <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                  {changes.map((change, index) => {
                    const isSelected =
                      selectedChange === change;

                    return (
                      <button
                        type="button"
                        key={`${change.table}-${change.field}-${change.stt}`}
                        onClick={() =>
                          setSelectedChangeIndex(index)
                        }
                        className={`w-full rounded-2xl border p-3.5 text-left transition-all ${
                          isSelected
                            ? "border-emerald-300 bg-emerald-50 shadow-md shadow-emerald-100/50"
                            : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[10px] font-extrabold uppercase tracking-wider ${
                              isSelected
                                ? "text-emerald-600"
                                : "text-slate-400"
                            }`}
                          >
                            #{change.stt} · {change.table}
                          </span>

                          <span
                            className={`h-2 w-2 rounded-full ${
                              isSelected
                                ? "bg-emerald-500"
                                : "bg-amber-400"
                            }`}
                          />
                        </div>

                        <div
                          className={`mt-1.5 truncate text-sm font-black ${
                            isSelected
                              ? "text-emerald-800"
                              : "text-slate-700"
                          }`}
                        >
                          {change.field}
                        </div>

                        <div className="mt-1.5 flex min-w-0 items-center gap-1 text-xs">
                          <span className="min-w-0 truncate text-slate-400">
                            {change.original || "(trống)"}
                          </span>

                          <span className="shrink-0 font-black text-emerald-500">
                            →
                          </span>

                          <span className="min-w-0 truncate font-semibold text-emerald-700">
                            {change.adjusted || "(trống)"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected change */}
              {selectedChange && (
                <div className="min-w-0 bg-white p-5 md:p-8">

                  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
                          {selectedChange.table}
                        </span>

                        <span className="text-xs font-bold text-slate-400">
                          Dòng {selectedChange.stt}
                        </span>
                      </div>

                      <h3 className="break-all text-xl font-black tracking-tight text-slate-900 md:text-2xl">
                        {selectedChange.field}
                      </h3>
                    </div>

                    <span className="flex w-fit items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-extrabold text-amber-700 ring-1 ring-amber-100">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      ĐANG ĐIỀU CHỈNH
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

                    {/* Original */}
                    <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          Giá trị gốc
                        </span>

                        <span className="rounded-md bg-white px-1.5 py-1 text-[9px] font-bold text-slate-400">
                          ORIGINAL
                        </span>
                      </div>

                      <div
                        className="break-words text-sm font-bold leading-6 text-slate-600"
                        title={selectedChange.original}
                      >
                        {selectedChange.original || "(trống)"}
                      </div>
                    </div>

                    {/* Adjusted */}
                    <div className="min-w-0 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
                          Giá trị điều chỉnh
                        </span>

                        <span className="rounded-md bg-emerald-100 px-1.5 py-1 text-[9px] font-bold text-emerald-700">
                          NEW
                        </span>
                      </div>

                      <div
                        className="break-words text-sm font-black leading-6 text-emerald-800"
                        title={selectedChange.adjusted}
                      >
                        {selectedChange.adjusted || "(trống)"}
                      </div>
                    </div>

                    {/* Reason */}
                    <label className="min-w-0 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
                          Lý do điều chỉnh
                        </span>

                        <span className="rounded-md bg-amber-100 px-1.5 py-1 text-[9px] font-bold text-amber-700">
                          REQUIRED
                        </span>
                      </div>

                      <input
                        value={
                          reasonEdits[selectedChange.field] ??
                          selectedChange.reason
                        }
                        onChange={(e) =>
                          setReasonEdits((current) => ({
                            ...current,
                            [selectedChange.field]:
                              e.target.value,
                          }))
                        }
                        placeholder="Nhập lý do điều chỉnh..."
                        className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50"
                      />
                    </label>
                  </div>

                  {/* Comparison arrow */}
                  <div className="mt-5 flex items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                    <span className="text-xs font-bold text-slate-400">
                      Gốc
                    </span>

                    <div className="h-px w-12 bg-slate-200" />

                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-600">
                      →
                    </span>

                    <div className="h-px w-12 bg-slate-200" />

                    <span className="text-xs font-bold text-emerald-600">
                      Điều chỉnh
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center px-5 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
                ✓
              </div>

              <h3 className="text-base font-black text-slate-700">
                Hồ sơ chưa có thay đổi
              </h3>

              <p className="mt-1 max-w-md text-xs leading-5 text-slate-400">
                Không phát hiện trường dữ liệu nào khác với hồ sơ gốc.
              </p>
            </div>
          )}
        </section>
      )}

      {/* =========================================================
          BOTTOM ACTION
      ========================================================= */}
      {activeTab === "__changes__" && (
        <div className="sticky bottom-4 z-30">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-2xl shadow-slate-300/30 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-5">

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                ✓
              </div>

              <div>
                <div className="text-sm font-black text-slate-800">
                  Sẵn sàng xuất hồ sơ
                </div>

                <div className="text-xs text-slate-500">
                  {changes.length
                    ? `${changes.length} trường đang được điều chỉnh`
                    : "Không có trường thay đổi"}
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={restoreOriginal}
                disabled={loading || !originalXml1}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-black text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <span className="text-base">↶</span>
                <span>Đưa về giá trị gốc</span>
              </button>

              <button
                type="button"
                onClick={exportAndSign}
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-600 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:w-auto"
              >
                {loading ? (
                  <>
                    <LoaderCircle className="animate-spin" size={19} />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <FileDown size={19} />
                    <span>Xuất và ký số</span>
                    <span className="text-blue-200 transition-transform group-hover:translate-x-0.5">→</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer spacing */}
      <div className="h-2" />
    </div>
  </div>
);
}
export default DieuChinh09BH;
