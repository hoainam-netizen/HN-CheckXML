import { ChangeEvent, useState } from 'react';
import * as XLSX from 'xlsx';
import { CheckCircle, AlertTriangle, Search, FileUp, Info, ArrowRightLeft, CheckCircle2, ArrowLeftRight, Loader } from 'lucide-react';

type CompareField = 'hoTen' | 'ngaySinh' | 'gioiTinh' | 'ngayVao' | 'ngayRa' | 'maBenh' | 'tongChi' | 'bhThanhToan' | 'bnThanhToan' | 'bncct';
type ColumnMapping = Record<CompareField | 'maThe', { cong: string; noiBo: string }>;
type ExcelRow = Record<string, any>;

interface ErrorDetail {
    field: string;
    congVal: string;
    noiBoVal: string;
}

type ResultRow = ExcelRow & {
    status: 'MATCH' | 'MISMATCH' | 'NOT_FOUND';
    errorDetails: ErrorDetail[];
    rowNoiBo?: ExcelRow;
};

const DoiChieu01BH = () => {
    const MAIN_COLOR = "#3F8A3E";

    const [config] = useState<Record<CompareField, boolean>>({
        hoTen: true, ngaySinh: true, gioiTinh: true, ngayVao: true,
        ngayRa: true, maBenh: true, tongChi: true, bhThanhToan: true, bnThanhToan: true, bncct: true
    });

    const [dataCong, setDataCong] = useState<ExcelRow[]>([]);
    const [dataNoiBo, setDataNoiBo] = useState<ExcelRow[]>([]);
    const [results, setResults] = useState<ResultRow[]>([]);
    const [errorMsg, setErrorMsg] = useState<{ cong?: string; noiBo?: string }>({});
    const configKeys = Object.keys(config) as CompareField[];

    const columnMap: ColumnMapping = {
        hoTen: { cong: 'Họ tên', noiBo: 'HO_TEN' },
        maThe: { cong: 'Mã thẻ', noiBo: 'MA_THE_BHYT' },
        ngaySinh: { cong: 'Ngày sinh', noiBo: 'NGAY_SINH' },
        gioiTinh: { cong: 'Giới tính', noiBo: 'GIOI_TINH' },
        ngayVao: { cong: 'Ngày vào', noiBo: 'NGAY_VAO' },
        ngayRa: { cong: 'Ngày ra', noiBo: 'NGAY_RA' },
        tongChi: { cong: 'Tổng chi', noiBo: 'T_TONGCHI_BV' },
        bhThanhToan: { cong: 'Bảo hiểm TT', noiBo: 'T_BHTT' },
        bnThanhToan: { cong: 'Bệnh nhân TT', noiBo: 'T_BNTT' },
        bncct: { cong: 'Bệnh nhân CCT', noiBo: 'T_BNCCT' },
        maBenh: { cong: 'Chẩn đoán', noiBo: 'MA_BENH_CHINH' },
    };

    const [isComparing, setIsComparing] = useState(false);

    const normalizeGender = (val: unknown): string => {
        const s = String(val ?? '').trim().toLowerCase();
        if (s === '1' || s === 'nam') return 'NAM';
        if (s === '2' || s === 'nữ' || s === 'nu') return 'NỮ';
        return s;
    };

    const parseTimePart = (parts: string[]): [number, number] => {
        let hour = 0;
        let minute = 0;
        if (parts.length >= 4) {
            const timePart = parts[3];
            if (/^\d{4}$/.test(timePart)) {
                hour = parseInt(timePart.substring(0, 2), 10);
                minute = parseInt(timePart.substring(2), 10);
            } else {
                hour = parseInt(timePart, 10);
            }
        }
        if (parts.length >= 5) {
            const minutePart = parseInt(parts[4], 10);
            if (!Number.isNaN(minutePart)) {
                minute = minutePart;
            }
        }
        return [hour, minute];
    };

    const parseDateTimeString = (raw: unknown): string | null => {
        const text = String(raw ?? '').trim();
        if (!text) return null;

        // yyyyMMddHHmm
        if (/^\d{12}$/.test(text)) {
            return text;
        }

        // yyyyMMdd
        if (/^\d{8}$/.test(text)) {
            return text + '0000';
        }

        // Excel serial
        if (/^[0-9]+(?:\.[0-9]+)?$/.test(text)) {
            const num = parseFloat(text);

            const base = new Date(Date.UTC(1899, 11, 30));
            const days = Math.floor(num);
            const millis = Math.round((num - days) * 86400 * 1000);

            const d = new Date(base.getTime() + days * 86400 * 1000 + millis);

            const pad = (v: number) => v.toString().padStart(2, '0');

            return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
        }

        const parts = text.split(/[\s\-./:]+/).filter(Boolean);

        if (parts.length >= 3) {
            let day = 1;
            let month = 1;
            let year = 0;

            if (parts[0].length === 4) {
                year = parseInt(parts[0]);
                month = parseInt(parts[1]);
                day = parseInt(parts[2]);
            } else {
                day = parseInt(parts[0]);
                month = parseInt(parts[1]);
                year = parseInt(parts[2]);
            }

            let hour = 0;
            let minute = 0;

            if (parts.length >= 4) {
                hour = parseInt(parts[3]) || 0;
            }

            if (parts.length >= 5) {
                minute = parseInt(parts[4]) || 0;
            }

            const pad = (v: number) => v.toString().padStart(2, '0');

            return `${year}${pad(month)}${pad(day)}${pad(hour)}${pad(minute)}`;
        }

        return null;
    };

    const getDateVariants = (dateStr: unknown): string[] => {
        const raw = String(dateStr ?? '').trim();
        if (!raw) return [];

        const variants = new Set<string>();
        const canonical = parseDateTimeString(raw);
        if (canonical) variants.add(canonical);

        const parts = raw.split(/[\s\-./:]+/).filter(Boolean);

        // Chỉ đảo ngày tháng khi thực sự cần thiết (ví dụ: cả 2 số đều <= 12)
        // Và chỉ áp dụng cho định dạng có 3 phần (ngày tháng năm)
        if (parts.length >= 3 && parts[0].length !== 4) {
            const p0 = parseInt(parts[0], 10);
            const p1 = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);

            if (p0 <= 12 && p1 <= 12 && p0 !== p1) {
                const pad = (v: number) => v.toString().padStart(2, '0');
                const [hour, minute] = parseTimePart(parts);
                // Thêm biến thể đảo MM/DD/YYYY
                variants.add(`${year}${pad(p0)}${pad(p1)}${pad(hour)}${pad(minute)}`);
            }
        }

        if (variants.size === 0) {
            const digits = raw.replace(/[^0-9]/g, '');
            if (digits) variants.add(digits.padEnd(8, '0').substring(0, 12));
        }

        return Array.from(variants);
    };

    const normalizeDate = (dateStr: unknown, length = 12): string => {
        const variants = getDateVariants(dateStr);
        return variants[0]?.substring(0, Math.min(length, variants[0].length)) ?? "";
    };

    const normalizeDateVariants = (dateStr: unknown, length = 12): string[] => {
        const variants = getDateVariants(dateStr);
        return variants.map((variant) => variant.substring(0, Math.min(length, variant.length)));
    };

    const normalizeSpecialDate = (val: string): string => {
        let cleaned = val.trim();
        // Nếu là dạng 195900000000 hoặc tương tự (độ dài 12)
        if (cleaned.length === 12 && cleaned.includes('0000')) {
            // Lấy 4 số đầu (năm) và thay bằng 0101 (ngày 1 tháng 1) + 4 số cuối (giờ phút)
            return cleaned.substring(0, 4) + '0101' + cleaned.substring(8);
        }
        return cleaned;
    };

    const formatDisplayDate = (value: unknown): string => {
        const text = parseDateTimeString(value);

        if (!text || text.length < 8) return String(value ?? '');

        const yyyy = text.substring(0, 4);
        const MM = text.substring(4, 6);
        const dd = text.substring(6, 8);
        const HH = text.substring(8, 10) || '00';
        const mm = text.substring(10, 12) || '00';

        return `${dd}/${MM}/${yyyy} ${HH}:${mm}`;
    };

    const normalizeNumber = (value: unknown): number | null => {
        const raw = String(value ?? '').trim();
        if (!raw) return null;
        let cleaned = raw.replace(/\s+/g, '');

        if (cleaned.includes('.') && cleaned.includes(',')) {
            cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
        } else if (cleaned.includes('.') && cleaned.split('.').pop()?.length === 3) {
            cleaned = cleaned.replace(/\./g, '');
        } else if (cleaned.includes(',') && cleaned.split(',').pop()?.length === 3) {
            cleaned = cleaned.replace(/,/g, '');
        } else {
            cleaned = cleaned.replace(/,/g, '.');
        }

        const num = Number(cleaned);
        return Number.isFinite(num) ? num : null;
    };

    const formatDisplayNumber = (value: unknown): string => {
        const raw = String(value ?? '').trim();
        const num = normalizeNumber(raw);
        if (num === null) return raw;
        const isInt = Number.isInteger(num);
        return num.toLocaleString('vi-VN', {
            minimumFractionDigits: isInt ? 0 : 2,
            maximumFractionDigits: 2,
        });
    };

    const getDisplayValue = (key: CompareField, value: unknown): string => {
        if (key === 'ngaySinh' || key === 'ngayVao' || key === 'ngayRa') {
            return formatDisplayDate(value);
        }
        if (['tongChi', 'bhThanhToan', 'bnThanhToan', 'bncct'].includes(key)) {
            return formatDisplayNumber(value);
        }
        return String(value ?? '').trim();
    };

    const createCompositeKey = (row: ExcelRow, type: 'CONG' | 'NOI_BO') => {
        const ten = String(row[type === 'CONG' ? 'Họ tên' : 'HO_TEN'] ?? '').trim().toUpperCase();
        const the = String(row[type === 'CONG' ? 'Mã thẻ' : 'MA_THE_BHYT'] ?? '').trim().toUpperCase();
        const vao = normalizeDate(row[type === 'CONG' ? 'Ngày vào' : 'NGAY_VAO'], 12);
        return `${ten}|${the}|${vao}`;
    };

    const handleReadFile = (e: ChangeEvent<HTMLInputElement>, type: 'CONG' | 'NOI_BO') => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = evt.target?.result;
            if (!data) return;
            try {
                const wb = XLSX.read(data, { type: 'array', cellDates: true });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: '' });

                if (jsonData.length === 0) {
                    setErrorMsg({ ...errorMsg, [type === 'CONG' ? 'cong' : 'noiBo']: 'File không có dữ liệu!' });
                    return;
                }

                // Validate columns
                const requiredColumns = type === 'CONG'
                    ? Object.values(columnMap).map(m => m.cong)
                    : Object.values(columnMap).map(m => m.noiBo);

                const firstRow = jsonData[0];
                const fileColumns = Object.keys(firstRow);
                const missingColumns = requiredColumns.filter(col => !fileColumns.includes(col));

                if (missingColumns.length > 0) {
                    setErrorMsg({
                        ...errorMsg,
                        [type === 'CONG' ? 'cong' : 'noiBo']: `File thiếu trường: ${missingColumns.join(', ')}`
                    });
                    return;
                }

                // Clear error if validation passes
                setErrorMsg({ ...errorMsg, [type === 'CONG' ? 'cong' : 'noiBo']: undefined });
                setResults([]);

                if (type === 'CONG') setDataCong(jsonData);
                else setDataNoiBo(jsonData);
            } catch (error) {
                setErrorMsg({
                    ...errorMsg,
                    [type === 'CONG' ? 'cong' : 'noiBo']: 'Lỗi khi đọc file. Vui lòng chọn file Excel hợp lệ!'
                });
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleCompare = () => {
        setResults([]);
        setIsComparing(true);

        // Delay để UI có thể update loading state
        setTimeout(() => {
            const mapNoiBo = new Map(dataNoiBo.map((item) => [createCompositeKey(item, 'NOI_BO'), item]));

            const compareResults = dataCong.map((rowCong) => {
                const keyCong = createCompositeKey(rowCong, 'CONG');
                const rowNoiBo = mapNoiBo.get(keyCong);

                if (!rowNoiBo) {
                    return { ...rowCong, status: 'NOT_FOUND', errorDetails: [] } as ResultRow;
                }

                const errorDetails: ErrorDetail[] = [];
                configKeys.forEach((key) => {
                    if (config[key]) {
                        const rawCong = String(rowCong[columnMap[key].cong] ?? '').trim();
                        const rawNoiBo = String(rowNoiBo[columnMap[key].noiBo] ?? '').trim();

                        let isMatch = true;
                        if (key === 'gioiTinh') {
                            isMatch = normalizeGender(rawCong) === normalizeGender(rawNoiBo);
                            // Trong hàm handleCompare, phần xử lý ['ngaySinh', 'ngayVao', 'ngayRa']
                        } else if (['ngaySinh', 'ngayVao', 'ngayRa'].includes(key)) {
                            const isNgaySinh = key === 'ngaySinh';
                            const isNgayRa = key === 'ngayRa'; // Xác định nếu là ngày ra

                            let vC = normalizeDateVariants(rawCong, 12);
                            let vN = normalizeDateVariants(rawNoiBo, 12);

                            if (isNgaySinh) {
                                vC = vC.map(v => normalizeSpecialDate(v));
                                vN = vN.map(v => normalizeSpecialDate(v));
                            }

                            isMatch = vC.some(dateC => {
                                return vN.some(dateN => {
                                    // 1. Nếu là Ngày Sinh: Chỉ so sánh Năm (nếu thiếu) hoặc 8 số (Ngày tháng năm)
                                    if (isNgaySinh) {
                                        const dC8 = dateC.substring(0, 8);
                                        const dN8 = dateN.substring(0, 8);
                                        if (dC8.endsWith('0101') || dN8.endsWith('0101')) {
                                            return dC8.substring(0, 4) === dN8.substring(0, 4);
                                        }
                                        return dC8 === dN8;
                                    }

                                    // 2. Nếu là Ngày Ra: So sánh đủ 12 ký tự (YYYYMMDDHHmm)
                                    if (isNgayRa) {
                                        return dateC === dateN;
                                    }

                                    // 3. Nếu là Ngày Vào (hoặc các loại khác): Chỉ cần khớp 8 số (Ngày tháng năm)
                                    return dateC.substring(0, 8) === dateN.substring(0, 8);
                                });
                            });
                        } else if (['tongChi', 'bhThanhToan', 'bnThanhToan', 'bncct'].includes(key)) {
                            const nC = normalizeNumber(rawCong);
                            const nN = normalizeNumber(rawNoiBo);
                            isMatch = nC !== null && nN !== null ? nC === nN : rawCong === rawNoiBo;
                        } else {
                            isMatch = rawCong.toUpperCase() === rawNoiBo.toUpperCase();
                        }

                        if (!isMatch) {
                            errorDetails.push({
                                field: columnMap[key].cong,
                                congVal: getDisplayValue(key, rawCong),
                                noiBoVal: getDisplayValue(key, rawNoiBo)
                            });
                        }
                    }

                });

                return {
                    ...rowCong,
                    rowNoiBo,
                    status: errorDetails.length > 0 ? 'MISMATCH' : 'MATCH',
                    errorDetails
                } as ResultRow;
            });

            const sortedResults = [...compareResults].sort((a, b) => {
                const priority = { 'NOT_FOUND': 0, 'MISMATCH': 1, 'MATCH': 2 };
                return priority[a.status] - priority[b.status];
            });

            setResults(sortedResults);
            setIsComparing(false);
        }, 100);
    };

    return (
        <div className="min-h-screen bg-[#f4f7f4] text-slate-800 p-4 font-sans">
            <div className="max-w-[1600px] mx-auto space-y-6">

                {/* HEADER & HƯỚNG DẪN */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border-l-8" style={{ borderColor: MAIN_COLOR }}>
                    <div>
                        <h1 className="text-2xl font-black flex items-center gap-2" style={{ color: MAIN_COLOR }}>
                            <ArrowRightLeft size={28} />
                            HỆ THỐNG ĐỐI CHIẾU DỮ LIỆU BHYT
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">So khớp dữ liệu Cổng giám định và File 01/BH của CSKCB</p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-3 max-w-md">
                        <Info className="text-amber-600 shrink-0" size={20} />
                        <div className="text-[12px] text-amber-800">
                            <b className="block mb-1">HƯỚNG DẪN NHANH:</b>
                            1. Chọn file Excel từ Cổng BHXH và File 01/BH.<br />
                            2. Nhấn "Bắt đầu đối chiếu" để xem kết quả lệch.<br />
                        </div>
                    </div>
                </header>

                {/* KHU VỰC FILE & ĐIỀU KHIỂN */}
                <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-center">
                    {/* File Cổng */}
                    <div className="lg:col-span-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 mb-4 text-blue-700 font-bold">
                            <FileUp size={18} />
                            DỮ LIỆU CỔNG GIÁM ĐỊNH (EXCEL)
                        </div>
                        <input type="file" onChange={(e) => handleReadFile(e, 'CONG')}
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
                        <div className="mt-2 text-[10px] text-slate-400 italic">* Chấp nhận file .xlsx xuất từ cổng</div>
                        {errorMsg.cong && (
                            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                                <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                                <p className="text-red-700 text-[11px]">{errorMsg.cong}</p>
                            </div>
                        )}
                    </div>

                    {/* Nút ở giữa */}
                    <div className="lg:col-span-3 flex flex-col items-center gap-4">
                        <button
                            onClick={handleCompare}
                            disabled={isComparing || !dataCong.length || !dataNoiBo.length || !!errorMsg.cong || !!errorMsg.noiBo}
                            style={{ backgroundColor: MAIN_COLOR }}
                            className="w-full py-4 rounded-xl text-white font-black shadow-lg hover:brightness-110 transition-all active:scale-95 flex items-center justify-center gap-2 text-lg uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isComparing ? <Loader size={24} className="animate-spin" /> : <ArrowLeftRight size={24} />}
                            {isComparing ? 'Đang xử lý...' : 'Bắt đầu đối chiếu'}
                        </button>
                    </div>

                    {/* File Nội bộ */}
                    <div className="lg:col-span-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 mb-4 text-[#3F8A3E] font-bold">
                            <FileUp size={18} />
                            DỮ LIỆU PHẦN MỀM NỘI BỘ (01/BH - EXCEL)
                        </div>
                        <input type="file" onChange={(e) => handleReadFile(e, 'NOI_BO')}
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-[#3F8A3E] hover:file:bg-green-100 cursor-pointer" />
                        <div className="mt-2 text-[10px] text-slate-400 italic">* Dữ liệu xuất từ phần mềm bệnh viện (FILE 01/BH)</div>
                        {errorMsg.noiBo && (
                            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                                <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                                <p className="text-red-700 text-[11px]">{errorMsg.noiBo}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* BẢNG KẾT QUẢ */}
                <section className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-700 uppercase text-sm">Danh sách đối soát chi tiết</h3>
                        {!isComparing && (
                            <div className="flex gap-4 text-xs font-bold">
                                <span className="flex items-center gap-1 text-green-600"><CheckCircle size={14} /> Khớp: {results.filter(r => r.status === 'MATCH').length}</span>
                                <span className="flex items-center gap-1 text-red-600"><AlertTriangle size={14} /> Lệch: {results.filter(r => r.status === 'MISMATCH').length}</span>
                                <span className="flex items-center gap-1 text-amber-600"><Search size={14} /> Không thấy: {results.filter(r => r.status === 'NOT_FOUND').length}</span>
                            </div>
                        )}
                    </div>

                    <div className="overflow-x-auto max-h-[550px]">
                        {isComparing ? (
                            <div className="w-full h-96 flex flex-col items-center justify-center bg-slate-50">
                                <Loader size={48} className="text-slate-400 animate-spin mb-4" />
                                <p className="text-slate-500 font-medium">Đang xử lý dữ liệu...</p>
                                <p className="text-slate-400 text-sm mt-2">Vui lòng chờ</p>
                            </div>
                        ) : (
                            <table className="w-full text-[12px] text-left">
                                <thead className="bg-[#3F8A3E] text-white sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4 w-28 text-center">TRẠNG THÁI</th>
                                        <th className="p-4">THÔNG TIN BỆNH NHÂN</th>
                                        <th className="p-4">CHI TIẾT SAI LỆCH (CỔNG BHXH vs FILE 01/BH)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {results.map((res, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 text-center align-top">
                                                {res.status === 'MATCH' && <span className="inline-block w-20 py-1 bg-green-100 text-green-700 rounded-full font-bold">KHỚP</span>}
                                                {res.status === 'NOT_FOUND' && <span className="inline-block w-20 py-1 bg-amber-100 text-amber-700 rounded-full font-bold">TRỐNG</span>}
                                                {res.status === 'MISMATCH' && <span className="inline-block w-20 py-1 bg-red-100 text-red-700 rounded-full font-bold">LỆCH</span>}
                                            </td>
                                            <td className="p-4 align-top border-r w-1/3">
                                                <div className="font-black text-slate-900 text-sm uppercase">{String(res['Họ tên'] ?? '')}</div>
                                                <div className="text-blue-700 font-mono mt-1">Thẻ: {String(res['Mã thẻ'] ?? '')}</div>
                                                <div className="text-slate-500 mt-1">Vào viện: {getDisplayValue('ngayVao', res['Ngày vào'])}</div>
                                            </td>
                                            <td className="p-4 align-top">
                                                {res.status === 'NOT_FOUND' && <p className="text-amber-600 italic">Bệnh nhân có trên Cổng nhưng không tìm thấy trong dữ liệu Nội bộ (kiểm tra lại Họ tên/Mã thẻ/Ngày vào)</p>}
                                                {res.status === 'MATCH' && <p className="text-green-600">Mọi dữ liệu trùng khớp hoàn toàn.</p>}
                                                {res.status === 'MISMATCH' && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                                                        {res.errorDetails.map((err, i) => (
                                                            <div key={i} className="flex flex-col border-l-2 border-red-200 pl-2">
                                                                <span className="font-bold text-slate-600">{err.field}:</span>
                                                                <div className="flex items-center gap-2 text-[13px]">
                                                                    <span className="text-blue-600 font-medium">{err.congVal || '(Trống)'}</span>
                                                                    <span className="text-slate-300">➜</span>
                                                                    <span className="text-red-600 font-bold">{err.noiBoVal || '(Trống)'}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {results.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="p-20 text-center text-slate-400">
                                                <Search size={48} className="mx-auto mb-4 opacity-20" />
                                                Chưa có dữ liệu đối chiếu. Vui lòng chọn file và nhấn "Bắt đầu".
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>

                <footer className="pt-6 pb-4">

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

                        <div className="flex items-center gap-2">

                        </div>


                        <div className="text-center sm:text-right">

                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Phát triển bởi
                            </p>

                            <p className="mt-0.5 text-xs font-bold text-[#3F8A3E]">
                                Nguyễn Quang Hoài Nam · IT - HCTH
                            </p>

                            <p className="text-[10px] text-slate-400">
                                Phòng khám Đa khoa Đông Hiếu © 2026
                            </p>

                        </div>

                    </div>

                </footer>
            </div>
        </div>
    );
};

export default DoiChieu01BH;