// Helper function để kiểm tra định dạng ngày YYYYMMDD
export const isValidDateYYYYMMDD = (dateStr: string): boolean => {
  if (!/^\d{8}$/.test(dateStr)) return false;
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed in Date object
  const day = parseInt(dateStr.substring(6, 8));
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
};

export const isValidDateNGAY_YL = (dateStr: string): boolean => {
  if (!/^\d{12}$/.test(dateStr)) return false;
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed in Date object
  const day = parseInt(dateStr.substring(6, 8));
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
};

// Helper function để kiểm tra định dạng ngày giờ YYYYMMDDHHmm
export const isValidDateTimeYYYYMMDDHHmm = (dateTimeStr: string): boolean => {
  if (!/^\d{12}$/.test(dateTimeStr)) return false;
  const year = parseInt(dateTimeStr.substring(0, 4));
  const month = parseInt(dateTimeStr.substring(4, 6)) - 1;
  const day = parseInt(dateTimeStr.substring(6, 8));
  const hour = parseInt(dateTimeStr.substring(8, 10));
  const minute = parseInt(dateTimeStr.substring(10, 12));
  const date = new Date(year, month, day, hour, minute);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute
  );
};

// Helper function để so sánh hai ngày YYYYMMDD
export const compareDatesYYYYMMDD = (dateStr1: string, dateStr2: string): number => {
  const d1 = parseInt(dateStr1);
  const d2 = parseInt(dateStr2);
  if (d1 < d2) return -1;
  if (d1 > d2) return 1;
  return 0;
};

// Helper function để so sánh hai ngày giờ YYYYMMDDHHmm
export const compareDateTimesYYYYMMDDHHmm = (dtStr1: string, dtStr2: string): number => {
  const d1 = parseInt(dtStr1);
  const d2 = parseInt(dtStr2);
  if (d1 < d2) return -1;
  if (d1 > d2) return 1;
  return 0;
};

// Các hàm check dùng chung
export function checkPositive(value: string) {
  const f = parseFloat(value);
  return isNaN(f) || f <= 0 ? 'Phải là số > 0.' : null;
}

export function checkNonNegative(value: string) {
  const f = parseFloat(value);
  return isNaN(f) || f < 0 ? 'Phải là số >= 0.' : null;
}

export function parseDateTime(str: string): Date | null {
  if (!/^\d{12}$/.test(str)) return null; // Không đúng định dạng → trả null
  const year = Number(str.substring(0, 4));
  const month = Number(str.substring(4, 6)) - 1; // JS month 0-based
  const day = Number(str.substring(6, 8));
  const hour = Number(str.substring(8, 10));
  const minute = Number(str.substring(10, 12));
  return new Date(year, month, day, hour, minute);
}

// Hàm để lấy ngày/giờ chuẩn hóa (chính xác đến giây)
export function getParsedDateTime(dateTimeString: string | undefined): Date | null {
  if (!dateTimeString || dateTimeString.length < 8) {
    return null;
  }
  const year = parseInt(dateTimeString.substring(0, 4));
  const month = parseInt(dateTimeString.substring(4, 6)) - 1; // Month is 0-indexed
  const day = parseInt(dateTimeString.substring(6, 8));
  let hour = 0;
  let minute = 0;
  let second = 0;

  if (dateTimeString.length >= 12) {
    // YYYYMMDDHHmm
    hour = parseInt(dateTimeString.substring(8, 10));
    minute = parseInt(dateTimeString.substring(10, 12));
    if (dateTimeString.length >= 14) {
      // YYYYMMDDHHmmss
      second = parseInt(dateTimeString.substring(12, 14));
    }
  }
  return new Date(year, month, day, hour, minute, second);
}

export interface PatientInfoContext {
  maLk?: string;
  hoTen?: string;
  ngayVao?: string;
  ngayRa?: string;
  ngaySinh?: string;
  gioiTinh?: string;
  maBenhChinh?: string;
  maBenhKemTheo?: string;
  maBenhYHCT?: string;
  maDkbd?: string;
  maDoiTuong?: string;
  maLoaiKcb?: string;
  maKhoa?: string;
  maCskcb?: string;
  maBn?: string;
}

export function buildPatientInfo(
  record?: Record<string, string>,
  xml1MapByMaLk?: Map<string, Record<string, string>>,
): PatientInfoContext {
  if (!record || typeof record !== 'object') {
    return {
      maLk: undefined,
      hoTen: 'Dữ liệu lỗi',
      ngayVao: 'Dữ liệu lỗi',
      ngayRa: 'Dữ liệu lỗi',
    };
  }

  const maLk = record.MA_LK;
  const xml1Record = maLk ? xml1MapByMaLk?.get(maLk) : undefined;
  const source = xml1Record || record;

  return {
    maLk,
    hoTen: source.HO_TEN || 'N/A',
    ngayVao: source.NGAY_VAO || 'N/A',
    ngayRa: source.NGAY_RA || 'N/A',
    ngaySinh: source.NGAY_SINH,
    gioiTinh: source.GIOI_TINH,
    maBenhChinh: source.MA_BENH_CHINH,
    maBenhKemTheo: source.MA_BENH_KT,
    maBenhYHCT: source.MA_BENH_YHCT,
    maDkbd: source.MA_DKBD,
    maDoiTuong: source.MA_DOITUONG_KCB,
    maLoaiKcb: source.MA_LOAI_KCB,
    maKhoa: source.MA_KHOA,
    maCskcb: source.MA_CSKCB,
    maBn: source.MA_BN,
  };
}

export const doctorYlTimeTrackingMap = new Map<string, Map<string, Set<string>>>();

export function formatDateTime(rawStr?: string): string {
  if (!rawStr || rawStr.length !== 12) return 'Không rõ';

  const year = parseInt(rawStr.slice(0, 4), 10);
  const month = parseInt(rawStr.slice(4, 6), 10) - 1; // tháng bắt đầu từ 0
  const day = parseInt(rawStr.slice(6, 8), 10);
  const hour = parseInt(rawStr.slice(8, 10), 10);
  const minute = parseInt(rawStr.slice(10, 12), 10);

  const date = new Date(year, month, day, hour, minute);
  if (isNaN(date.getTime())) return 'Không hợp lệ';

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(day)}/${pad(month + 1)}/${year} ${pad(hour)}:${pad(minute)}`;
}
