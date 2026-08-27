import {
  checkNonNegative,
  checkPositive,
  compareDatesYYYYMMDD,
  compareDateTimesYYYYMMDDHHmm,
  isValidDateNGAY_YL,
  isValidDateTimeYYYYMMDDHHmm,
  isValidDateYYYYMMDD,
} from './hamHoTro';
import { Facility } from '../interface/danhMucCSKCB';
import { BenhYHCT } from '../interface/danhMucBenhYHCT';
import { ICD10 } from '../interface/danhMucICD10';
import { DanhMucNhanVien } from 'src/views/danhMuc/DanhMucNhanVien';
import { DanhMucThuoc } from 'src/views/danhMuc/DanhMucThuoc';
import { DanhMucTrangThietBi } from 'src/views/danhMuc/DanhMucTrangThietBi';
import { BenhManTinh } from '../interface/danhMucBenhManTinh';

export interface ValidationError {
  sheetName: string;
  rowIndex: number; // Dòng bị lỗi (0-indexed)
  fieldName?: string; // Tên trường bị lỗi
  errorCode: string; // Mã lỗi duy nhất
  errorMessage: string; // Mô tả chi tiết lỗi
  severity: 'error' | 'warning' | 'info'; // Mức độ nghiêm trọng
  topic?: string; // Nhóm chuyên đề/chủ đề kiểm lỗi để phân tầng và render thống nhất
  maLk?: string; // Mã lượt khám liên quan
  hoTen?: string; // Họ tên bệnh nhân liên quan
  ngayVao?: string; // Ngày vào viện của lượt khám
  ngayRa?: string; // Ngày ra viện của lượt khám
  ngaySinh?: string;
  gioiTinh?: string;
  maBenhChinh?: string;
  maBenhKemTheo?: string;
  maBenhYHCT?: string;
  maDkbd?: string;
  maLoaiKcb?: string;
  maKhoa?: string;
  maCskcb?: string;
  maBn?: string;
  extra?: Record<string, string>;
}

export function buildValidationError(
  sheetName: string,
  rowIndex: number,
  fieldName: string | undefined,
  errorCode: string,
  errorMessage: string,
  severity: ValidationError['severity'],
  patientInfo: Partial<ValidationError> = {},
  extra?: Record<string, string>,
  topic?: string,
): ValidationError {
  return {
    sheetName,
    rowIndex,
    fieldName,
    errorCode,
    errorMessage,
    severity,
    topic,
    ...patientInfo,
    ...(extra ? { extra } : {}),
  };
}

export const validationRules: {
  [loaiHoSo: string]: {
    [fieldName: string]: {
      required?: boolean;
      format?: RegExp;
      maxLength?: number;
      lookupTable?: string;
      customValidation?: (
        value: string,
        record: Record<string, string>,
        context?: Record<string, any>,
      ) => string | null;
    };
  };
} = {
  // --- Thiếu dữ liệu bắt buộc XML1
  XML1: {
    MA_LK: { required: true, maxLength: 100 },
    STT: { required: true, maxLength: 10 },
    MA_BN: { required: true, maxLength: 100 },
    HO_TEN: { required: true, maxLength: 255 },
    SO_CCCD: {
      required: false,
      maxLength: 15,
      format: /^\d{9}$|^\d{12}$/,
      customValidation: (value) => {
        if (!value || value.trim() === '') return null;
        const isCccd = /^\d{9}$|^\d{12}$/.test(value);
        const isPassport = /^[A-Za-z]\d{7,8}$/.test(value);
        if (!isCccd && !isPassport) {
          return `Số CCCD/Hộ chiếu "${value}" không hợp lệ (phải là 9 hoặc 12 ký tự số, hoặc hộ chiếu bắt đầu bằng chữ và có 7-8 ký tự số sau đó)`;
        }
        return null;
      },
    },
    NGAY_SINH: {
      required: true,
      maxLength: 12,
      format: /^\d{12}$/,
      customValidation: (value) =>
        isValidDateNGAY_YL(value) ? null : 'Định dạng ngày sinh không hợp lệ.',
    },
    GIOI_TINH: {
      required: true,
      maxLength: 1,
      customValidation: (value) => {
        const v = parseInt(value);
        return isNaN(v) || v < 1 || v > 3 ? 'Phải là số từ 1 đến 3.' : null;
      },
    },
    MA_QUOCTICH: { required: true, maxLength: 3 },
    MA_DANTOC: { required: true, maxLength: 2 },
    MA_NGHE_NGHIEP: { required: true, maxLength: 5 },
    DIA_CHI: { required: true, maxLength: 1024 },
    MATINH_CU_TRU: { required: true, maxLength: 3 },
    MAHUYEN_CU_TRU: { required: false, maxLength: 3 },
    MAXA_CU_TRU: { required: true, maxLength: 5 },
    LY_DO_VV: { required: true },
    CHAN_DOAN_VAO: { required: true },
    CHAN_DOAN_RV: { required: true },
    MA_BENH_CHINH: { required: true, maxLength: 7 },
    MA_DOITUONG_KCB: { required: true, maxLength: 5 },
    NGAY_VAO: {
      required: true,
      maxLength: 12,
      format: /^\d{12}$/,
      customValidation: (value) =>
        isValidDateTimeYYYYMMDDHHmm(value) ? null : 'Ngày vào không hợp lệ.',
    },
    NGAY_RA: {
      required: true,
      maxLength: 12,
      format: /^\d{12}$/,
      customValidation: (value, record) => {
        if (!isValidDateTimeYYYYMMDDHHmm(value)) return 'Ngày ra không hợp lệ.';
        if (record.NGAY_VAO && compareDateTimesYYYYMMDDHHmm(value, record.NGAY_VAO) < 0)
          return 'Ngày ra không được trước ngày vào.';
        return null;
      },
    },
    SO_NGAY_DTRI: {
      required: true,
      maxLength: 3,
      customValidation: (value, record) => {
        const maLoai = record.MA_LOAI_KCB;
        const soNgay = Number(value);
        const nhomMaLoaiNgoaiTru = ['01', '07', '09'];

        // Chiều 1: Nếu thuộc nhóm Ngoại trú (01, 07, 09) thì số ngày bắt buộc phải bằng 0
        if (nhomMaLoaiNgoaiTru.includes(maLoai)) {
          if (soNgay !== 0) {
            return `Số ngày điều trị phải bằng 0 khi MA_LOAI_KCB là ${maLoai}.`;
          }
        }

        // Chiều 2: Nếu số ngày điều trị bằng 0 thì MA_LOAI_KCB bắt buộc phải là 01, 07 hoặc 09
        if (soNgay === 0) {
          if (!nhomMaLoaiNgoaiTru.includes(maLoai)) {
            return `Khi số ngày điều trị bằng 0, MA_LOAI_KCB phải là 01, 07 hoặc 09 (Hiện tại là: ${maLoai}).`;
          }
        }

        return null;
      },
    },
    KET_QUA_DTRI: { required: true, maxLength: 1 },
    MA_LOAI_RV: { required: true, maxLength: 1 },
    T_THUOC: { required: true, maxLength: 15, customValidation: checkNonNegative },
    T_VTYT: { required: true, maxLength: 15, customValidation: checkNonNegative },
    T_TONGCHI_BV: {
      required: true,
      maxLength: 15,
      customValidation: (value, record) => {
        const n = parseFloat(value);
        if (isNaN(n) || n <= 0) return 'Phải > 0.';
        if (record.MA_DOITUONG_KCB === '8' && n <= 0) return 'Phải > 0 với đối tượng KCB là "8".';
        return null;
      },
    },
    T_TONGCHI_BH: { required: true, maxLength: 15, customValidation: checkPositive },
    T_BNTT: { required: true, maxLength: 15, customValidation: checkNonNegative },
    T_BNCCT: { required: true, maxLength: 15, customValidation: checkNonNegative },
    T_BHTT: { required: true, maxLength: 15, customValidation: checkPositive },
    T_NGUONKHAC: { required: true, maxLength: 15, customValidation: checkNonNegative },
    T_BHTT_GDV: { required: true, maxLength: 15, customValidation: checkNonNegative },
    NAM_QT: {
      required: true,
      maxLength: 4,
      format: /^\d{4}$/,
      customValidation: (value) => {
        const y = parseInt(value);
        return isNaN(y) || y < 1900 || y > new Date().getFullYear() + 1
          ? 'Năm quyết toán không hợp lệ.'
          : null;
      },
    },
    THANG_QT: { required: true, maxLength: 2 },
    MA_LOAI_KCB: { required: true, maxLength: 2 },
    MA_KHOA: { required: true, maxLength: 50 },
    MA_CSKCB: { required: true, maxLength: 5 },
    MA_HSBA: { required: true, maxLength: 100 },
    MA_KHUVUC: {
      maxLength: 2,
      customValidation: (value) => {
        if (!value || value.trim() === '') return null; // Cho phép để trống
        const valid = ['K1', 'K2', 'K3'];
        return valid.includes(value.toUpperCase()) ? null : 'Mã khu vực phải là K1, K2 hoặc K3.';
      },
    },

    CAN_NANG: {
      maxLength: 6,
      customValidation: (value) => {
        if (!value) return null;
        const f = parseFloat(value);
        return isNaN(f) || f < 0 || f.toFixed(2) !== value
          ? 'Cân nặng không hợp lệ (số thập phân 2 chữ số).'
          : null;
      },
    },
    CAN_NANG_CON: {
      maxLength: 100,
      customValidation: (value) => {
        if (!value) return null;
        const parts = value.split(';');
        for (const w of parts) {
          const f = parseFloat(w);
          if (isNaN(f) || f < 0 || f.toFixed(2) !== w)
            return 'Cân nặng con không hợp lệ (số thập phân 2 chữ số).';
        }
        return null;
      },
    },
    NGAY_TAI_KHAM: {
      maxLength: 50,
      customValidation: (value, record) => {
        if (!value) return null;
        if (!isValidDateYYYYMMDD(value)) return 'Ngày tái khám không hợp lệ.';
        if (record.NGAY_RA && compareDatesYYYYMMDD(value, record.NGAY_RA.substring(0, 8)) <= 0)
          return 'Phải sau ngày ra viện.';
        return null;
      },
    },

    // Logic đặc biệt
    GT_THE_TU: {
      format: /^\d{8}$/,
      customValidation: (value, record) => {
        if (!value && record.MA_DOITUONG_KCB !== '1') return null;
        if (!isValidDateYYYYMMDD(value)) return 'GT_THE_TU sai định dạng.';
        if (record.NGAY_SINH && compareDatesYYYYMMDD(value + '0000', record.NGAY_SINH) < 0)
          return 'GT_THE_TU phải >= NGAY_SINH.';
        return null;
      },
    },
    GT_THE_DEN: {
      format: /^\d{8}$/,
      customValidation: (value, record) => {
        if (!value && record.MA_DOITUONG_KCB !== '1') return null;
        if (!isValidDateYYYYMMDD(value)) return 'GT_THE_DEN sai định dạng.';
        if (record.GT_THE_TU && compareDatesYYYYMMDD(record.GT_THE_TU, value) >= 0)
          return 'GT_THE_DEN phải > GT_THE_TU.';
        return null;
      },
    },
    NGAY_VAO_NOI_TRU: {
      maxLength: 12,
      customValidation: (value, record) => {
        const loai = record.MA_LOAI_KCB;
        const requireFor = ['03', '04', '06', '09'];
        if (requireFor.includes(loai) && !value)
          return 'NGAY_VAO_NOI_TRU không được rỗng khi MA_LOAI_KCB là 02, 03, 04, 06, hoặc 09.';
        return null;
      },
    },
    LY_DO_VNT: {
      customValidation: (value, record) => {
        const loai = record.MA_LOAI_KCB;
        const requireFor = ['03', '04', '06', '09'];
        if (requireFor.includes(loai) && !value)
          return 'LY_DO_VNT không được rỗng khi MA_LOAI_KCB là 02, 03, 04, 06, hoặc 09.';
        return null;
      },
    },
    MA_NOI_DEN: {
      maxLength: 5,
      customValidation: (value, record) => {
        const loai = record.MA_LOAI_RV;
        if (['2', '5'].includes(loai) && !value) {
          return 'MA_NOI_DEN không được để trống khi MA_LOAI_RV là 2 hoặc 5.';
        }
        return null;
      },
    },
  },

  XML2: {
    MA_LK: { required: true, maxLength: 100 },
    STT: {
      required: true,
      maxLength: 10,
      customValidation: (value: string) => {
        const val = parseInt(value);
        if (isNaN(val) || val <= 0) return 'STT phải là số nguyên dương.';
        return null;
      },
    },
    MA_THUOC: { required: true, maxLength: 255 },
    MA_NHOM: { required: true, maxLength: 2 },
    TEN_THUOC: { required: true, maxLength: 1024 },
    DON_VI_TINH: { required: true, maxLength: 50 },
    DUONG_DUNG: { required: true, maxLength: 4 },
    SO_DANG_KY: { required: true, maxLength: 255 },
    TT_THAU: { required: true, maxLength: 50 },
    PHAM_VI: {
      required: true,
      maxLength: 1,
      customValidation: (value: string) => {
        if (!['1', '2', '3'].includes(value)) return 'PHAM_VI phải từ 1 đến 3.';
        return null;
      },
    },
    TYLE_TT_BH: { required: true, maxLength: 3 },
    SO_LUONG: {
      required: true,
      maxLength: 10,
      customValidation: (value: string) => {
        const val = parseFloat(value);
        if (isNaN(val) || val <= 0) return 'SO_LUONG phải là số > 0.';
        return null;
      },
    },
    DON_GIA: {
      required: true,
      maxLength: 15,
      customValidation: (value: string) => {
        const val = parseFloat(value);
        if (isNaN(val) || val <= 0) return 'DON_GIA phải là số > 0.';
        return null;
      },
    },
    THANH_TIEN_BV: {
      required: true,
      maxLength: 15,
      customValidation: (value: string) => {
        const val = parseFloat(value);
        if (isNaN(val) || val <= 0) return 'THANH_TIEN_BV phải là số > 0.';
        return null;
      },
    },
    THANH_TIEN_BH: {
      required: true,
      maxLength: 15,
      customValidation: (value: string) => {
        const val = parseFloat(value);
        if (isNaN(val) || val <= 0) return 'THANH_TIEN_BH phải là số > 0.';
        return null;
      },
    },
    T_NGUONKHAC_NSNN: {
      required: true,
      maxLength: 15,
      customValidation: (value: string) => {
        const val = parseFloat(value);
        if (isNaN(val) || val < 0) return 'T_NGUONKHAC_NSNN phải >= 0.';
        return null;
      },
    },
    T_NGUONKHAC_VTNN: {
      required: true,
      maxLength: 15,
      customValidation: (value: string) => {
        const val = parseFloat(value);
        if (isNaN(val) || val < 0) return 'T_NGUONKHAC_VTNN phải >= 0.';
        return null;
      },
    },
    T_NGUONKHAC_VTTN: {
      required: true,
      maxLength: 15,
      customValidation: (value: string) => {
        const val = parseFloat(value);
        if (isNaN(val) || val < 0) return 'T_NGUONKHAC_VTTN phải >= 0.';
        return null;
      },
    },
    T_NGUONKHAC_CL: {
      required: true,
      maxLength: 15,
      customValidation: (value: string) => {
        const val = parseFloat(value);
        if (isNaN(val) || val < 0) return 'T_NGUONKHAC_CL phải >= 0.';
        return null;
      },
    },
    T_NGUONKHAC: {
      required: true,
      maxLength: 15,
      customValidation: (value: string) => {
        const val = parseFloat(value);
        if (isNaN(val) || val < 0) return 'T_NGUONKHAC phải >= 0.';
        return null;
      },
    },
    MUC_HUONG: {
      required: true,
      maxLength: 3,
      customValidation: (value: string) => {
        const val = parseFloat(value);
        if (isNaN(val) || val < 0 || val > 100) return 'MUC_HUONG phải từ 0 đến 100.';
        return null;
      },
    },
    T_BNTT: {
      required: true,
      maxLength: 15,
      customValidation: (value: string) => {
        const val = parseFloat(value);
        if (isNaN(val) || val < 0) return 'T_BNTT phải >= 0.';
        return null;
      },
    },
    T_BNCCT: {
      required: true,
      maxLength: 15,
      customValidation: (value: string) => {
        const val = parseFloat(value);
        if (isNaN(val) || val < 0) return 'T_BNCCT phải >= 0.';
        return null;
      },
    },
    T_BHTT: {
      required: true,
      maxLength: 15,
      customValidation: (value: string) => {
        const val = parseFloat(value);
        if (isNaN(val) || val <= 0) return 'T_BHTT phải > 0.';
        return null;
      },
    },
    MA_KHOA: { required: true, maxLength: 15 },
    MA_BAC_SI: { required: true, maxLength: 255 },
    NGAY_YL: {
      required: true,
      maxLength: 12,
      customValidation: (value: string) => {
        if (!/^\d{12}$/.test(value)) return 'NGAY_YL phải đúng định dạng yyyyMMddHHmm.';
        return null;
      },
    },
    MA_PTTT: { required: true, maxLength: 1 },

    // --- Các trường có logic bắt buộc hoặc không bắt buộc nhưng cần kiểm tra ---
    NGUON_CTRA: {
      required: true,
      maxLength: 1,
      customValidation: (value: string) => {
        if (!['1', '2', '3', '4'].includes(value)) return 'NGUON_CTRA phải từ 1 đến 4.';
        return null;
      },
    },
    NGAY_TH_YL: {
      required: false,
      maxLength: 12,
      customValidation: (value: string) => {
        if (value && !/^\d{12}$/.test(value)) return 'NGAY_TH_YL phải đúng định dạng yyyyMMddHHmm.';
        return null;
      },
    },
    VET_THUONG_TP: {
      required: false,
      maxLength: 1,
      customValidation: (value: string) => {
        if (value !== '' && value !== '1') return 'VET_THUONG_TP chỉ được là 1 hoặc để trống.';
        return null;
      },
    },
  },
  XML3: {
    MA_LK: { required: true, maxLength: 100 },
    STT: { required: true, maxLength: 10 },
    MA_DICH_VU: { required: true, maxLength: 50 },
    MA_VAT_TU: { required: false, maxLength: 255 },
    MA_NHOM: { required: true, maxLength: 2 },
    TEN_VAT_TU: { required: false, maxLength: 1024 },
    TEN_DICH_VU: { required: true, maxLength: 1024 },
    DON_VI_TINH: { required: true, maxLength: 50 },
    PHAM_VI: {
      required: true,
      maxLength: 1,
      customValidation: (v) => (!['1', '2', '3'].includes(v) ? 'PHAM_VI phải từ 1 đến 3.' : null),
    },
    SO_LUONG: {
      required: true,
      maxLength: 10,
      customValidation: (v) => (parseFloat(v) > 0 ? null : 'SO_LUONG phải là số > 0.'),
    },
    DON_GIA_BV: {
      required: true,
      maxLength: 15,
      customValidation: (v) => (parseFloat(v) > 0 ? null : 'DON_GIA_BV phải là số > 0.'),
    },
    DON_GIA_BH: {
      required: true,
      maxLength: 15,
      customValidation: (v) => (parseFloat(v) > 0 ? null : 'DON_GIA_BH phải là số > 0.'),
    },
    TT_THAU: {
      maxLength: 100,
      customValidation: (value, record) => {
        if (record.MA_NHOM === '10' && (!value || value.trim() === '')) {
          return 'Trường TT_THAU là bắt buộc khi MA_NHOM = 10.';
        }
        return null;
      },
    },
    TYLE_TT_DV: {
      required: true,
      maxLength: 3,
      customValidation: (v) => {
        const n = parseFloat(v);
        return isNaN(n) || n < 0 || n > 100 ? 'TYLE_TT_DV phải từ 0 đến 100.' : null;
      },
    },
    TYLE_TT_BH: {
      required: true,
      maxLength: 3,
      customValidation: (v) => {
        const n = parseFloat(v);
        return isNaN(n) || n < 0 || n > 100 ? 'TYLE_TT_BH phải từ 0 đến 100.' : null;
      },
    },
    THANH_TIEN_BV: {
      required: true,
      maxLength: 15,
      customValidation: (v) => (parseFloat(v) > 0 ? null : 'THANH_TIEN_BV phải là số > 0.'),
    },
    THANH_TIEN_BH: {
      required: true,
      maxLength: 15,
      customValidation: (v) => (parseFloat(v) > 0 ? null : 'THANH_TIEN_BH phải là số > 0.'),
    },
    MUC_HUONG: {
      required: true,
      maxLength: 3,
      customValidation: (v) => {
        const n = parseFloat(v);
        return isNaN(n) || n < 0 || n > 100 ? 'MUC_HUONG phải từ 0 đến 100.' : null;
      },
    },
    T_NGUONKHAC_NSNN: {
      required: true,
      maxLength: 15,
      customValidation: (v) => (parseFloat(v) >= 0 ? null : 'T_NGUONKHAC_NSNN phải >= 0.'),
    },
    T_NGUONKHAC_VTNN: {
      required: true,
      maxLength: 15,
      customValidation: (v) => (parseFloat(v) >= 0 ? null : 'T_NGUONKHAC_VTNN phải >= 0.'),
    },
    T_NGUONKHAC_VTTN: {
      required: true,
      maxLength: 15,
      customValidation: (v) => (parseFloat(v) >= 0 ? null : 'T_NGUONKHAC_VTTN phải >= 0.'),
    },
    T_NGUONKHAC_CL: {
      required: true,
      maxLength: 15,
      customValidation: (v) => (parseFloat(v) >= 0 ? null : 'T_NGUONKHAC_CL phải >= 0.'),
    },
    T_NGUONKHAC: {
      required: true,
      maxLength: 15,
      customValidation: (v) => (parseFloat(v) >= 0 ? null : 'T_NGUONKHAC phải >= 0.'),
    },
    T_BNTT: {
      required: true,
      maxLength: 15,
      customValidation: (v) => (parseFloat(v) >= 0 ? null : 'T_BNTT phải >= 0.'),
    },
    T_BNCCT: {
      required: true,
      maxLength: 15,
      customValidation: (v) => (parseFloat(v) >= 0 ? null : 'T_BNCCT phải >= 0.'),
    },
    T_BHTT: {
      required: true,
      maxLength: 15,
      customValidation: (v) => (parseFloat(v) > 0 ? null : 'T_BHTT phải > 0.'),
    },
    MA_KHOA: { required: true, maxLength: 20 },
    MA_BAC_SI: { required: true, maxLength: 255 },
    NGAY_YL: {
      required: true,
      maxLength: 12,
      customValidation: (v) =>
        /^\d{12}$/.test(v) ? null : 'NGAY_YL phải đúng định dạng yyyyMMddHHmm.',
    },
    MA_PTTT: {
      required: true,
      maxLength: 1,
      customValidation: (v) => (['1', '2', '3'].includes(v) ? null : 'MA_PTTT phải từ 1 đến 3.'),
    },

    MA_XANG_DAU: {
      maxLength: 20,
      customValidation: (value, record) => {
        if (record.MA_NHOM === '12' && !value) {
          return 'MA_XANG_DAU không được để trống khi MA_NHOM = 12.';
        }
        return null;
      },
    },
    NGUOI_THUC_HIEN: {
      maxLength: 255,
      customValidation: (value, record) => {
        if (['1', '2', '3', '8', '18'].includes(record.MA_NHOM) && !value) {
          return 'NGUOI_THUC_HIEN không được để trống khi MA_NHOM là 1, 2, 3, 8, 18.';
        }
        return null;
      },
    },
    NGAY_TH_YL: {
      required: false,
      maxLength: 12,
      customValidation: (value, record) => {
        const isRequired = ['1', '2', '3', '8', '18'].includes(record.MA_NHOM);
        if (isRequired && !value) {
          return 'NGAY_TH_YL không được để trống khi MA_NHOM là 1, 2, 3, 8, 18.';
        }
        if (value && !/^\d{12}$/.test(value)) {
          return 'NGAY_TH_YL phải đúng định dạng yyyyMMddHHmm.';
        }
        return null;
      },
    },
    NGAY_KQ: {
      required: false,
      maxLength: 12,
      customValidation: (value, record) => {
        const isRequired = ['1', '2', '3', '8', '18'].includes(record.MA_NHOM);
        if (isRequired && !value) {
          return 'NGAY_KQ không được để trống khi MA_NHOM là 1, 2, 3, 8, 18.';
        }
        if (value && !/^\d{12}$/.test(value)) {
          return 'NGAY_KQ phải đúng định dạng yyyyMMddHHmm.';
        }
        return null;
      },
    },
    MA_GIUONG: {
      maxLength: 50,
      customValidation: (value, record) => {
        if (record.MA_NHOM === '15' && !value)
          return 'MA_GIUONG không được để trống khi MA_NHOM = 15.';
        if (value) {
          const codes = value.split(';');
          const regex = /^[HTCK]\d{3}$/;
          for (const code of codes) {
            if (!regex.test(code.trim()))
              return 'Mỗi MA_GIUONG phải đúng định dạng H/T/C/K + 3 số.';
          }
        }
        return null;
      },
    },
    MA_BENH_YHCT: {
      maxLength: 255,
      customValidation: (value, record) => {
        if (record.MA_NHOM === '13' && record.MA_DICH_VU?.startsWith('08.') && !value) {
          return `Trường MA_BENH_YHCT không được để trống`;
        }
        return null;
      },
    },
    VET_THUONG_TP: {
      required: false,
      maxLength: 1,
      customValidation: (v) =>
        v !== '' && v !== '1' ? 'VET_THUONG_TP chỉ được là 1 hoặc rỗng.' : null,
    },
    PP_VO_CAM: {
      required: false,
      maxLength: 1,
      customValidation: (v) => {
        if (!v) return null;
        return ['1', '2', '3', '4'].includes(v) ? null : 'PP_VO_CAM phải từ 1 đến 4 hoặc rỗng.';
      },
    },
    TAI_SU_DUNG: {
      required: false,
      maxLength: 1,
      customValidation: (v) => (v && v !== '1' ? 'TAI_SU_DUNG chỉ được là 1 hoặc rỗng.' : null),
    },
  },
  XML4: {
    MA_LK: { required: true, maxLength: 100 },
    STT: { required: true, maxLength: 10 },
    NGAY_KQ: {
      required: true,
      maxLength: 12,
      customValidation: (value) => {
        if (!/^\d{12}$/.test(value)) return 'NGAY_KQ phải đúng định dạng yyyyMMddHHmm.';
        return null;
      },
    },
    TEN_CHI_SO: { required: false, maxLength: 255 },
    MA_BS_DOC_KQ: { required: true, maxLength: 255 },

    // --- Các trường khác có giới hạn độ dài ---
    MA_DICH_VU: { required: false, maxLength: 50 },
    MA_CHI_SO: { required: false, maxLength: 50 },
    GIA_TRI: { required: false, maxLength: 255 },
    DON_VI_DO: { required: false, maxLength: 50 },
    MO_TA: { required: false },
    DU_PHONG: { required: false },

    KET_LUAN: {
      required: false,
      customValidation: (value, record, context) => {
        const maLk = record.MA_LK;
        if (!maLk || !context?.xml3MapByMaLk) return null;

        const xml3List = context.xml3MapByMaLk.get(maLk);
        if (!xml3List) return null;

        interface Xml3Record {
          MA_NHOM?: string;
          [key: string]: string | undefined;
        }
        const hasNhom2: boolean = (xml3List as Xml3Record[]).some(
          (r: Xml3Record) =>
            r.MA_NHOM === '2' && r.MA_DICH_VU === record.MA_DICH_VU,
        );
        if (hasNhom2 && !value) {
          return 'KET_LUAN không được để trống nếu có MA_NHOM = 2 trong XML3.';
        }
        return null;
      },
    },
  },

  XML5: {
    MA_LK: { required: true, maxLength: 100 },
    STT: { required: true, maxLength: 10 },
    DIEN_BIEN_LS: { required: true },
    THOI_DIEM_DBLS: {
      required: true,
      maxLength: 12,
      customValidation: (value) => {
        if (!/^\d{12}$/.test(value)) {
          return 'THOI_DIEM_DBLS phải đúng định dạng yyyyMMddHHmm.';
        }
        return null;
      },
    },
    NGUOI_THUC_HIEN: { required: true, maxLength: 255 },

    GIAI_DOAN_BENH: { required: false },
    HOI_CHAN: { required: false },
    PHAU_THUAT: { required: false },
    DU_PHONG: { required: false },
  },

  XML6: {
    MA_LK: { required: true, maxLength: 100 },
    MA_LYDO_DTRI: { required: true, maxLength: 1 },
    LOAI_DTRI_LAO: { required: true, maxLength: 1 },
    MA_LOAI_BN: { required: true, maxLength: 1 },
    MA_TINH_TRANG_DK: { required: true, maxLength: 18 },
    MA_XU_TRI: { required: true, maxLength: 1 },

    // Nếu LOAI_DTRI_LAO != 0
    PHACDO_DTRI_LAO: {
      required: false,
      maxLength: 2,
      customValidation: (value, record) => {
        if (record.LOAI_DTRI_LAO !== '0' && !value) {
          return 'PHACDO_DTRI_LAO không được để trống khi LOAI_DTRI_LAO ≠ 0.';
        }
        return null;
      },
    },
    NGAYBD_DTRI_LAO: {
      required: false,
      maxLength: 8,
      customValidation: (value, record) => {
        if (record.LOAI_DTRI_LAO !== '0' && !value) {
          return 'NGAYBD_DTRI_LAO không được để trống khi LOAI_DTRI_LAO ≠ 0.';
        }
        return null;
      },
    },
    NGAYKT_DTRI_LAO: {
      required: false,
      maxLength: 8,
      customValidation: (value, record) => {
        if (record.LOAI_DTRI_LAO !== '0' && !value) {
          return 'NGAYKT_DTRI_LAO không được để trống khi LOAI_DTRI_LAO ≠ 0.';
        }
        return null;
      },
    },

    // Nếu MA_TINH_TRANG_DK = 1
    LAN_XN_PCR: {
      required: false,
      maxLength: 1,
      customValidation: (value, record) => {
        if (record.MA_TINH_TRANG_DK === '1' && !value) {
          return 'LAN_XN_PCR không được để trống khi MA_TINH_TRANG_DK = 1.';
        }
        return null;
      },
    },
    NGAY_XN_PCR: {
      required: false,
      maxLength: 8,
      customValidation: (value, record) => {
        if (record.MA_TINH_TRANG_DK === '1' && !value) {
          return 'NGAY_XN_PCR không được để trống khi MA_TINH_TRANG_DK = 1.';
        }
        return null;
      },
    },
    NGAY_KQ_XN_PCR: {
      required: false,
      maxLength: 8,
      customValidation: (value, record) => {
        if (record.MA_TINH_TRANG_DK === '1' && !value) {
          return 'NGAY_KQ_XN_PCR không được để trống khi MA_TINH_TRANG_DK = 1.';
        }
        return null;
      },
    },
    MA_KQ_XN_PCR: {
      required: false,
      maxLength: 1,
      customValidation: (value, record) => {
        if (record.MA_TINH_TRANG_DK === '1' && !value) {
          return 'MA_KQ_XN_PCR không được để trống khi MA_TINH_TRANG_DK = 1.';
        }
        return null;
      },
    },

    // Nếu MA_XU_TRI = 1
    NGAY_BAT_DAU_XU_TRI: {
      required: false,
      maxLength: 8,
      customValidation: (value, record) => {
        if (record.MA_XU_TRI === '1' && !value) {
          return 'NGAY_BAT_DAU_XU_TRI không được để trống khi MA_XU_TRI = 1.';
        }
        return null;
      },
    },
    NGAY_KET_THUC_XU_TRI: {
      required: false,
      maxLength: 8,
      customValidation: (value, record) => {
        if (record.MA_XU_TRI === '1' && !value) {
          return 'NGAY_KET_THUC_XU_TRI không được để trống khi MA_XU_TRI = 1.';
        }
        return null;
      },
    },
    SO_NGAY_CAP_THUOC_ARV: {
      required: false,
      maxLength: 3,
      customValidation: (value, record) => {
        if (record.MA_XU_TRI === '1' && !value) {
          return 'SO_NGAY_CAP_THUOC_ARV không được để trống khi MA_XU_TRI = 1.';
        }
        return null;
      },
    },
  },
  XML7: {
    MA_LK: { required: true, maxLength: 100 },
    MA_YTE: { required: true, maxLength: 200 },
    MA_KHOA_RV: { required: true, maxLength: 200 },
    NGAY_VAO: {
      required: true,
      maxLength: 12,
      customValidation: (v) =>
        !/^\d{12}$/.test(v) ? 'NGAY_VAO phải đúng định dạng yyyyMMddHHmm.' : null,
    },
    NGAY_RA: {
      required: true,
      maxLength: 12,
      customValidation: (v) =>
        !/^\d{12}$/.test(v) ? 'NGAY_RA phải đúng định dạng yyyyMMddHHmm.' : null,
    },
    MA_DINH_CHI_THAI: { required: true, maxLength: 1 },
    NGUYENNHAN_DINHCHI: {
      required: false,
      customValidation: (v, r) =>
        r.MA_DINH_CHI_THAI === '1' && !v
          ? 'NGUYENNHAN_DINHCHI không được để trống nếu MA_DINH_CHI_THAI = 1.'
          : null,
    },
    THOIGIAN_DINHCHI: {
      required: false,
      maxLength: 12,
      customValidation: (v, r) =>
        r.MA_DINH_CHI_THAI === '1' && !v
          ? 'THOIGIAN_DINHCHI không được để trống nếu MA_DINH_CHI_THAI = 1.'
          : null,
    },
    TUOI_THAI: {
      required: false,
      maxLength: 2,
      customValidation: (v, r) =>
        r.MA_DINH_CHI_THAI === '1' && !v
          ? 'TUOI_THAI không được để trống nếu MA_DINH_CHI_THAI = 1.'
          : null,
    },
    CHAN_DOAN_RV: { required: true, maxLength: 1500 },
    PP_DIEUTRI: { required: true, maxLength: 1500 },
    MA_TTDV: { required: true, maxLength: 225 },
    MA_BS: { required: true, maxLength: 200 },
    TEN_BS: { required: true, maxLength: 255 },
    NGAY_CT: {
      required: true,
      maxLength: 8,
      customValidation: (v) =>
        !/^\d{8}$/.test(v) ? 'NGAY_CT phải đúng định dạng yyyyMMdd.' : null,
    },
    SO_NGAY_NGHI: {
      maxLength: 2,
      customValidation: (value, record) => {
        const hasAny =
          !!(value && value.trim()) ||
          !!(record.NGOAITRU_TUNGAY && record.NGOAITRU_TUNGAY.trim()) ||
          !!(record.NGOAITRU_DENNGAY && record.NGOAITRU_DENNGAY.trim());

        const missingFields = [];
        if (hasAny) {
          if (!value || value.trim() === '') missingFields.push('SO_NGAY_NGHI');
          if (!record.NGOAITRU_TUNGAY || record.NGOAITRU_TUNGAY.trim() === '')
            missingFields.push('NGOAITRU_TUNGAY');
          if (!record.NGOAITRU_DENNGAY || record.NGOAITRU_DENNGAY.trim() === '')
            missingFields.push('NGOAITRU_DENNGAY');
        }

        if (missingFields.length > 0) {
          return `Trường ${missingFields.join(
            ', ',
          )} là bắt buộc khi một trong ba trường nghỉ ngoại trú có dữ liệu.`;
        }

        return null;
      },
    },
    NGOAITRU_TUNGAY: {
      required: false,
      maxLength: 8,
    },
    NGOAITRU_DENNGAY: {
      required: false,
      maxLength: 8,
    },

    // --- Trường khác (không bắt buộc nhưng có maxLength) ---
    SO_LUU_TRU: { required: false, maxLength: 200 },
    GHI_CHU: { required: false, maxLength: 1500 },
    MA_CHA: { required: false, maxLength: 10 },
    MA_ME: { required: false, maxLength: 10 },
    MA_THE_TAM: { required: false, maxLength: 15 },
    HO_TEN_CHA: { required: false, maxLength: 255 },
    HO_TEN_ME: { required: false, maxLength: 255 },
    DU_PHONG: { required: false, maxLength: 4000 },
  },
  XML8: {
    MA_LK: { required: true, maxLength: 100 },
    MA_LOAI_KCB: { required: true, maxLength: 2 },
    NGAY_VAO: {
      required: true,
      maxLength: 12,
      customValidation: (v) =>
        !/^\d{12}$/.test(v) ? 'NGAY_VAO phải đúng định dạng yyyyMMddHHmm.' : null,
    },
    NGAY_RA: {
      required: true,
      maxLength: 12,
      customValidation: (v) =>
        !/^\d{12}$/.test(v) ? 'NGAY_RA phải đúng định dạng yyyyMMddHHmm.' : null,
    },
    CHAN_DOAN_VAO: { required: true },
    CHAN_DOAN_RV: { required: true },
    QT_BENHLY: { required: true },
    TOMTAT_KQ: { required: true },
    PP_DIEUTRI: { required: true },
    KET_QUA_DTRI: { required: true, maxLength: 1 },
    MA_TTDV: { required: true, maxLength: 225 },
    NGAY_CT: {
      required: true,
      maxLength: 8,
      customValidation: (v) =>
        !/^\d{8}$/.test(v) ? 'NGAY_CT phải đúng định dạng yyyyMMdd.' : null,
    },

    // --- Các trường không bắt buộc nhưng có giới hạn độ dài ---
    HO_TEN_CHA: { required: false, maxLength: 255 },
    HO_TEN_ME: { required: false, maxLength: 255 },
    NGUOI_GIAM_HO: { required: false, maxLength: 255 },
    DON_VI: { required: false, maxLength: 1024 },
    NGAY_SINHCON: {
      required: false,
      maxLength: 8,
      customValidation: (v) =>
        v && !/^\d{8}$/.test(v) ? 'NGAY_SINHCON phải đúng định dạng yyyyMMdd.' : null,
    },
    NGAY_CONCHET: {
      required: false,
      maxLength: 8,
      customValidation: (v) =>
        v && !/^\d{8}$/.test(v) ? 'NGAY_CONCHET phải đúng định dạng yyyyMMdd.' : null,
    },
    SO_CONCHET: { required: false, maxLength: 2 },
    GHI_CHU: { required: false },
    MA_THE_TAM: { required: false, maxLength: 15 },
    DU_PHONG: { required: false },
  },
  XML9: {
    MA_LK: { required: true, maxLength: 100 },
    HO_TEN_NND: { required: true, maxLength: 255 },
    NGAYSINH_NND: {
      required: true,
      maxLength: 8,
      customValidation: (v) =>
        !/^\d{8}$/.test(v) ? 'NGAYSINH_NND phải đúng định dạng yyyyMMdd.' : null,
    },
    MA_DANTOC_NND: { required: true, maxLength: 2 },
    SO_CCCD_NND: { required: true, maxLength: 15 },
    NGAYCAP_CCCD_NND: {
      required: true,
      maxLength: 8,
      customValidation: (v) =>
        !/^\d{8}$/.test(v) ? 'NGAYCAP_CCCD_NND phải đúng định dạng yyyyMMdd.' : null,
    },
    NOICAP_CCCD_NND: { required: true, maxLength: 1024 },
    NOI_CU_TRU_NND: { required: true, maxLength: 1024 },
    MA_QUOCTICH: { required: true, maxLength: 3 },
    MATINH_CU_TRU: { required: true, maxLength: 3 },
    MAHUYEN_CU_TRU: { required: false, maxLength: 3 },
    MAXA_CU_TRU: { required: true, maxLength: 5 },
    HO_TEN_CHA: { required: true, maxLength: 255 },
    MA_THE_TAM: { required: true, maxLength: 15 },
    HO_TEN_CON: { required: true, maxLength: 255 },
    GIOI_TINH_CON: { required: true, maxLength: 1 },
    SO_CON: { required: true, maxLength: 2 },
    LAN_SINH: { required: true, maxLength: 2 },
    SO_CON_SONG: { required: true, maxLength: 2 },
    CAN_NANG_CON: { required: true, maxLength: 10 },
    NGAY_SINH_CON: {
      required: true,
      maxLength: 12,
      customValidation: (v) =>
        !/^\d{12}$/.test(v) ? 'NGAY_SINH_CON phải đúng định dạng yyyyMMddHHmm.' : null,
    },
    NOI_SINH_CON: { required: true, maxLength: 1024 },
    TINH_TRANG_CON: { required: true },
    SINHCON_PHAUTHUAT: { required: true, maxLength: 1 },
    SINHCON_DUOI32TUAN: { required: true, maxLength: 1 },
    NGUOI_DO_DE: { required: true, maxLength: 255 },
    NGUOI_GHI_PHIEU: { required: true, maxLength: 255 },
    NGAY_CT: {
      required: true,
      maxLength: 8,
      customValidation: (v) =>
        !/^\d{8}$/.test(v) ? 'NGAY_CT phải đúng định dạng yyyyMMdd.' : null,
    },
    SO: { required: true, maxLength: 200 },
    QUYEN_SO: { required: true, maxLength: 200 },
    MA_TTDV: { required: true, maxLength: 225 },

    // --- Các trường không bắt buộc nhưng có maxLength ---
    MA_BHXH_NND: { required: false, maxLength: 10 },
    MA_THE_NND: { required: false, maxLength: 15 },
    GHI_CHU: { required: false },
    DU_PHONG: { required: false, maxLength: 4000 },
  },
  XML10: {
    MA_LK: { required: true, maxLength: 100 },
    SO_SERI: { required: true, maxLength: 200 },
    SO_CT: { required: true, maxLength: 200 },
    SO_NGAY: { required: true, maxLength: 3 },
    DON_VI: { required: true, maxLength: 1024 },
    CHAN_DOAN_RV: { required: true },
    TU_NGAY: {
      required: true,
      maxLength: 8,
      customValidation: (v) =>
        !/^\d{8}$/.test(v) ? 'TU_NGAY phải đúng định dạng yyyyMMdd.' : null,
    },
    DEN_NGAY: {
      required: true,
      maxLength: 8,
      customValidation: (v) =>
        !/^\d{8}$/.test(v) ? 'DEN_NGAY phải đúng định dạng yyyyMMdd.' : null,
    },
    MA_TTDV: { required: true, maxLength: 225 },
    TEN_BS: { required: true, maxLength: 255 },
    MA_BS: { required: true, maxLength: 200 },
    NGAY_CT: {
      required: true,
      maxLength: 8,
      customValidation: (v) =>
        !/^\d{8}$/.test(v) ? 'NGAY_CT phải đúng định dạng yyyyMMdd.' : null,
    },

    // --- Trường không bắt buộc ---
    DU_PHONG: { required: false, maxLength: 4000 },
  },
  XML11: {
    MA_LK: { required: true, maxLength: 100 },
    SO_CT: { required: true, maxLength: 200 },
    SO_SERI: { required: true, maxLength: 200 },
    SO_KCB: { required: true, maxLength: 200 },
    DON_VI: { required: true, maxLength: 1024 },
    MA_BHXH: { required: true, maxLength: 10 },
    CHAN_DOAN_RV: { required: true },
    PP_DIEUTRI: { required: true },
    SO_NGAY_NGHI: { required: true, maxLength: 3 },
    TU_NGAY: {
      required: true,
      maxLength: 8,
      customValidation: (v) =>
        !/^\d{8}$/.test(v) ? 'TU_NGAY phải đúng định dạng yyyyMMdd.' : null,
    },
    DEN_NGAY: {
      required: true,
      maxLength: 8,
      customValidation: (v) =>
        !/^\d{8}$/.test(v) ? 'DEN_NGAY phải đúng định dạng yyyyMMdd.' : null,
    },
    MA_TTDV: { required: true, maxLength: 225 },
    MA_BS: { required: true, maxLength: 200 },
    NGAY_CT: {
      required: true,
      maxLength: 8,
      customValidation: (v) =>
        !/^\d{8}$/.test(v) ? 'NGAY_CT phải đúng định dạng yyyyMMdd.' : null,
    },

    NGUYENNHAN_DINHCHI: {
      required: false,
      maxLength: 1024,
      customValidation: (value, record) => {
        if (record.MA_DINH_CHI_THAI === '1' && (!value || value.trim() === '')) {
          return "Trường 'NGUYENNHAN_DINHCHI' là bắt buộc nếu MA_DINH_CHI_THAI = 1.";
        }
        return null;
      },
    },
    TUOI_THAI: {
      required: false,
      maxLength: 2,
      customValidation: (value, record) => {
        if (record.MA_DINH_CHI_THAI === '1' && (!value || value.trim() === '')) {
          return "Trường 'TUOI_THAI' là bắt buộc nếu MA_DINH_CHI_THAI = 1.";
        }
        return null;
      },
    },

    // --- Các trường không bắt buộc khác ---
    MA_THE_BHYT: { required: false },
    MA_THE_TAM: { required: false, maxLength: 15 },
    MA_DINH_CHI_THAI: { required: false, maxLength: 1 },
    MAU_SO: { required: false, maxLength: 5 },
    HO_TEN_CHA: { required: false, maxLength: 255 },
    HO_TEN_ME: { required: false, maxLength: 255 },
    DU_PHONG: { required: false, maxLength: 4000 },
  },
  XML13: {
    MA_LK: { required: true, maxLength: 250 },
    SO_HOSO: { required: true, maxLength: 100 },
    SO_CHUYENTUYEN: { required: true, maxLength: 100 },
    GIAY_CHUYEN_TUYEN: { required: true, maxLength: 100 },
    HO_TEN: { required: true, maxLength: 255 },
    DAU_HIEU_LS: { required: true, maxLength: 4000 },
    QT_BENHLY: { required: true, maxLength: 4000 },
    TEN_DICH_VU: { required: true, maxLength: 1024 },
    MA_LYDO_CT: { required: true, maxLength: 1 },
    HUONG_DIEU_TRI: { required: true, maxLength: 4000 },
    PHUONGTIEN_VC: { required: true, maxLength: 255 },
    MA_BAC_SI: { required: true, maxLength: 255 },
    MA_TTDV: { required: true, maxLength: 225 },

    // --- Các trường không bắt buộc ---
    MA_CSKCB: { required: false, maxLength: 5 },
    MA_NOI_DI: { required: false, maxLength: 5 },
    MA_NOI_DEN: { required: false, maxLength: 5 },
    NGAY_SINH: {
      required: false,
      maxLength: 12,
      customValidation: (v) =>
        v && !/^\d{8,12}$/.test(v)
          ? 'NGAY_SINH phải đúng định dạng yyyyMMdd hoặc yyyyMMddHHmm.'
          : null,
    },
    GIOI_TINH: { required: false, maxLength: 1 },
    MA_QUOCTICH: { required: false, maxLength: 3 },
    MA_DANTOC: { required: false, maxLength: 2 },
    MA_NGHE_NGHIEP: { required: false, maxLength: 5 },
    DIA_CHI: { required: false, maxLength: 1024 },
    MA_THE_BHYT: { required: false, maxLength: 200 },
    GT_THE_DEN: { required: false, maxLength: 200 },
    NGAY_VAO: { required: false, maxLength: 12 },
    NGAY_VAO_NOI_TRU: { required: false, maxLength: 12 },
    NGAY_RA: { required: false, maxLength: 12 },
    CHAN_DOAN_RV: { required: false, maxLength: 4000 },
    TOMTAT_KQ: { required: false, maxLength: 4000 },
    PP_DIEUTRI: { required: false, maxLength: 4000 },
    MA_BENH_CHINH: { required: false, maxLength: 50 },
    MA_BENH_KT: { required: false, maxLength: 200 },
    MA_BENH_YHCT: { required: false, maxLength: 255 },
    TEN_THUOC: { required: false, maxLength: 1024 },
    PP_DIEU_TRI: { required: false, maxLength: 4000 },
    MA_LOAI_RV: { required: false, maxLength: 1 },
    HOTEN_NGUOI_HT: { required: false, maxLength: 255 },
    CHUCDANH_NGUOI_HT: { required: false, maxLength: 255 },
    DU_PHONG: { required: false, maxLength: 4000 },
  },
  XML14: {
    MA_LK: { required: true, maxLength: 200 },
    SO_GIAYHEN_KL: { required: true, maxLength: 100 },
    MA_CSKCB: { required: true, maxLength: 5 },
    HO_TEN: { required: true, maxLength: 255 },
    NGAY_HEN_KL: {
      required: true,
      maxLength: 8,
      customValidation: (v) =>
        !/^\d{8}$/.test(v) ? 'NGAY_HEN_KL phải đúng định dạng yyyyMMdd.' : null,
    },
    MA_BAC_SI: { required: true, maxLength: 255 },
    MA_TTDV: { required: true, maxLength: 225 },
    NGAY_CT: {
      required: true,
      maxLength: 8,
      customValidation: (v) =>
        !/^\d{8}$/.test(v) ? 'NGAY_CT phải đúng định dạng yyyyMMdd.' : null,
    },

    // --- Các trường không bắt buộc ---
    NGAY_SINH: {
      required: false,
      maxLength: 12,
      customValidation: (v) =>
        v && !/^\d{8,12}$/.test(v)
          ? 'NGAY_SINH phải đúng định dạng yyyyMMdd hoặc yyyyMMddHHmm.'
          : null,
    },
    GIOI_TINH: { required: false, maxLength: 1 },
    DIA_CHI: { required: false, maxLength: 1024 },
    MA_THE_BHYT: { required: false, maxLength: 200 },
    GT_THE_DEN: { required: false, maxLength: 200 },
    NGAY_VAO: { required: false, maxLength: 12 },
    NGAY_VAO_NOI_TRU: { required: false, maxLength: 12 },
    NGAY_RA: { required: false, maxLength: 12 },
    CHAN_DOAN_RV: { required: false, maxLength: 4000 },
    MA_BENH_CHINH: { required: false, maxLength: 50 },
    MA_BENH_KT: { required: false, maxLength: 200 },
    MA_BENH_YHCT: { required: false, maxLength: 255 },
    MA_DOITUONG_KCB: { required: false, maxLength: 10 },
    DU_PHONG: { required: false, maxLength: 4000 },
  },
  XML15: {
    MA_LK: { required: true, maxLength: 200 },
    MA_BN: { required: true, maxLength: 200 },
    PHANLOAI_LAO_VITRI: { required: true, maxLength: 1 },
    PHANLOAI_LAO_TS: { required: true, maxLength: 1 },
    PHANLOAI_LAO_HIV: { required: true, maxLength: 1 },
    PHANLOAI_LAO_VK: { required: true, maxLength: 1 },
    LOAI_DTRI_LAO: { required: true, maxLength: 1 },
    NGAYBD_DTRI_LAO: {
      required: true,
      maxLength: 8,
      customValidation: (v) =>
        !/^\d{8}$/.test(v) ? 'NGAYBD_DTRI_LAO phải đúng định dạng yyyyMMdd.' : null,
    },
    PHACDO_DTRI_LAO: { required: true, maxLength: 2 },
    KET_QUA_DTRI_LAO: { required: true, maxLength: 1 },

    // --- Các trường không bắt buộc ---
    STT: { required: false, maxLength: 10 },
    HO_TEN: { required: false, maxLength: 255 },
    SO_CCCD: { required: false, maxLength: 15 },
    PHANLOAI_LAO_KT: { required: false, maxLength: 1 },
    NGAYKT_DTRI_LAO: {
      required: false,
      maxLength: 8,
      customValidation: (v) =>
        v && !/^\d{8}$/.test(v) ? 'NGAYKT_DTRI_LAO phải đúng định dạng yyyyMMdd.' : null,
    },
    MA_CSKCB: { required: false, maxLength: 5 },
    NGAYKD_HIV: {
      required: false,
      maxLength: 8,
      customValidation: (v) =>
        v && !/^\d{8}$/.test(v) ? 'NGAYKD_HIV phải đúng định dạng yyyyMMdd.' : null,
    },
    BDDT_ARV: {
      required: false,
      maxLength: 8,
      customValidation: (v) =>
        v && !/^\d{8}$/.test(v) ? 'BDDT_ARV phải đúng định dạng yyyyMMdd.' : null,
    },
    NGAY_BAT_DAU_DT_CTX: {
      required: false,
      maxLength: 8,
      customValidation: (v) =>
        v && !/^\d{8}$/.test(v) ? 'NGAY_BAT_DAU_DT_CTX phải đúng định dạng yyyyMMdd.' : null,
    },
    DU_PHONG: { required: false, maxLength: 4000 },
  },
};

export function validateXml1RecordRules(
  record: Record<string, string>,
  rowIndex: number,
  patientInfo: Partial<ValidationError>,
  errors: ValidationError[],
  cskcbList: Facility[],
  validYhctCodes: BenhYHCT[],
  validBenhManTinh: BenhManTinh[],
  icd10List: ICD10[],
): void {
  const maDkbd = record.MA_DKBD?.trim();
  const maNoiDi = record.MA_NOI_DI?.trim();
  const maNoiDen = record.MA_NOI_DEN?.trim();
  const maTam = record.MA_TAM?.trim();
  const isMaCoSoValid = (maCoSo: string | undefined): boolean =>
    cskcbList.some((cskcb) => cskcb.MA_CSKCB === maCoSo);

  if (maDkbd && !isMaCoSoValid(maDkbd)) {
    errors.push(
      buildValidationError(
        'XML1',
        rowIndex,
        'MA_DKBD',
        'Mã CSKCB không tồn tại trong danh mục',
        `Mã cơ sở đăng ký ban đầu "${maDkbd}" không tồn tại trong danh mục.`,
        'error',
        patientInfo,
        undefined,
        'quy-tac',
      ),
    );
  }

  if (maNoiDi && !isMaCoSoValid(maNoiDi)) {
    errors.push(
      buildValidationError(
        'XML1',
        rowIndex,
        'MA_NOI_DI',
        'Mã CSKCB không tồn tại trong danh mục',
        `Mã cơ sở nơi đi "${maNoiDi}" không tồn tại trong danh mục.`,
        'error',
        patientInfo,
        undefined,
        'quy-tac',
      ),
    );
  }

  if (maNoiDen && !isMaCoSoValid(maNoiDen)) {
    errors.push(
      buildValidationError(
        'XML1',
        rowIndex,
        'MA_NOI_DEN',
        'Mã CSKCB không tồn tại trong danh mục',
        `Mã cơ sở nơi đến "${maNoiDen}" không tồn tại trong danh mục.`,
        'error',
        patientInfo,
        undefined,
        'quy-tac',
      ),
    );
  }

  if (maTam && !isMaCoSoValid(maTam)) {
    errors.push(
      buildValidationError(
        'XML1',
        rowIndex,
        'MA_TAM',
        'Mã CSKCB không tồn tại trong danh mục',
        `Mã tạm "${maTam}" không tồn tại trong danh mục.`,
        'error',
        patientInfo,
        undefined,
        'quy-tac',
      ),
    );
  }

  if (record.MA_BENH_YHCT) {
    const maBenhYhctList = record.MA_BENH_YHCT.split(';')
      .map((m) => m.trim())
      .filter(Boolean);

    for (const code of maBenhYhctList) {
      const isValid = validYhctCodes.some((item) => item.Ma_YHCT === code);
      if (!isValid) {
        errors.push(
          buildValidationError(
            'XML1',
            rowIndex,
            'MA_BENH_YHCT',
            'Lỗi Mã bệnh YHCT ngoài danh mục',
            `Lỗi Mã bệnh YHCT ngoài danh mục: mã "${code}" không nằm trong danh mục hợp lệ.`,
            'error',
            patientInfo,
            undefined,
            'quy-tac',
          ),
        );
      }
    }
  }

  if (record.MA_BENH_CHINH && record.MA_LOAI_KCB !== '01') {
    const maBenhChinh = record.MA_BENH_CHINH.trim();
    const isChronic = validBenhManTinh.some((item) => {
      const icdList = item.mabenh_icd10
        .split(';')
        .map((code) => code.trim())
        .filter(Boolean);
      return icdList.includes(maBenhChinh);
    });

    if (isChronic) {
      if (record.MA_LOAI_KCB !== '05' && record.MA_LOAI_KCB !== '08') {
        errors.push(
          buildValidationError(
            'XML1',
            rowIndex,
            'MA_BENH_CHINH',
            'Sai mã loại KCB (Bệnh mãn tính)',
            `Bệnh mãn tính (${maBenhChinh}) mã loại KCB phải là 05 hoặc 08.`,
            'error',
            patientInfo,
            undefined,
            'quy-tac',
          ),
        );
      }
    } else if (record.MA_LOAI_KCB !== '01' && record.MA_LOAI_KCB !== '02') {
      errors.push(
        buildValidationError(
          'XML1',
          rowIndex,
          'MA_BENH_CHINH',
          'Sai mã loại KCB (Bệnh thường)',
          `Bệnh thường (${maBenhChinh}) mã loại KCB = 02 đối với BA Ngoại trú.`,
          'error',
          patientInfo,
          undefined,
          'quy-tac',
        ),
      );
    }
  }

  const maBenhCheck = ['MA_BENH_CHINH', 'MA_BENH_KT'];
  for (const field of maBenhCheck) {
    const rawValue = record[field];
    if (rawValue) {
      const codes = rawValue.split(';').map((m) => m.trim()).filter(Boolean);
      for (const code of codes) {
        const isValid = icd10List.some((item) => item.Ma_Benh === code);
        if (!isValid) {
          errors.push(
            buildValidationError(
              'XML1',
              rowIndex,
              field,
              'Lỗi Mã bệnh ICD10 ngoài danh mục',
              `Lỗi Mã bệnh ICD10 ngoài danh mục XML1: Mã "${code}" không nằm trong danh mục hợp lệ.`,
              'error',
              patientInfo,
              undefined,
              'quy-tac',
            ),
          );
        }
      }
    }
  }
}

export function validateXml2RecordRules(
  record: Record<string, string>,
  rowIndex: number,
  patientInfo: Partial<ValidationError>,
  errors: ValidationError[],
  drugCatalogMap: DanhMucThuoc[],
  doctorMap: DanhMucNhanVien[],
): void {
  const maThuoc = record.MA_THUOC?.trim();
  const tenThuoc = record.TEN_THUOC?.trim();
  if (maThuoc) {
    const matchedEntries = drugCatalogMap.filter((entry) => entry.MA_THUOC === maThuoc);
    if (matchedEntries.length === 0) {
      errors.push(
        buildValidationError(
          'XML2',
          rowIndex,
          'MA_THUOC',
          'Mã thuốc không tồn tại trong danh mục',
          `Mã thuốc '${maThuoc}' không tồn tại trong danh mục thuốc của Cổng BHYT.`,
          'error',
          patientInfo,
          undefined,
          'quy-tac',
        ),
      );
    }

    const normalize = (v: string | undefined) => (v || '').toLowerCase().trim();
    const matchingTenThuoc = matchedEntries.filter(
      (entry) => normalize(entry.TEN_THUOC) === normalize(tenThuoc),
    );
    if (matchingTenThuoc.length === 0 && tenThuoc) {
      errors.push(
        buildValidationError(
          'XML2',
          rowIndex,
          'TEN_THUOC',
          'Tên thuốc không đúng theo danh mục',
          `Tên thuốc '${record.TEN_THUOC}' không có trong danh mục ứng với mã thuốc '${maThuoc}'.`,
          'error',
          patientInfo,
          undefined,
          'quy-tac',
        ),
      );
    }
  }

  const doctors = new Map<string, DanhMucNhanVien>();
  for (const entry of doctorMap) {
    if (entry.MACCHN) {
      const key = entry.MACCHN.replace(/\s/g, '').toUpperCase();
      doctors.set(key, entry);
    }
  }

  const maBacSi = record.MA_BAC_SI?.trim();
  if (maBacSi) {
    const entry = doctors.get(maBacSi.trim());
    if (!entry) {
      errors.push(
        buildValidationError(
          'XML2',
          rowIndex,
          'MA_BAC_SI',
          'MA_BAC_SI không tồn tại trong danh mục',
          `MA_BAC_SI '${maBacSi}' không tồn tại trong danh mục.`,
          'error',
          patientInfo,
          undefined,
          'quy-tac',
        ),
      );
    } else if (entry.CHUCDANH_NN !== '1' && entry.CHUCDANH_NN !== '2') {
      errors.push(
        buildValidationError(
          'XML2',
          rowIndex,
          'MA_BAC_SI',
          'Chức danh bác sĩ không hợp lệ',
          `Mã bác sĩ '${maBacSi}' có chức danh không phù hợp để thực hiện khám và cấp thuốc (CHUCDANH_NN = '${entry.CHUCDANH_NN}'). Chỉ chấp nhận chức danh có mã 1 hoặc 2.`,
          'error',
          patientInfo,
          undefined,
          'quy-tac',
        ),
      );
    }
  }
}

export function validateXml3RecordRules(
  record: Record<string, string>,
  rowIndex: number,
  patientInfo: Partial<ValidationError>,
  errors: ValidationError[],
  doctorMap: DanhMucNhanVien[],
  tbytMap: DanhMucTrangThietBi[],
): void {
  const field = 'TT_THAU';
  const rawValue = record[field];
  if (rawValue) {
    const value = String(rawValue).trim();
    const regex = /^\s*([^;]+);G([0-9]);N([0-6]);(\d{4})(?:;(\d{2}|\d{5}))?\s*$/;

    if (!regex.test(value)) {
      errors.push(
        buildValidationError(
          'XML3',
          rowIndex,
          field,
          'Lỗi TT_THAU VTYT',
          'Sai cấu trúc TT_THAU (VTYT)',
          'error',
          patientInfo,
          { TT_THAU: value },
          'chuyen-de',
        ),
      );
    }
  }

  const maMayRaw = record.MA_MAY;
  if (maMayRaw != null) {
    const value = String(maMayRaw).trim();
    if (value !== '') {
      const regex = /^(?:[A-ZÀ-Ỹ]{2,3})\.(?:1|2|3(?:\[[^\[\]]+\])?)\.[A-Za-z0-9\-\/_]+(?:;[A-Za-z0-9\-\/_]+)*$/;
      if (!regex.test(value)) {
        errors.push(
          buildValidationError(
            'XML3',
            rowIndex,
            'MA_MAY',
            'Lỗi cấu trúc MA_MAY',
            `Sai cấu trúc MA_MAY: "${value}"`,
            'error',
            patientInfo,
            { MA_MAY: value },
            'chuyen-de',
          ),
        );
      }
    }
  }

  const tbytCatalog = new Map<string, DanhMucTrangThietBi>();
  for (const entry of tbytMap) {
    if (entry.MA_MAY) {
      tbytCatalog.set(entry.MA_MAY.trim(), entry);
    }
  }
  const maMay = record.MA_MAY?.trim();
  if (maMay) {
    const tbEntry = tbytCatalog.get(maMay);
    if (!tbEntry) {
      errors.push(
        buildValidationError(
          'XML3',
          rowIndex,
          'MA_MAY',
          'Thiết bị không tồn tại trong danh mục',
          `MA_MAY '${maMay}' không tồn tại trong danh mục Trang thiết bị.`,
          'error',
          patientInfo,
          undefined,
          'chuyen-de',
        ),
      );
    }
  }

  const maNhom = record.MA_NHOM?.toString().trim();
  const allowedMaNhom = ['1', '2', '3', '8', '10', '12', '13', '14', '15', '18'];
  if (!maNhom || !allowedMaNhom.includes(maNhom)) {
    errors.push(
      buildValidationError(
        'XML3',
        rowIndex,
        'MA_NHOM',
        'Lỗi MA_NHOM chi phí ngoài danh mục',
        'Lỗi MA_NHOM chi phí ngoài danh mục',
        'error',
        patientInfo,
        undefined,
        'chuyen-de',
      ),
    );
  }

  const doctorList: DanhMucNhanVien[] = doctorMap;
  const doctors = new Map<string, DanhMucNhanVien>();
  for (const entry of doctorList) {
    if (entry.MACCHN) {
      const key = entry.MACCHN.replace(/\s/g, '').toUpperCase();
      doctors.set(key, entry);
    }
  }

  const maBacSi = record.MA_BAC_SI?.trim();
  if (maBacSi) {
    const entry = doctors.get(maBacSi.trim());
    if (!entry) {
      errors.push(
        buildValidationError(
          'XML3',
          rowIndex,
          'MA_BAC_SI',
          'MA_BAC_SI không tồn tại trong danh mục',
          `MA_BAC_SI '${maBacSi}' không tồn tại trong danh mục.`,
          'error',
          patientInfo,
          undefined,
          'chuyen-de',
        ),
      );
    } else if (entry.CHUCDANH_NN !== '1' && entry.CHUCDANH_NN !== '2') {
      errors.push(
        buildValidationError(
          'XML3',
          rowIndex,
          'MA_BAC_SI',
          'Chức danh bác sĩ không hợp lệ',
          `Mã bác sĩ '${maBacSi}' có chức danh không phù hợp để thực hiện khám và cấp thuốc (CHUCDANH_NN = '${entry.CHUCDANH_NN}'). Chỉ chấp nhận chức danh có mã 1 hoặc 2.`,
          'error',
          patientInfo,
          undefined,
          'chuyen-de',
        ),
      );
    }
  }

  const nguoiThucHien = record.NGUOI_THUC_HIEN;
  if (nguoiThucHien) {
    const nguoiThuHienList = nguoiThucHien
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const nguoi of nguoiThuHienList) {
      if (!doctors.has(nguoi)) {
        errors.push(
          buildValidationError(
            'XML3',
            rowIndex,
            'NGUOI_THUC_HIEN',
            'MA_NGUOI_THUC_HIEN không tồn tại trong danh mục',
            `Mã người thực hiện '${nguoi}' không tồn tại trong danh mục.`,
            'error',
            patientInfo,
            undefined,
            'chuyen-de',
          ),
        );
      }
    }
  }
}
