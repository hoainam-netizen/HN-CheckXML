import { TuongTacThuoc } from '../interface/danhMucTuongTacThuoc';
import {
  buildPatientInfo,
  compareDateTimesYYYYMMDDHHmm,
  formatDateTime,
  getParsedDateTime,
  parseDateTime,
} from './hamHoTro';
import {
  buildValidationError,
  ValidationError,
  validationRules,
  validateXml1RecordRules,
  validateXml2RecordRules,
  validateXml3RecordRules,
} from './kiemQuyTac';
import { TienKham } from '../interface/danhMucTienKham';
import { DanhMucNhanVien } from 'src/views/danhMuc/DanhMucNhanVien';
import { DanhMucTrangThietBi } from 'src/views/danhMuc/DanhMucTrangThietBi';
import { DanhMucChongChiDinhThuoc } from 'src/views/danhMuc/DanhMucChongChiDinhThuoc';
import { DanhMucThoiGianThucHienDVKT } from 'src/views/danhMuc/DanhMucThoiGianThucHienDVKT';
import { KhungGio } from 'src/views/danhMuc/DanhMucGioHanhChinh';
import { MucHuong } from '../interface/danhMucMucHuong';
import { CauHinhDichVu } from 'src/views/danhMuc/DanhMucCauHinhDVKT';
import {
  EXTERNAL_CAUSE_PREFIXES,
  FEMALE_SPECIFIC_PREFIXES,
  ICD10_CODES_REQUIRING_SPECIFIC_SUBCODE,
  ICD10_DISCOURAGED_AS_PRINCIPAL_DIAGNOSIS,
  ICD10_NOT_ALLOWED_AS_PRINCIPAL_DIAGNOSIS,
  MALE_SPECIFIC_PREFIXES,
} from '../interface/icd';
import { Facility } from '../interface/danhMucCSKCB';
import { BenhYHCT } from '../interface/danhMucBenhYHCT';
import { ICD10 } from '../interface/danhMucICD10';
import { DanhMucThuoc } from 'src/views/danhMuc/DanhMucThuoc';
import { BenhManTinh } from '../interface/danhMucBenhManTinh';

export type { ValidationError } from './kiemQuyTac';
export {
  buildValidationError,
  validationRules,
  validateXml1RecordRules,
  validateXml2RecordRules,
  validateXml3RecordRules,
} from './kiemQuyTac';

export function validateRecord(
  loaiHoSo: string,
  record: Record<string, string>,
  rowIndex: number,
  xml1MapByMaLk: Map<string, Record<string, string>>,
  cskcbList: Facility[],
  drugCatalogMap: DanhMucThuoc[],
  doctorMap: DanhMucNhanVien[],
  tbytMap: DanhMucTrangThietBi[],
  validYhctCodes: BenhYHCT[],
  validBenhManTinh: BenhManTinh[],
  icd10List: ICD10[],
  xml3MapByMaLk?: Map<string, Record<string, string>[]>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const rules = validationRules[loaiHoSo];

  if (!rules) {
    errors.push(
      buildValidationError(
        loaiHoSo,
        rowIndex,
        '',
        'NO_RULES_DEFINED',
        `Không tìm thấy quy tắc kiểm tra cho loại hồ sơ "${loaiHoSo}"`,
        'warning',
        {},
        undefined,
        'quy-tac',
      ),
    );
    return errors;
  }

  const patientInfo = buildPatientInfo(record, xml1MapByMaLk);

  const recordHandlers: Record<string, () => void> = {
    XML1: () => {
      validateXml1RecordRules(
        record,
        rowIndex,
        patientInfo,
        errors,
        cskcbList,
        validYhctCodes,
        icd10List,
      );
    },
    XML2: () => {
      validateXml2RecordRules(record, rowIndex, patientInfo, errors, drugCatalogMap, doctorMap);
    },
    XML3: () => {
      validateXml3RecordRules(record, rowIndex, patientInfo, errors, doctorMap, tbytMap);
    },
  };

  recordHandlers[loaiHoSo]?.();

  for (const fieldName in rules) {
    const fieldRule = rules[fieldName];
    const fieldValueRaw = record[fieldName];
    const fieldValue = fieldValueRaw?.toString().trim() ?? '';
    const isEmpty = fieldValue === '';

    if (fieldRule.required && isEmpty) {
      errors.push(
        buildValidationError(
          loaiHoSo,
          rowIndex,
          fieldName,
          'Thiếu dữ liệu bắt buộc',
          `Trường "${fieldName}" là bắt buộc nhưng không có dữ liệu.`,
          'error',
          patientInfo,
          undefined,
          'quy-tac',
        ),
      );
      continue;
    }

    if (!fieldRule.required && isEmpty && !fieldRule.customValidation) {
      continue;
    }

    if (fieldRule.maxLength !== undefined && fieldValue.length > fieldRule.maxLength) {
      errors.push(
        buildValidationError(
          loaiHoSo,
          rowIndex,
          fieldName,
          'Vượt quá độ dài tối đa',
          `Trường "${fieldName}" vượt quá độ dài tối đa ${fieldRule.maxLength}. Giá trị: "${fieldValue}" (${fieldValue.length} ký tự).`,
          'error',
          patientInfo,
          undefined,
          'quy-tac',
        ),
      );
    }

    if (fieldRule.format && !fieldRule.customValidation && !fieldRule.format.test(fieldValue)) {
      errors.push(
        buildValidationError(
          loaiHoSo,
          rowIndex,
          fieldName,
          'Sai định dạng quy định',
          `Trường "${fieldName}" có định dạng không hợp lệ. Giá trị: "${fieldValue}".`,
          'error',
          patientInfo,
          undefined,
          'quy-tac',
        ),
      );
    }

    if (fieldRule.customValidation) {
      const customError = fieldRule.customValidation(fieldValue, record, { xml3MapByMaLk });
      if (customError) {
        errors.push(
          buildValidationError(
            loaiHoSo,
            rowIndex,
            fieldName,
            'Lỗi kiểm tra tùy chỉnh',
            customError,
            'error',
            patientInfo,
            undefined,
            'quy-tac',
          ),
        );
      }
    }
  }

  if (loaiHoSo === 'XML2') {
    const value = record.MA_NHOM?.toString().trim();
    const allowedValues = ['4', '7', '17'];

    if (!value || !allowedValues.includes(value)) {
      errors.push({
        sheetName: 'XML2',
        rowIndex,
        fieldName: 'MA_NHOM',
        errorCode: 'Lỗi MA_NHOM chi phí ngoài danh mục',
        errorMessage: 'Lỗi MA_NHOM chi phí ngoài danh mục: chỉ chấp nhận các giá trị 4, 7, 17.',
        severity: 'error',
        ...patientInfo,
      });
    }
  }

  if (loaiHoSo === 'XML1') {
    const maDkbd = record.MA_DKBD;
    const maNoiDi = record.MA_NOI_DI;
    const maNoiDen = record.MA_NOI_DEN;
    const maTam = record.MA_TAM;

    const isMaCoSoValid = (maCoSo: string | undefined): boolean =>
      cskcbList.some((cskcb) => cskcb.MA_CSKCB === maCoSo);

    if (maDkbd && !isMaCoSoValid(maDkbd)) {
      errors.push({
        sheetName: 'XML1',
        rowIndex,
        fieldName: 'MA_DKBD',
        errorCode: 'Mã CSKCB không tồn tại trong danh mục',
        errorMessage: `Mã cơ sở đăng ký ban đầu "${maDkbd}" không tồn tại trong danh mục.`,
        severity: 'error',
        ...patientInfo,
      });
    }

    if (maNoiDi && !isMaCoSoValid(maNoiDi)) {
      errors.push({
        sheetName: 'XML1',
        rowIndex,
        fieldName: 'MA_NOI_DI',
        errorCode: 'Mã CSKCB không tồn tại trong danh mục',
        errorMessage: `Mã cơ sở nơi đi "${maNoiDi}" không tồn tại trong danh mục.`,
        severity: 'error',
        ...patientInfo,
      });
    }

    if (maNoiDen && !isMaCoSoValid(maNoiDen)) {
      errors.push({
        sheetName: 'XML1',
        rowIndex,
        fieldName: 'MA_NOI_DEN',
        errorCode: 'Mã CSKCB không tồn tại trong danh mục',
        errorMessage: `Mã cơ sở nơi đến "${maNoiDen}" không tồn tại trong danh mục.`,
        severity: 'error',
        ...patientInfo,
      });
    }

    if (maTam && !isMaCoSoValid(maTam)) {
      errors.push({
        sheetName: 'XML1',
        rowIndex,
        fieldName: 'MA_TAM',
        errorCode: 'Mã CSKCB không tồn tại trong danh mục',
        errorMessage: `Mã tạm "${maTam}" không tồn tại trong danh mục.`,
        severity: 'error',
        ...patientInfo,
      });
    }
  }

  const doctorList: DanhMucNhanVien[] = doctorMap;
  const doctors = new Map<string, DanhMucNhanVien>();
  const bsDocKQ = new Map<string, DanhMucNhanVien>();

  for (const entry of doctorList) {
    if (entry.MACCHN) {
      const key = entry.MACCHN.replace(/\s/g, '').toUpperCase();
      doctors.set(key, entry);
      bsDocKQ.set(key, entry);
    }
  }

  const pushError = (
    sheetName: string,
    fieldName: string,
    errorCode: string,
    errorMessage: string,
    severity: ValidationError['severity'] = 'error',
    topic = 'quy-tac',
  ) => {
    errors.push(
      buildValidationError(
        sheetName,
        rowIndex,
        fieldName,
        errorCode,
        errorMessage,
        severity,
        patientInfo,
        undefined,
        topic,
      ),
    );
  };

  const recordSpecificChecks: Record<string, () => void> = {
    XML1: () => {
      const value = record.MA_LOAI_KCB?.toString().trim();
      const allowedValues = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
      if (!value || !allowedValues.includes(value)) {
        pushError(
          'XML1',
          'MA_LOAI_KCB',
          'Lỗi MA_LOAI_KCB ngoài danh mục',
          'Lỗi MA_LOAI_KCB ngoài danh mục: chỉ chấp nhận các giá trị từ 01 đến 10.',
        );
      }

      const maDkbd = record.MA_DKBD;
      const maNoiDi = record.MA_NOI_DI;
      const maNoiDen = record.MA_NOI_DEN;
      const maTam = record.MA_TAM;
      const isMaCoSoValid = (maCoSo: string | undefined): boolean =>
        cskcbList.some((cskcb) => cskcb.MA_CSKCB === maCoSo);

      if (maDkbd && !isMaCoSoValid(maDkbd)) {
        pushError(
          'XML1',
          'MA_DKBD',
          'Mã CSKCB không tồn tại trong danh mục',
          `Mã cơ sở đăng ký ban đầu "${maDkbd}" không tồn tại trong danh mục.`,
        );
      }
      if (maNoiDi && !isMaCoSoValid(maNoiDi)) {
        pushError(
          'XML1',
          'MA_NOI_DI',
          'Mã CSKCB không tồn tại trong danh mục',
          `Mã cơ sở nơi đi "${maNoiDi}" không tồn tại trong danh mục.`,
        );
      }
      if (maNoiDen && !isMaCoSoValid(maNoiDen)) {
        pushError(
          'XML1',
          'MA_NOI_DEN',
          'Mã CSKCB không tồn tại trong danh mục',
          `Mã cơ sở nơi đến "${maNoiDen}" không tồn tại trong danh mục.`,
        );
      }
      if (maTam && !isMaCoSoValid(maTam)) {
        pushError(
          'XML1',
          'MA_TAM',
          'Mã CSKCB không tồn tại trong danh mục',
          `Mã tạm "${maTam}" không tồn tại trong danh mục.`,
        );
      }

      const maBenhCheck = [{ field: 'MA_BENH_CHINH' }, { field: 'MA_BENH_KT' }];
      for (const { field } of maBenhCheck) {
        const rawValue = record[field];
        if (!rawValue) continue;
        const codes = rawValue
          .split(';')
          .map((m) => m.trim())
          .filter(Boolean);
        for (const code of codes) {
          const isValid = icd10List.some((item) => item.Ma_Benh === code);
          if (!isValid) {
            pushError(
              'XML1',
              field,
              'Lỗi Mã bệnh ICD10 ngoài danh mục',
              `Lỗi Mã bệnh ICD10 ngoài danh mục XML1: Mã "${code}" không nằm trong danh mục hợp lệ.`,
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
            pushError(
              'XML1',
              'MA_BENH_CHINH',
              'Sai mã loại KCB (Bệnh mãn tính)',
              `Bệnh mãn tính (${maBenhChinh}) mã loại KCB phải là 05 hoặc 08 (theo Phụ lục 1 QĐ 824/QĐ-BYT và TT 46/2016/TT-BYT).`,
            );
          }
        } else if (record.MA_LOAI_KCB !== '01' && record.MA_LOAI_KCB !== '02') {
          pushError(
            'XML1',
            'MA_BENH_CHINH',
            'Sai mã loại KCB (Bệnh thường)',
            `Bệnh thường (${maBenhChinh}) mã loại KCB = 02 đối với BA Ngoại trú. (PHỤ LỤC 1 QĐ 824/QĐ-BYT và TT 46/2016/TT-BYT)`,
          );
        }
      }

      const ketQuaDtri = record.KET_QUA_DTRI?.toString().trim();
      if (
        !ketQuaDtri ||
        isNaN(Number(ketQuaDtri)) ||
        !Number.isInteger(Number(ketQuaDtri)) ||
        Number(ketQuaDtri) < 1 ||
        Number(ketQuaDtri) > 7
      ) {
        pushError(
          'XML1',
          'KET_QUA_DTRI',
          'Lỗi KET_QUA_DTRI ngoài danh mục',
          'Lỗi KET_QUA_DTRI ngoài danh mục: Kết quả điều trị không được để trống và phải là số nguyên từ 1 đến 7.',
        );
      }

      const maLoaiRv = record.MA_LOAI_RV?.toString().trim();
      if (
        !maLoaiRv ||
        isNaN(Number(maLoaiRv)) ||
        !Number.isInteger(Number(maLoaiRv)) ||
        Number(maLoaiRv) < 1 ||
        Number(maLoaiRv) > 5
      ) {
        pushError(
          'XML1',
          'MA_LOAI_RV',
          'Lỗi MA_LOAI_RV ngoài danh mục',
          'Lỗi MA_LOAI_RV ngoài danh mục: Tình trạng ra viện không được để trống và phải là số nguyên từ 1 đến 5.',
        );
      }

      const maLoaiKcb = record.MA_LOAI_KCB?.toString().trim();
      const ngayVao = record.NGAY_VAO;
      const ngayRa = record.NGAY_RA;
      if (maLoaiKcb === '09' && ngayVao && ngayRa) {
        const start = new Date(
          ngayVao.slice(0, 4) +
            '-' +
            ngayVao.slice(4, 6) +
            '-' +
            ngayVao.slice(6, 8) +
            'T' +
            ngayVao.slice(8, 10) +
            ':' +
            ngayVao.slice(10, 12),
        );
        const end = new Date(
          ngayRa.slice(0, 4) +
            '-' +
            ngayRa.slice(4, 6) +
            '-' +
            ngayRa.slice(6, 8) +
            'T' +
            ngayRa.slice(8, 10) +
            ':' +
            ngayRa.slice(10, 12),
        );
        const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        if (diffHours < 4) {
          pushError(
            'XML1',
            'MA_LOAI_KCB',
            'SAI_MA_LOAI_KCB_09',
            `Thời gian điều trị dưới 4 giờ nhưng MA_LOAI_KCB = 09 (Nội trú). Thời gian: ${diffHours.toFixed(2)} giờ`,
          );
        }
      }

      if (record.MA_BENH_YHCT) {
        const maBenhYhctList = record.MA_BENH_YHCT.split(';')
          .map((m) => m.trim())
          .filter(Boolean);
        for (const code of maBenhYhctList) {
          const isValid = validYhctCodes.some((item) => item.Ma_YHCT === code);
          if (!isValid) {
            pushError(
              'XML1',
              'MA_BENH_YHCT',
              'Lỗi Mã bệnh YHCT ngoài danh mục',
              `Lỗi Mã bệnh YHCT ngoài danh mục: mã "${code}" không nằm trong danh mục hợp lệ.`,
            );
          }
        }
      }
    },
    XML2: () => {
      const value = record.MA_NHOM?.toString().trim();
      const allowedValues = ['4', '7', '17'];
      if (!value || !allowedValues.includes(value)) {
        pushError(
          'XML2',
          'MA_NHOM',
          'Lỗi MA_NHOM chi phí ngoài danh mục',
          'Lỗi MA_NHOM chi phí ngoài danh mục: chỉ chấp nhận các giá trị 4, 7, 17.',
        );
      }

      const maBacSi = record.MA_BAC_SI;
      if (!maBacSi) return;
      const danhMucBacSiEntry = doctors.get(maBacSi.trim());
      if (!danhMucBacSiEntry) {
        pushError(
          'XML2',
          'MA_BAC_SI',
          'MA_BAC_SI không tồn tại trong danh mục',
          `MA_BAC_SI '${maBacSi}' không tồn tại trong danh mục.`,
        );
        return;
      }
      const chucDanh = danhMucBacSiEntry.CHUCDANH_NN;
      if (chucDanh !== '1' && chucDanh !== '2') {
        pushError(
          'XML2',
          'MA_BAC_SI',
          'Chức danh bác sĩ không hợp lệ',
          `Mã bác sĩ '${maBacSi}' có chức danh không phù hợp để thực hiện khám và cấp thuốc (CHUCDANH_NN = '${chucDanh}'). Chỉ chấp nhận chức danh có mã 1 hoặc 2.`,
        );
      }
    },
    XML3: () => {
      const value = record.MA_NHOM?.toString().trim();
      const allowedValues = ['1', '2', '3', '8', '10', '12', '13', '14', '15', '18'];
      if (!value || !allowedValues.includes(value)) {
        pushError(
          'XML3',
          'MA_NHOM',
          'Lỗi MA_NHOM chi phí ngoài danh mục',
          'Lỗi MA_NHOM chi phí ngoài danh mục',
        );
      }

      const maBacSi = record.MA_BAC_SI;
      if (!maBacSi) return;
      const danhMucBacSiEntry = doctors.get(maBacSi.trim());
      if (!danhMucBacSiEntry) {
        pushError(
          'XML3',
          'MA_BAC_SI',
          'MA_BAC_SI không tồn tại trong danh mục',
          `MA_BAC_SI '${maBacSi}' không tồn tại trong danh mục.`,
        );
        return;
      }
      const chucDanh = danhMucBacSiEntry.CHUCDANH_NN;
      if (chucDanh !== '1' && chucDanh !== '2') {
        pushError(
          'XML3',
          'MA_BAC_SI',
          'Chức danh bác sĩ không hợp lệ',
          `Mã bác sĩ '${maBacSi}' có chức danh không phù hợp để thực hiện khám và cấp thuốc (CHUCDANH_NN = '${chucDanh}'). Chỉ chấp nhận chức danh có mã 1 hoặc 2.`,
        );
      }

      const nguoiThucHien = record.NGUOI_THUC_HIEN;
      if (!nguoiThucHien) return;
      const nguoiThuHienList = nguoiThucHien
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const nguoi of nguoiThuHienList) {
        if (!doctors.has(nguoi)) {
          pushError(
            'XML3',
            'NGUOI_THUC_HIEN',
            'MA_NGUOI_THUC_HIEN không tồn tại trong danh mục',
            `Mã người thực hiện '${nguoi}' không tồn tại trong danh mục.`,
          );
        }
      }

      if (record.MA_BENH_YHCT) {
        const maBenhYhctList = record.MA_BENH_YHCT.split(';')
          .map((m) => m.trim())
          .filter(Boolean);
        for (const code of maBenhYhctList) {
          const isValid = validYhctCodes.some((item) => item.Ma_YHCT === code);
          if (!isValid) {
            pushError(
              'XML3',
              'MA_BENH_YHCT',
              'Lỗi Mã bệnh YHCT ngoài danh mục',
              `Lỗi Mã bệnh YHCT ngoài danh mục: mã "${code}" không nằm trong danh mục hợp lệ.`,
            );
          }
        }
      }

      if (record.MA_BENH) {
        const maBenhICD10List = record.MA_BENH.split(';')
          .map((m) => m.trim())
          .filter(Boolean);
        for (const code of maBenhICD10List) {
          const isValid = icd10List.some((item) => item.Ma_Benh === code);
          if (!isValid) {
            pushError(
              'XML3',
              'MA_BENH_ICD10',
              'Lỗi Mã bệnh ICD10 ngoài danh mục',
              `Lỗi Mã bệnh ICD10 ngoài danh mục: Mã "${code}" không nằm trong danh mục hợp lệ.`,
            );
          }
        }
      }
    },
    XML4: () => {
      const nguoiThuHien = record.MA_BS_DOC_KQ;
      if (!nguoiThuHien) return;
      const nguoiThuHienList = nguoiThuHien
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const nguoi of nguoiThuHienList) {
        if (!bsDocKQ.has(nguoi)) {
          pushError(
            'XML4',
            'MA_BS_DOC_KQ',
            'MA_BS_DOC_KQ không tồn tại trong danh mục',
            `MA_BS_DOC_KQ '${nguoi}' không tồn tại trong danh mục.`,
          );
        }
      }
    },
    XML5: () => {
      const nguoiThucHien = record.NGUOI_THUC_HIEN;
      if (!nguoiThucHien) return;
      const nguoiThuHienList = nguoiThucHien
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const nguoi of nguoiThuHienList) {
        if (!bsDocKQ.has(nguoi)) {
          pushError(
            'XML5',
            'NGUOI_THUC_HIEN',
            'MA_NGUOI_THUC_HIEN không tồn tại trong danh mục',
            `Mã người thực hiện '${nguoi}' không tồn tại trong danh mục.`,
          );
        }
      }
    },
  };

  recordSpecificChecks[loaiHoSo]?.();

  return errors;
}

/**
 * Hàm thực hiện kiểm tra các ràng buộc liên hồ sơ.
 * @param sheetsData Đối tượng chứa tất cả dữ liệu từ các sheet (XML1, XML2, XML3...).
 * @returns Mảng các lỗi tìm thấy.
 */
export function validateInterRecords(
  sheetsData: Record<string, Record<string, string>[]>,
  chongChiDinhThuocList: DanhMucChongChiDinhThuoc[],
  chongTuongTacThuocList: TuongTacThuoc[],
  doctorMap: DanhMucNhanVien[],
  tienKhamList: TienKham[],
  dvktTimeConfigList: DanhMucThoiGianThucHienDVKT[],
  danhMucBoCheckMaMay: any,
  mucHuongList: MucHuong[],
  danhMucCauHinhDVKT: CauHinhDichVu[],
  khungGioKCB?: KhungGio,
  tbytList?: DanhMucTrangThietBi[],
  dvktBatBuocMaMay: Array<{ MA_DVKT?: string }> = [],
): ValidationError[] {
  const errors: ValidationError[] = [];

  const xml1Records = sheetsData['XML1'] || [];
  const xml2Records = sheetsData['XML2'] || [];
  const xml3Records = sheetsData['XML3'] || [];
  const xml5Records = sheetsData['XML5'] || [];
  const xml7Records = sheetsData['XML7'] || [];
  const xml8Records = sheetsData['XML8'] || [];
  const xml9Records = sheetsData['XML9'] || [];
  const xml14Records = sheetsData['XML14'] || [];

  const danhMucArray: string[] = Array.isArray(danhMucBoCheckMaMay)
    ? danhMucBoCheckMaMay
    : danhMucBoCheckMaMay?.list || [];
  const dvktBatBuocMaMaySet = new Set(
    (Array.isArray(dvktBatBuocMaMay) ? dvktBatBuocMaMay : [])
      .map((item) => item?.MA_DVKT?.toString().trim().toUpperCase())
      .filter(Boolean),
  );

  // Để tiện tra cứu, tạo một Map cho XML1 dựa trên MA_LK
  // Vì các quy tắc dưới đây thường tham chiếu đến thông tin trong XML1
  const xml1MapByMaLk = new Map<string, Record<string, string>>();
  const xml1Ngays = new Map<string, string>();
  const xml1GioiTinhs = new Map<string, string>();
  xml1Records.forEach((record) => {
    if (record.MA_LK) {
      xml1MapByMaLk.set(record.MA_LK, record);
      xml1Ngays.set(record.MA_LK, record.NGAY_SINH || '');
      xml1GioiTinhs.set(record.MA_LK, record.GIOI_TINH || '');
    }
  });

  const patientMap = xml1Ngays;
  const patientMapGioiTinh = xml1GioiTinhs;

  const xml7MaLkSet = new Set(xml7Records.map((r) => r.MA_LK?.toString().trim()).filter(Boolean));
  const xml8MaLkSet = new Set(xml8Records.map((r) => r.MA_LK?.toString().trim()).filter(Boolean));
  const xml9MaLkSet = new Set(xml9Records.map((r) => r.MA_LK?.toString().trim()).filter(Boolean));

  const xml2ByMaLk = new Map<string, Record<string, string>[]>();
  const xml2FirstRowIndexByMaLk = new Map<string, number>();
  xml2Records.forEach((r, rowIndex) => {
    const maLk = r.MA_LK;
    if (!maLk) return;
    if (!xml2ByMaLk.has(maLk)) {
      xml2ByMaLk.set(maLk, []);
      xml2FirstRowIndexByMaLk.set(maLk, rowIndex);
    }
    xml2ByMaLk.get(maLk)!.push(r);
  });

  const xml3ByMaLk = new Map<string, Record<string, string>[]>();
  const xml3ByMaLkAndDvkt = new Map<string, Map<string, Record<string, string>>>();
  xml3Records.forEach((r) => {
    const maLk = r.MA_LK;
    const maDvkt = r.MA_DICH_VU?.trim();
    if (!maLk) return;
    if (!xml3ByMaLk.has(maLk)) xml3ByMaLk.set(maLk, []);
    xml3ByMaLk.get(maLk)!.push(r);

    if (maDvkt) {
      if (!xml3ByMaLkAndDvkt.has(maLk)) {
        xml3ByMaLkAndDvkt.set(maLk, new Map());
      }
      xml3ByMaLkAndDvkt.get(maLk)!.set(maDvkt, r);
    }
  });

  const xml3MetaByMaLk = new Map<
    string,
    { hasClsOrService: boolean; hasDrug: boolean; congKhamCount: number }
  >();

  for (const [maLk, records] of xml3ByMaLk.entries()) {
    xml3MetaByMaLk.set(maLk, {
      hasClsOrService: records.some((r) => r.MA_NHOM !== '13'),
      hasDrug: (xml2ByMaLk.get(maLk) || []).length > 0,
      congKhamCount: records.filter((r) => r.MA_NHOM === '13').length,
    });
  }

  const normalizedCauHinhDvkt = Array.isArray(danhMucCauHinhDVKT)
    ? danhMucCauHinhDVKT
    : Array.isArray((danhMucCauHinhDVKT as any)?.list)
      ? (danhMucCauHinhDVKT as any).list
      : [];

  const dvktConfigMap = new Map<string, CauHinhDichVu>();
  normalizedCauHinhDvkt.forEach((c: CauHinhDichVu) => {
    if (c.maDvkt) dvktConfigMap.set(c.maDvkt.trim(), c);
  });

  const getTrimmedValue = (value?: string): string => value?.trim() || '';

  const getPatientInfo = (record: Record<string, string>) =>
    buildPatientInfo(record, xml1MapByMaLk);

  xml3Records.forEach((record, rowIndex) => {
    const patientInfo = getPatientInfo(record);
    validateXml3RecordRules(record, rowIndex, patientInfo, errors, doctorMap, tbytList || []);
  });

  const splitAndNormalize = (value?: string): string[] =>
    value
      ? Array.from(
          new Set(
            value
              .split(';')
              .map((item) => item.trim())
              .filter(Boolean),
          ),
        )
      : [];

  const normalizeIcdCode = (code: string) => code?.toString().trim().toUpperCase();

  const isExternalCauseIcdCode = (code: string) => {
    const normalized = normalizeIcdCode(code);
    if (!normalized) return false;
    return EXTERNAL_CAUSE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  };

  const matchesPrefixList = (code: string, prefixes: string[]) => {
    const normalized = normalizeIcdCode(code);
    if (!normalized) return false;
    return prefixes.some((prefix) => normalized.startsWith(prefix));
  };

  const isFemaleSpecificIcdCode = (code: string) =>
    matchesPrefixList(code, FEMALE_SPECIFIC_PREFIXES);
  const isMaleSpecificIcdCode = (code: string) => matchesPrefixList(code, MALE_SPECIFIC_PREFIXES);

  xml1Records.forEach((record, rowIndex) => {
    const patientInfo = getPatientInfo(record);
    const normalizedCode = normalizeIcdCode(record.MA_BENH_CHINH);

    if (ICD10_NOT_ALLOWED_AS_PRINCIPAL_DIAGNOSIS.includes(normalizedCode)) {
      errors.push({
        sheetName: 'XML1',
        rowIndex,
        fieldName: 'MA_BENH_CHINH',
        errorCode: 'Lỗi TT06 - Mã ICD10 không được dùng làm mã bệnh chính',
        errorMessage: `Mã ICD10 "${normalizedCode}" không được dùng làm mã bệnh chính.`,
        severity: 'error',
        ...patientInfo,
      });
    }

    if (ICD10_DISCOURAGED_AS_PRINCIPAL_DIAGNOSIS.includes(normalizedCode)) {
      errors.push({
        sheetName: 'XML1',
        rowIndex,
        fieldName: 'MA_BENH_CHINH',
        errorCode: 'Lỗi TT06 - Mã ICD10 không được khuyến khích dùng làm mã bệnh chính',
        errorMessage: `Mã ICD10 "${normalizedCode}" không khuyến khích dùng làm MA_BENH_CHINH.`,
        severity: 'warning',
        ...patientInfo,
      });
    }
  });

  const reportedIcdErrors = new Set<string>();

  xml3Records.forEach((record, rowIndex) => {
    const patientInfo = getPatientInfo(record);
    if (!record.MA_BENH) return;

    const diseaseCodes = record.MA_BENH.split(';')
      .map((m) => m.trim())
      .filter(Boolean);

    for (const code of diseaseCodes) {
      const normalizedCode = normalizeIcdCode(code);

      if (!normalizedCode) continue;

      let errorCode = '';
      let errorMessage = '';

      // =========================
      // Nhóm nguyên nhân tử vong
      // =========================
      if (isExternalCauseIcdCode(normalizedCode)) {
        errorCode = 'Lỗi TT06 - Mã ICD10 chỉ sử dụng mã hóa nguyên nhân tử vong';
        errorMessage = `MA_BENH có chứa mã "${normalizedCode}" chỉ sử dụng mã hóa nguyên nhân tử vong`;
      }

      // =========================
      // Có mã chi tiết hơn
      // =========================
      else if (ICD10_CODES_REQUIRING_SPECIFIC_SUBCODE.includes(normalizedCode)) {
        errorCode = 'Lỗi TT06 - Mã ICD10 không được sử dụng vì có mã 4 hoặc 5 ký tự cụ thể hơn';
        errorMessage = `MA_BENH có chứa mã "${normalizedCode}" không được sử dụng vì có mã 4 hoặc 5 ký tự cụ thể hơn`;
      }

      // =========================
      // Bệnh nữ nhưng bệnh nhân nam
      // =========================
      else if (record.GIOI_TINH === '1' && isFemaleSpecificIcdCode(normalizedCode)) {
        errorCode = 'Lỗi TT06 - Mã ICD10 chỉ có hoặc chủ yếu ở Nữ giới';
        errorMessage = `MA_BENH có chứa mã "${normalizedCode}" chỉ có hoặc chủ yếu ở Nữ giới`;
      }

      // =========================
      // Bệnh nam nhưng bệnh nhân nữ
      // =========================
      else if (record.GIOI_TINH === '2' && isMaleSpecificIcdCode(normalizedCode)) {
        errorCode = 'Lỗi TT06 - Mã ICD10 chỉ có hoặc chủ yếu ở Nam giới';
        errorMessage = `MA_BENH có chứa mã "${normalizedCode}" chỉ có hoặc chủ yếu ở Nam giới`;
      }

      if (!errorCode) continue;

      // Chống trùng theo MA_LK + Loại lỗi + Mã ICD
      const errorKey = `${record.MA_LK}_${errorCode}_${normalizedCode}`;

      if (!reportedIcdErrors.has(errorKey)) {
        reportedIcdErrors.add(errorKey);

        errors.push(
          buildValidationError(
            'XML3',
            rowIndex,
            'MA_BENH',
            errorCode,
            errorMessage,
            'error',
            patientInfo,
            {},
            'chuyen-de',
          ),
        );
      }

      // Mỗi dòng chỉ lấy lỗi đầu tiên
      break;
    }
  });

  // --- 1. Kiểm tra NGAY_RA và NGAY_VAO (Tất cả HS KCB) ---
  xml1Records.forEach((record, rowIndex) => {
    const ngayVao = record.NGAY_VAO;
    const ngayRa = record.NGAY_RA;
    const patientInfo = getPatientInfo(record);
    if (ngayVao && ngayRa) {
      if (ngayRa <= ngayVao) {
        errors.push(
          buildValidationError(
            'XML1',
            rowIndex,
            'NGAY_RA, NGAY_VAO',
            'Ngày ra trước hoặc trùng ngày vào',
            `Ngày ra (${formatDateTime(ngayRa)}) <= (${formatDateTime(ngayVao)}).`,
            'error',
            patientInfo,
            {
              NGAY_VAO: ngayVao,
              NGAY_RA: ngayRa,
            },
            'chuyen-de',
          ),
        );
      }
    }
  });

  // --- 2. Kiểm tra Sai Chi Phí XML1 ---
  xml1Records.forEach((record, rowIndex) => {
    const maLk = record.MA_LK;
    const patientInfo = getPatientInfo(record);
    if (!maLk) return;

    const xml2OfMaLk = xml2ByMaLk.get(maLk) || [];
    const xml3OfMaLk = xml3ByMaLk.get(maLk) || [];

    const sumBy = (
      arr: Record<string, string>[],
      field: string,
      condition: (item: Record<string, string>) => boolean = () => true,
    ) =>
      arr.reduce((sum, item) => (condition(item) ? sum + parseFloat(item[field] || '0') : sum), 0);

    const expected: {
      T_THUOC: number;
      T_VTYT: number;
      T_TONGCHI_BV: number;
      T_TONGCHI_BH: number;
      T_BNTT: number;
      T_BNCCT: number;
      T_NGUONKHAC: number;
      T_BHTT: number;
    } = {
      T_THUOC: sumBy(xml2OfMaLk, 'THANH_TIEN_BV'),
      T_VTYT: sumBy(xml2OfMaLk, 'THANH_TIEN_BV', (r) => r.MA_NHOM === '10'),
      T_TONGCHI_BV: sumBy([...xml2OfMaLk, ...xml3OfMaLk], 'THANH_TIEN_BV'),
      T_TONGCHI_BH: sumBy([...xml2OfMaLk, ...xml3OfMaLk], 'THANH_TIEN_BH'),
      T_BNTT: sumBy([...xml2OfMaLk, ...xml3OfMaLk], 'T_BNTT'),
      T_BNCCT: sumBy([...xml2OfMaLk, ...xml3OfMaLk], 'T_BNCCT'),
      T_NGUONKHAC: sumBy([...xml2OfMaLk, ...xml3OfMaLk], 'T_NGUONKHAC'),
      T_BHTT: 0,
    };

    expected.T_BHTT = expected.T_TONGCHI_BH - expected.T_BNCCT;

    const toNumber = (val: string | undefined) => parseFloat(val || '0');
    const compare = (expected: number, actual: number) => Math.abs(expected - actual) > 1000;

    const fieldLabels: Record<string, string> = {
      T_THUOC: 'Tổng THANH_TIEN_BV (XML2)',
      T_VTYT: 'Tổng THANH_TIEN_BV (XML2, MA_NHOM=10)',
      T_TONGCHI_BV: 'Tổng THANH_TIEN_BV (XML2+3)',
      T_TONGCHI_BH: 'Tổng THANH_TIEN_BH (XML2+3)',
      T_BNTT: 'T_BNTT (XML2+3)',
      T_BNCCT: 'T_BNCCT (XML2+3)',
      T_BHTT: 'T_TONGCHI_BH - T_BNCCT',
      T_NGUONKHAC: 'T_NGUONKHAC (XML2+3)',
    };

    const mismatchMessages: string[] = [];

    for (const [field, expectedValue] of Object.entries(expected)) {
      const actualValue = toNumber(record[field]);
      if (compare(expectedValue, actualValue)) {
        const label = fieldLabels[field] || 'Giá trị tính toán';
        mismatchMessages.push(
          `${field}: ${formatNumber(actualValue)} ≠ ${label}: ${formatNumber(expectedValue)}`,
        );
      }
    }

    if (mismatchMessages.length > 0) {
      errors.push(
        buildValidationError(
          'XML1',
          rowIndex,
          Object.keys(expected).join(', '),
          'Lệch chi phí KCB',
          mismatchMessages.join('; '),
          'error',
          patientInfo,
          undefined,
          'chuyen-de',
        ),
      );
    }

    function formatNumber(n: number): string {
      return Number(n).toLocaleString('vi-VN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
  });

  // --- 2. NGAY_RA <= NGAY_VAO_NOI_TRU (Kiểm tra MA_LOAI_KCB = 02, 03, 04, 06, 09 - XML1) ---
  xml1Records.forEach((record, rowIndex) => {
    const maLoaiKCB = record.MA_LOAI_KCB;
    const ngayRa = record.NGAY_RA;
    const ngayVaoNoiTru = record.NGAY_VAO_NOI_TRU; // Có thể rỗng nếu không phải nội trú
    const requiredLoaiKCB = ['02', '03', '04', '06', '09'];
    const patientInfo = getPatientInfo(record);
    if (requiredLoaiKCB.includes(maLoaiKCB) && ngayRa && ngayVaoNoiTru) {
      if (ngayRa <= ngayVaoNoiTru) {
        errors.push({
          sheetName: 'XML1',
          rowIndex: rowIndex,
          fieldName: 'NGAY_RA, NGAY_VAO_NOI_TRU',
          errorCode: 'Ngày trước hoặc trùng ngày vào nội trú',
          errorMessage: `Ngày ra (${formatDateTime(
            ngayRa,
          )}) không được trước ngày vào nội trú (${formatDateTime(
            ngayVaoNoiTru,
          )}) khi MA_LOAI_KCB là ${maLoaiKCB}.`,
          severity: 'error',
          ...patientInfo,
          extra: {
            NGAY_RA: ngayRa,
            NGAY_VAO_NOI_TRU: ngayVaoNoiTru,
          },
        });
      }
    }
  });

  // --- 3. NGAY_VAO_NOI_TRU < NGAY_VAO (Kiểm tra MA_LOAI_KCB = 02, 03, 04, 06, 09 - XML1) ---
  xml1Records.forEach((record, rowIndex) => {
    const maLoaiKCB = record.MA_LOAI_KCB;
    const ngayVao = record.NGAY_VAO;
    const ngayVaoNoiTru = record.NGAY_VAO_NOI_TRU;
    const requiredLoaiKCB = ['02', '03', '04', '06', '09'];
    const patientInfo = getPatientInfo(record);
    if (requiredLoaiKCB.includes(maLoaiKCB) && ngayVao && ngayVaoNoiTru) {
      if (ngayVaoNoiTru <= ngayVao) {
        errors.push({
          sheetName: 'XML1',
          rowIndex: rowIndex,
          fieldName: 'NGAY_VAO, NGAY_VAO_NOI_TRU',
          errorCode: 'Ngày vào nội trú trước hoặc trùng ngày vào',
          errorMessage: `Ngày vào nội trú (${formatDateTime(
            ngayVaoNoiTru,
          )}) phải trước hoặc trùng ngày vào (${formatDateTime(ngayVao)}) khi MA_LOAI_KCB là ${maLoaiKCB}.`,
          severity: 'error',
          ...patientInfo,
          extra: {
            NGAY_VAO: ngayVao,
            NGAY_VAO_NOI_TRU: ngayVaoNoiTru,
          },
        });
      }
    }
  });

  const xml1InfoMap = new Map<string, (typeof xml1Records)[number]>();

  xml1Records.forEach((r) => {
    if (r.MA_LK) {
      xml1InfoMap.set(r.MA_LK, r);
    }
  });

  xml5Records.forEach((record, rowIndex) => {
    const patientInfo = getPatientInfo(record);

    const xml1Record = xml1InfoMap.get(record.MA_LK);
    if (!xml1Record) return;

    const thoiDiemDate = parseDateTime(record.THOI_DIEM_DBLS);
    const ngayVaoDate = parseDateTime(xml1Record.NGAY_VAO);
    const ngayRaDate = parseDateTime(xml1Record.NGAY_RA);

    if (thoiDiemDate && ngayVaoDate && ngayRaDate) {
      if (thoiDiemDate <= ngayVaoDate || thoiDiemDate >= ngayRaDate) {
        errors.push({
          sheetName: 'XML5',
          rowIndex,
          fieldName: 'THOI_DIEM_DBLS',
          errorCode: 'THOI_DIEM_DBLS nằm ngoài thời gian điều trị',
          errorMessage: `THOI_DIEM_DBLS = ${formatDateTime(record.THOI_DIEM_DBLS)} nằm ngoài thời gian điều trị từ ${formatDateTime(xml1Record.NGAY_VAO)} -> ${formatDateTime(xml1Record.NGAY_RA)}`,
          severity: 'error',
          ...patientInfo,
        });
      }
    }
  });

  // --- 4. NGAY_KQ < NGAY_YL (Kiểm tra MA_NHOM = 1, 2, 3, 8, 15, 18 - XML3) ---
  xml3Records.forEach((record, rowIndex) => {
    const maNhom = record.MA_NHOM;
    const ngayYl = record.NGAY_YL;
    const ngayKq = record.NGAY_KQ;
    const patientInfo = getPatientInfo(record);
    const targetMaNhom = ['1', '2', '3', '8', '15', '18'];
    const maDvkt = record.MA_DICH_VU;
    const tenDvkt = record.TEN_DICH_VU;

    if (targetMaNhom.includes(maNhom) && ngayYl && ngayKq) {
      if (ngayKq < ngayYl) {
        errors.push({
          sheetName: 'XML3',
          rowIndex: rowIndex,
          fieldName: 'NGAY_KQ, NGAY_YL',
          errorCode: 'Thời gian kết quả trước thời gian y lệnh',
          errorMessage: `Dịch vụ [${maDvkt}] - ${tenDvkt} có thời gian kết quả (${formatDateTime(
            ngayKq,
          )}) trước thời gian y lệnh (${formatDateTime(ngayYl)})`,
          severity: 'error',
          ...patientInfo,
          extra: {
            NGAY_YL: ngayYl,
            NGAY_KQ: ngayKq,
          },
        });
      }
    }
  });

  // --- 5. NGAY_KQ <= NGAY_TH_YL (Kiểm tra MA_NHOM = 1, 2, 3, 8, 15, 18 - XML3) ---
  xml3Records.forEach((record, rowIndex) => {
    const maNhom = record.MA_NHOM;
    const ngayThYl = record.NGAY_TH_YL; // Có thể rỗng
    const ngayKq = record.NGAY_KQ;
    const maDvkt = record.MA_DICH_VU;
    const tenDvkt = record.TEN_DICH_VU;
    const patientInfo = getPatientInfo(record);
    const targetMaNhom = ['1', '2', '3', '8', '15', '18'];

    if (targetMaNhom.includes(maNhom) && ngayThYl && ngayKq) {
      if (ngayKq < ngayThYl) {
        errors.push({
          sheetName: 'XML3',
          rowIndex: rowIndex,
          fieldName: 'NGAY_KQ, NGAY_TH_YL',
          errorCode: 'Thời gian kết quả trước thời gian thực hiện y lệnh',
          errorMessage: `Dịch vụ [${maDvkt}] - ${tenDvkt} có Thời gian kết quả (${formatDateTime(
            ngayKq,
          )}) trước Thời gian thực hiện y lệnh (${formatDateTime(ngayThYl)})`,
          severity: 'error',
          ...patientInfo,
          extra: {
            NGAY_TH_YL: ngayThYl,
            NGAY_KQ: ngayKq,
          },
        });
      }
    }
    if (targetMaNhom.includes(maNhom) && ngayThYl && ngayKq) {
      if (ngayKq === ngayThYl) {
        errors.push({
          sheetName: 'XML3',
          rowIndex: rowIndex,
          fieldName: 'NGAY_KQ, NGAY_TH_YL',
          errorCode: 'Thời gian kết quả trùng thời gian thực hiện y lệnh',
          errorMessage: `Dịch vụ [${maDvkt}] - ${tenDvkt} có Thời gian kết quả (${formatDateTime(
            ngayKq,
          )}) trùng Thời gian thực hiện y lệnh (${formatDateTime(ngayThYl)})`,
          severity: 'error',
          ...patientInfo,
          extra: {
            NGAY_TH_YL: ngayThYl,
            NGAY_KQ: ngayKq,
          },
        });
      }
    }
  });

  // --- 6. NGAY_TH_YL < NGAY_YL ---
  // Quy tắc này có 2 phần: (Check XML3) và (Check XML2)
  // NGAY_TH_YL >= NGAY_YL

  // Phần 1: Kiểm tra MA_NHOM = 1, 2, 3, 8, 15, 18 (XML3)
  xml3Records.forEach((record, rowIndex) => {
    const maNhom = record.MA_NHOM;
    const ngayYl = record.NGAY_YL;
    const ngayThYl = record.NGAY_TH_YL;
    const maDvkt = record.MA_DICH_VU;
    const tenDvkt = record.TEN_DICH_VU;
    const patientInfo = getPatientInfo(record);
    const targetMaNhom = ['1', '2', '3', '8', '15', '18'];

    if (targetMaNhom.includes(maNhom) && ngayYl && ngayThYl) {
      if (ngayThYl < ngayYl) {
        errors.push({
          sheetName: 'XML3',
          rowIndex: rowIndex,
          fieldName: 'NGAY_TH_YL, NGAY_YL',
          errorCode: 'Thời gian thực hiện y lệnh trước thời gian y lệnh(DVKT)',
          errorMessage: `Dịch vụ [${maDvkt}] - ${tenDvkt} có NGAY_TH_YL (${formatDateTime(
            ngayThYl,
          )}) trước NGAY_YL (${formatDateTime(ngayYl)})`,
          severity: 'error',
          ...patientInfo,
          extra: {
            NGAY_TH_YL: ngayThYl,
            NGAY_YL: ngayYl,
          },
        });
      }
    }

    if (targetMaNhom.includes(maNhom) && ngayYl && ngayThYl && maNhom !== '1') {
      if (ngayThYl === ngayYl) {
        errors.push({
          sheetName: 'XML3',
          rowIndex: rowIndex,
          fieldName: 'NGAY_TH_YL, NGAY_YL',
          errorCode: 'Thời gian thực hiện y lệnh trùng thời gian y lệnh',
          errorMessage: `Dịch vụ [${maDvkt}] - ${tenDvkt} có NGAY_TH_YL (${formatDateTime(
            ngayThYl,
          )}) trùng NGAY_YL (${formatDateTime(ngayYl)}).`,
          severity: 'error',
          ...patientInfo,
          extra: {
            NGAY_TH_YL: ngayThYl,
            NGAY_YL: ngayYl,
          },
        });
      }
    }
  });

  xml2Records.forEach((record, rowIndex) => {
    const patientInfo = getPatientInfo(record);
    const rawValue = record['LIEU_DUNG'];
    const soLuongRaw = record['SO_LUONG'];
    if (rawValue) {
      const value = rawValue.trim();

      // ===============================
      // COMMON PATTERN
      // ===============================

      const numberPattern = '\\d+(?:\\/\\d+)?(?:\\.\\d+)?';
      const S = '\\s*';

      // ===============================
      // 1. NGOẠI TRÚ
      // Dạng:
      // Số lượng ĐVT/lần * số lần/ngày * số ngày [liều/ngày]
      //
      // Ví dụ:
      // 1 viên/lần * 2 lần/ngày * 5 ngày [2 viên/ngày]
      // 1viên/lần*2lần/ngày*5ngày[2viên/ngày]
      // ===============================

      const regexNgoaiTru = new RegExp(
        `^${S}` +
          `${numberPattern}${S}\\S+${S}\\/${S}lần` +
          `${S}\\*${S}` +
          `(\\d+)${S}lần${S}\\/${S}ngày` +
          `${S}\\*${S}` +
          `(\\d+)${S}ngày` +
          `${S}\\[${S}` +
          `(${numberPattern})${S}\\S+${S}\\/${S}ngày` +
          `${S}\\]${S}$`,
        'i',
      );

      // ===============================
      // 2. NỘI TRÚ
      // Dạng:
      // Số lượng ĐVT/lần * số lần/ngày * 01 ngày [liều/ngày]
      //
      // Bắt buộc số ngày = 01
      //
      // Ví dụ:
      // 1 viên/lần * 2 lần/ngày * 01 ngày [2 viên/ngày]
      // 1viên/lần*2lần/ngày*01ngày[2viên/ngày]
      // ===============================

      const regexNoiTru = new RegExp(
        `^${S}` +
          `${numberPattern}${S}\\S+${S}\\/${S}lần` +
          `${S}\\*${S}` +
          `(\\d+)${S}lần${S}\\/${S}ngày` +
          `${S}\\*${S}` +
          `(01)${S}ngày` +
          `${S}\\[${S}` +
          `(${numberPattern})${S}\\S+${S}\\/${S}ngày` +
          `${S}\\]${S}$`,
        'i',
      );

      // ===============================
      // 3. CHI TIẾT
      // Dạng:
      // Tên thuốc/hoạt chất + số lượng + đơn vị
      // [tổng liều/ngày]
      //
      // Ví dụ:
      // Sáng: 1 viên, Trưa: 1 viên, Tối: 1 viên [3 viên/ngày]
      //
      // Cho phép:
      // Sáng:1 viên,Trưa:1 viên,Tối:1 viên[3viên/ngày]
      // ===============================

      const regexChiTiet = new RegExp(
        `^${S}` +
          `(?:` +
          `[A-Za-zÀ-ỹ]+${S}:?${S}` +
          `${numberPattern}${S}\\S+${S},?${S}` +
          `)+` +
          `\\[${S}` +
          `(${numberPattern})${S}\\S+${S}\\/${S}ngày` +
          `${S}\\]${S}$`,
        'i',
      );

      // ===============================
      // 4. RÚT GỌN
      // Thuốc dùng ngoài như:
      // - nhỏ giọt
      // - bôi
      // - dùng ngoài
      // - không xác định chính xác liều lượng
      //
      // Dạng:
      // Số lần sử dụng trong ngày * số ngày sử dụng
      //
      // Ví dụ:
      // 2 lần * 5 ngày
      // 3 lần x 7 ngày
      // 2 lần × 5 ngày
      // 2lần*5ngày
      // ===============================

      const regexRutGon = new RegExp(
        `^${S}` + `(\\d+)${S}lần` + `${S}(?:\\*|x|×)${S}` + `(\\d+)${S}ngày` + `${S}$`,
        'i',
      );

      const matchNgoaiTru = value.match(regexNgoaiTru);
      const matchNoiTru = value.match(regexNoiTru);
      const matchChiTiet = value.match(regexChiTiet);
      const matchRutGon = value.match(regexRutGon);

      const isValid = matchNgoaiTru || matchNoiTru || matchChiTiet || matchRutGon;

      // =====================================================
      // 1. KIỂM TRA CẤU TRÚC LIỀU DÙNG (ÁP DỤNG CHO MỌI THUỐC)
      // =====================================================
      if (!isValid) {
        errors.push({
          sheetName: 'XML2',
          rowIndex,
          fieldName: 'LIEU_DUNG',
          errorCode: 'Sai cấu trúc liều dùng',
          errorMessage: `Sai cấu trúc liều dùng (THAM KHẢO CỘT 12 BẢNG 2 QĐ 3176/QĐ-BYT)(${value}).`,
          severity: 'error',
          ...patientInfo,
          extra: { LIEU_DUNG: value },
        });
      }

      // =====================================================
      // 2. CHỈ THUỐC ĐƯỜNG UỐNG MỚI KIỂM TRA TỔNG SỐ LƯỢNG
      // =====================================================
      if (record.DUONG_DUNG?.toString() === '1.01' && isValid) {
        let soVienMotNgay = 0;
        let soNgay = 1;
        let coTheTinhTong = false;

        if (matchNgoaiTru) {
          soNgay = Number(matchNgoaiTru[2]);
          soVienMotNgay = Number(matchNgoaiTru[3]);
          coTheTinhTong = true;
        } else if (matchNoiTru) {
          soNgay = Number(matchNoiTru[2]);
          soVienMotNgay = Number(matchNoiTru[3]);
          coTheTinhTong = true;
        } else if (matchChiTiet) {
          // Có tổng/ngày nhưng không có số ngày nên không tính được
          soVienMotNgay = Number(matchChiTiet[1]);
        }
        // regexRutGon cũng không đủ dữ liệu để tính tổng

        if (coTheTinhTong) {
          const tongVienTheoLieuDung = soVienMotNgay * soNgay;
          const soLuong = Number(soLuongRaw);

          if (!isNaN(soLuong) && !isNaN(tongVienTheoLieuDung)) {
            if (tongVienTheoLieuDung < soLuong) {
              errors.push({
                sheetName: 'XML2',
                rowIndex,
                fieldName: 'SO_LUONG',
                errorCode: 'Tổng lượng ghi trong liều dùng thấp hơn với số lượng thanh toán',
                errorMessage: `Tổng lượng ghi trong liều dùng (${tongVienTheoLieuDung}) thấp hơn số lượng thanh toán (${soLuong}).`,
                severity: 'error',
                ...patientInfo,
                extra: {
                  LIEU_DUNG: value,
                },
              });
            } else if (tongVienTheoLieuDung > soLuong) {
              errors.push({
                sheetName: 'XML2',
                rowIndex,
                fieldName: 'SO_LUONG',
                errorCode: 'Tổng lượng ghi trong liều dùng cao hơn với số lượng thanh toán',
                errorMessage: `Tổng lượng ghi trong liều dùng (${tongVienTheoLieuDung}) cao hơn số lượng thanh toán (${soLuong}).`,
                severity: 'error',
                ...patientInfo,
                extra: {
                  LIEU_DUNG: value,
                },
              });
            }
          }
        }
      }
    }
  });

  // Phần 2: Kiểm tra MA_NHOM = 4 (XML2)
  xml2Records.forEach((record, rowIndex) => {
    const maNhom = record.MA_NHOM;
    const ngayYl = record.NGAY_YL;
    const ngayThYl = record.NGAY_TH_YL;
    const maThuoc = record.MA_THUOC;
    const tenThuoc = record.TEN_THUOC;
    const patientInfo = getPatientInfo(record);
    if (maNhom === '4' && ngayYl && ngayThYl) {
      if (ngayThYl < ngayYl) {
        errors.push({
          sheetName: 'XML2',
          rowIndex: rowIndex,
          fieldName: 'NGAY_TH_YL, NGAY_YL',
          errorCode: 'Thời gian thực hiện y lệnh trước thời gian y lệnh',
          errorMessage: `Thuốc [${maThuoc}] - ${tenThuoc} có NGAY_TH_YL (${formatDateTime(
            ngayThYl,
          )}) trước NGAY_YL (${formatDateTime(ngayYl)})`,
          severity: 'error',
          ...patientInfo,
          extra: {
            NGAY_TH_YL: ngayThYl,
            NGAY_YL: ngayYl,
          },
        });
      }
    }
  });

  // --- Lỗi NGAY_YL ngoài đợt điều trị (Check XML2 và XML3) ---
  // NGAY_YL < NGAY_VAO
  // NGAY_YL > NGAY_RA
  // Cảnh báo NGAY_YL = NGAY_VAO
  // Cảnh báo NGAY_YL = NGAY_RA

  const checkNgayYlOutOfBounds = (
    sheetName: string,
    record: Record<string, string>,
    rowIndex: number,
    xml1Record: Record<string, string>,
    label: string, // Thêm label: "Thuốc" hoặc "DVKT/Vật tư"
  ) => {
    const ngayYl = record.NGAY_YL;
    const ngayVao = xml1Record.NGAY_VAO;
    const ngayRa = xml1Record.NGAY_RA;
    const patientInfo = getPatientInfo(record);

    // Lấy tên thuốc hoặc tên dịch vụ để báo lỗi chi tiết hơn
    const itemName = record.TEN_THUOC || record.TEN_DICH_VU;

    if (ngayYl && ngayVao && ngayRa) {
      // 1. Lỗi: Trước ngày vào
      if (ngayYl < ngayVao) {
        errors.push({
          sheetName,
          rowIndex,
          fieldName: 'NGAY_YL',
          errorCode: `Ngày y lệnh ${label} nằm ngoài đợt điều trị (Trước ngày vào)`,
          errorMessage: `${label} [${itemName}]: Thời gian y lệnh (${formatDateTime(ngayYl)}) nằm ngoài đợt điều trị (Trước ngày vào ${formatDateTime(ngayVao)}).`,
          severity: 'error',
          ...patientInfo,
          extra: {
            NGAY_VAO: ngayVao,
            NGAY_RA: ngayRa,
            NGAY_YL: ngayYl,
          },
        });
      }

      // 2. Lỗi: Sau ngày ra
      if (ngayYl > ngayRa) {
        errors.push({
          sheetName,
          rowIndex,
          fieldName: 'NGAY_YL',
          errorCode: `Ngày y lệnh ${label} nằm ngoài đợt điều trị (Sau ngày ra)`,
          errorMessage: `${label} [${itemName}]: Thời gian y lệnh (${formatDateTime(ngayYl)}) nằm ngoài đợt điều trị (Sau ngày ra ${formatDateTime(ngayRa)}).`,
          severity: 'error',
          ...patientInfo,
          extra: {
            NGAY_VAO: ngayVao,
            NGAY_RA: ngayRa,
            NGAY_YL: ngayYl,
          },
        });
      }

      // 3. Cảnh báo: Trùng biên (Dùng cho kiểm soát thanh toán cùng ngày)
      if (ngayYl === ngayVao || ngayYl === ngayRa) {
        const typeLabel = ngayYl === ngayVao ? 'vào' : 'ra';
        errors.push({
          sheetName,
          rowIndex,
          fieldName: 'NGAY_YL',
          errorCode: `Ngày y lệnh ${label} trùng ngày ${typeLabel}`,
          errorMessage: `Cảnh báo: ${label} [${itemName}] có thời gian y lệnh trùng khớp với thời điểm ${typeLabel} viện (${formatDateTime(ngayYl)}).`,
          severity: 'warning',
          ...patientInfo,
          extra: {
            NGAY_VAO: ngayVao,
            NGAY_RA: ngayRa,
            NGAY_YL: ngayYl,
          },
        });
      }
    }
  };

  // Áp dụng cho XML2 (Thuốc)
  xml2Records.forEach((record, rowIndex) => {
    const xml1Record = xml1MapByMaLk.get(record.MA_LK);
    if (xml1Record) {
      checkNgayYlOutOfBounds('XML2', record, rowIndex, xml1Record, 'Thuốc');
    }
  });

  // Áp dụng cho XML3 (Dịch vụ kỹ thuật / Vật tư)
  xml3Records.forEach((record, rowIndex) => {
    const xml1Record = xml1MapByMaLk.get(record.MA_LK);
    if (xml1Record) {
      checkNgayYlOutOfBounds('XML3', record, rowIndex, xml1Record, 'DVKT');
    }
  });

  // --- Lỗi NGAY_KQ ngoài đợt điều trị (Check XML2 và XML3) ---
  // NGAY_KQ < NGAY_VAO
  // NGAY_KQ > NGAY_RA
  // NGAY_KQ = NGAY_VAO
  // Cảnh báo NGAY_KQ = NGAY_RA

  const checkNgayKqOutOfBounds = (
    sheetName: string,
    record: Record<string, string>,
    rowIndex: number,
    xml1Record: Record<string, string>,
    label: string, // "Thuốc" hoặc "DVKT"
  ) => {
    const ngayKq = record.NGAY_KQ;
    const ngayVao = xml1Record.NGAY_VAO;
    const ngayRa = xml1Record.NGAY_RA;
    const patientInfo = getPatientInfo(record);

    // Lấy tên định danh (Tên thuốc hoặc Tên dịch vụ kỹ thuật)
    const itemName = record.TEN_THUOC || record.TEN_DICH_VU || 'Dịch vụ';

    if (ngayKq && ngayVao && ngayRa) {
      // 1. Lỗi: Kết quả có trước khi vào viện
      if (ngayKq < ngayVao) {
        errors.push({
          sheetName,
          rowIndex,
          fieldName: 'NGAY_KQ',
          errorCode: `Thời gian kết quả ${label} trước thời điểm vào viện`,
          errorMessage: `${label} [${itemName}]: Thời gian có kết quả (${formatDateTime(ngayKq)}) trước thời điểm vào viện (${formatDateTime(ngayVao)}).`,
          severity: 'error',
          ...patientInfo,
          extra: {
            NGAY_VAO: ngayVao,
            NGAY_RA: ngayRa,
            NGAY_KQ: ngayKq,
          },
        });
      }

      // 2. Lỗi: Kết quả có sau khi ra viện
      if (ngayKq > ngayRa) {
        errors.push({
          sheetName,
          rowIndex,
          fieldName: 'NGAY_KQ',
          errorCode: `Thời gian kết quả ${label} sau thời điểm ra viện`,
          errorMessage: `${label} [${itemName}]: Thời gian có kết quả (${formatDateTime(ngayKq)}) sau thời điểm ra viện (${formatDateTime(ngayRa)}).`,
          severity: 'error',
          ...patientInfo,
          extra: {
            NGAY_VAO: ngayVao,
            NGAY_RA: ngayRa,
            NGAY_KQ: ngayKq,
          },
        });
      }

      // 3. Cảnh báo/Lỗi: Ngày kết quả trùng ngày vào (Thường CLS phải có sau khi khám/vào viện)
      if (ngayKq === ngayVao) {
        errors.push({
          sheetName,
          rowIndex,
          fieldName: 'NGAY_KQ',
          errorCode: `Thời gian kết quả ${label} trùng ngày vào`,
          errorMessage: `Lưu ý: ${label} [${itemName}] có thời gian kết quả trùng khớp với ngày vào viện (${formatDateTime(ngayKq)}).`,
          severity: 'warning', // Để warning vì có thể nhập liệu trùng giờ
          ...patientInfo,
          extra: {
            NGAY_VAO: ngayVao,
            NGAY_RA: ngayRa,
            NGAY_KQ: ngayKq,
          },
        });
      }
    }

    // 4. Kiểm tra riêng biệt cho đợt điều trị (Chỉ báo 1 lần tại XML1 hoặc log riêng)
    if (ngayVao === ngayRa && rowIndex === 0) {
      // rowIndex === 0 để tránh lặp lại lỗi này quá nhiều lần
      // Logic cảnh báo ngày vào trùng ngày ra nếu cần thiết
    }
  };

  // XML2: Thường ít khi dùng NGAY_KQ nhưng vẫn nên check nếu có dữ liệu
  xml2Records.forEach((record, rowIndex) => {
    const xml1Record = xml1MapByMaLk.get(record.MA_LK);
    if (xml1Record) {
      checkNgayKqOutOfBounds('XML2', record, rowIndex, xml1Record, 'Thuốc');
    }
  });

  // XML3: Trọng tâm của NGAY_KQ (Xét nghiệm, CĐHA, TDCN)
  xml3Records.forEach((record, rowIndex) => {
    const xml1Record = xml1MapByMaLk.get(record.MA_LK);
    if (xml1Record) {
      checkNgayKqOutOfBounds('XML3', record, rowIndex, xml1Record, 'DVKT');
    }
  });

  // --- Lỗi NGAY_TH_YL ngoài đợt điều trị (Check XML2 và XML3) ---
  // NGAY_TH_YL < NGAY_VAO
  // NGAY_TH_YL > NGAY_RA
  // Cảnh báo NGAY_TH_YL = NGAY_VAO
  // Cảnh báo NGAY_TH_YL = NGAY_RA

  const checkNgayThYlOutOfBounds = (
    sheetName: string,
    record: Record<string, string>,
    rowIndex: number,
    xml1Record: Record<string, string>,
    label: string, // "Thuốc" hoặc "DVKT"
  ) => {
    const ngayThYl = record.NGAY_TH_YL;
    const ngayVao = xml1Record.NGAY_VAO;
    const ngayRa = xml1Record.NGAY_RA;
    const patientInfo = getPatientInfo(record);

    // Ưu tiên lấy tên cụ thể để báo lỗi
    const itemName = record.TEN_THUOC || record.TEN_DICH_VU || 'Chi phí';

    if (ngayThYl && ngayVao && ngayRa) {
      // 1. Lỗi: Thực hiện trước khi vào viện (Rất nặng)
      if (ngayThYl < ngayVao) {
        errors.push({
          sheetName,
          rowIndex,
          fieldName: 'NGAY_TH_YL',
          errorCode: `Thời gian thực hiện ${label} trước thời điểm vào viện`,
          errorMessage: `${label} [${itemName}]: Thời gian thực hiện (${formatDateTime(ngayThYl)}) trước thời điểm vào viện (${formatDateTime(ngayVao)}).`,
          severity: 'error',
          ...patientInfo,
          extra: {
            NGAY_VAO: ngayVao,
            NGAY_RA: ngayRa,
            NGAY_TH_YL: ngayThYl,
          },
        });
      }

      // 2. Lỗi: Thực hiện sau khi ra viện (Dễ bị xuất toán)
      if (ngayThYl > ngayRa) {
        errors.push({
          sheetName,
          rowIndex,
          fieldName: 'NGAY_TH_YL',
          errorCode: `Thời gian thực hiện ${label} sau thời điểm ra viện`,
          errorMessage: `${label} [${itemName}]: Thời gian thực hiện (${formatDateTime(ngayThYl)}) sau thời điểm ra viện (${formatDateTime(ngayRa)}).`,
          severity: 'error',
          ...patientInfo,
          extra: {
            NGAY_VAO: ngayVao,
            NGAY_RA: ngayRa,
            NGAY_TH_YL: ngayThYl,
          },
        });
      }

      // 3. Cảnh báo: Trùng thời điểm vào/ra
      if (ngayThYl === ngayVao || ngayThYl === ngayRa) {
        const type = ngayThYl === ngayVao ? 'vào' : 'ra';
        errors.push({
          sheetName,
          rowIndex,
          fieldName: 'NGAY_TH_YL',
          errorCode: `Thời gian thực hiện ${label} trùng ngày ${type}`,
          errorMessage: `Cảnh báo: ${label} [${itemName}] có thời gian thực hiện trùng khớp với thời điểm ${type} viện (${formatDateTime(ngayThYl)}).`,
          severity: 'warning',
          ...patientInfo,
          extra: {
            NGAY_VAO: ngayVao,
            NGAY_RA: ngayRa,
            NGAY_TH_YL: ngayThYl,
          },
        });
      }
    }
  };
  // XML2 - Chuyên cho Thuốc
  xml2Records.forEach((record, rowIndex) => {
    const xml1Record = xml1MapByMaLk.get(record.MA_LK);
    if (xml1Record) {
      checkNgayThYlOutOfBounds('XML2', record, rowIndex, xml1Record, 'Thuốc');
    }
  });

  // XML3 - Chuyên cho Dịch vụ kỹ thuật / Vật tư
  xml3Records.forEach((record, rowIndex) => {
    const xml1Record = xml1MapByMaLk.get(record.MA_LK);
    if (xml1Record) {
      // Phân biệt nhanh DVKT và Vật tư nếu cần
      checkNgayThYlOutOfBounds('XML3', record, rowIndex, xml1Record, 'DVKT');
    }
  });

  // --- Kiểm tra SO_NGAY_DTRI (XML1) ---
  xml1Records.forEach((record, rowIndex) => {
    const maLoaiKCB = record.MA_LOAI_KCB;
    const soNgayStr = record.SO_NGAY_DTRI;
    const ngayVao = record.NGAY_VAO;
    const ngayRa = record.NGAY_RA;
    const patientInfo = getPatientInfo(record);

    const soNgay = parseInt(soNgayStr ?? '');
    const inOutDateValid = /^\d{8}$/.test(ngayVao ?? '') && /^\d{8}$/.test(ngayRa ?? '');

    if (maLoaiKCB === '02') {
      const maLk = record.MA_LK;

      const ngayDVKT = new Set(
        xml3Records
          .filter((x) => x.MA_LK === maLk && x.MA_NHOM?.toString().trim() !== '13')
          .map((x) => {
            const ngay = x.NGAY_YL || x.NGAY_TH_YL;
            return ngay?.substring(0, 8); // yyyyMMdd
          })
          .filter(Boolean),
      );

      const expectedDays = ngayDVKT.size;

      if (expectedDays !== soNgay) {
        errors.push({
          sheetName: 'XML1',
          rowIndex,
          fieldName: 'SO_NGAY_DTRI',
          errorCode: 'Lỗi số ngày điều trị ngoại trú',
          errorMessage: `Với MA_LOAI_KCB = ${maLoaiKCB} thì SO_NGAY_DTRI (${soNgay}) phải bằng số ngày thực tế phát sinh DVKT (trừ MA_NHOM=13) ở XML3 (${expectedDays} ngày).`,
          severity: 'warning',
          ...patientInfo,
          extra: {
            MA_LOAI_KCB: maLoaiKCB,
            SO_NGAY_DTRI: String(soNgay),
          },
        });
      }
    }

    if (['01', '07', '09'].includes(maLoaiKCB)) {
      if (soNgay !== 0) {
        errors.push({
          sheetName: 'XML1',
          rowIndex,
          fieldName: 'SO_NGAY_DTRI',
          errorCode: `Lỗi số ngày điều trị cho MA_LOAI_KCB ${maLoaiKCB}`,
          errorMessage: `SO_NGAY_DTRI phải bằng 0 khi MA_LOAI_KCB là ${maLoaiKCB}.`,
          severity: 'warning',
          ...patientInfo,
          extra: {
            MA_LOAI_KCB: maLoaiKCB,
            SO_NGAY_DTRI: String(soNgay),
          },
        });
      }
    }

    if (['03', '04', '06'].includes(maLoaiKCB) && inOutDateValid) {
      const dateDiff = (d1: string, d2: string) => {
        const dt1 = new Date(`${d1.slice(0, 4)}-${d1.slice(4, 6)}-${d1.slice(6, 8)}`);
        const dt2 = new Date(`${d2.slice(0, 4)}-${d2.slice(4, 6)}-${d2.slice(6, 8)}`);
        return Math.floor((dt2.getTime() - dt1.getTime()) / (1000 * 60 * 60 * 24));
      };

      const expectedDays = dateDiff(ngayVao, ngayRa) + 1;
      if (expectedDays !== soNgay) {
        errors.push({
          sheetName: 'XML1',
          rowIndex,
          fieldName: 'SO_NGAY_DTRI',
          errorCode: `Lỗi số ngày điều trị cho MA_LOAI_KCB ${maLoaiKCB}`,
          errorMessage: `SO_NGAY_DTRI phải = NGAY_RA - NGAY_VAO + 1 = ${expectedDays}.`,
          severity: 'warning',
          ...patientInfo,
          extra: {
            MA_LOAI_KCB: maLoaiKCB,
            SO_NGAY_DTRI: String(soNgay),
          },
        });
      }
    }
  });

  // --- 4. KIỂM LỖI MỨC HƯỞNG (XML3) ---
  xml3Records.forEach((record, rowIndex) => {
    const maLk = record.MA_LK?.trim();
    const mucHuong = Number(record.MUC_HUONG);
    const ngayYl = record.NGAY_YL?.trim();

    const xml1 = xml1MapByMaLk.get(maLk || '');
    if (!xml1) return;

    const tongChiBh = Number(xml1.T_TONGCHI_BH || 0);

    // Trường hợp 1: Tổng chi BHYT nhỏ hơn 351.000 thì phải hưởng 100%
    if (tongChiBh <= 351000 && mucHuong !== 100) {
      errors.push({
        sheetName: 'XML3',
        rowIndex,
        fieldName: 'MUC_HUONG',
        errorCode: 'Lỗi mức hưởng',
        errorMessage: `Mức hưởng phải là 100% khi tổng chi BHYT ≤ 351.000 vnđ (hiện tại: ${mucHuong}%).`,
        severity: 'error',
        ...getPatientInfo(record),
        extra: {
          T_TONGCHI_BH: String(tongChiBh),
          MUC_HUONG: String(mucHuong),
        },
      });
    }

    // Trường hợp 2: Đối chiếu mức hưởng thẻ BHYT theo ngày hiệu lực
    const gtTu = xml1.GT_THE_TU?.trim();
    const gtDen = xml1.GT_THE_DEN?.trim();
    const maThe = xml1.MA_THE_BHYT?.trim();

    const isValidDate = (!gtTu || ngayYl >= gtTu) && (!gtDen || ngayYl <= gtDen);

    if (isValidDate && maThe) {
      const mucHuongDm = mucHuongList.find((dm) => dm.MA_THE === maThe);

      if (mucHuongDm && mucHuong !== Number(mucHuongDm.TY_LE)) {
        errors.push({
          sheetName: 'XML3',
          rowIndex,
          fieldName: 'MUC_HUONG',
          errorCode: 'Lỗi mức hưởng',
          errorMessage: `Mức hưởng ${mucHuong}% không khớp với mức hưởng của thẻ ${maThe} (${mucHuongDm.TY_LE}%).`,
          severity: 'error',
          ...getPatientInfo(record),
          extra: {
            T_TONGCHI_BH: String(tongChiBh),
            MUC_HUONG: String(mucHuong),
          },
        });
      }
    }
  });

  // --- Kiểm tra dữ liệu liên quan giữa XML1, XML7 và XML8 ---
  // --- Lỗi thiếu dữ liệu bảng 7 và bảng 8 ---
  xml1Records.forEach((record, rowIndex) => {
    const maLoaiKCB = record.MA_LOAI_KCB;
    const maLk = record.MA_LK;
    const patientInfo = getPatientInfo(record);
    if (!['03', '04', '06', '09'].includes(maLoaiKCB)) return;

    const hasXML7 = xml7MaLkSet.has(maLk);
    const hasXML8 = xml8MaLkSet.has(maLk);

    if (!hasXML7) {
      errors.push({
        sheetName: 'XML1',
        rowIndex,
        fieldName: 'MA_LK',
        errorCode: `Thiếu dữ liệu XML`,
        errorMessage: `Thiếu dữ liệu XML7: Bắt buộc phải có khi MA_LOAI_KCB = 03, 04, 06, 09.`,
        severity: 'warning',
        ...patientInfo,
      });
    }

    if (!hasXML8) {
      errors.push({
        sheetName: 'XML1',
        rowIndex,
        fieldName: 'MA_LK',
        errorCode: `Thiếu dữ liệu XML`,
        errorMessage: `Thiếu dữ liệu XML7: Bắt buộc phải có khi MA_LOAI_KCB = 03, 04, 06, 09.`,
        severity: 'warning',
        ...patientInfo,
      });
    }
  });

  // --- Lỗi trùng thời gian y lệnh ---
  // Hàm hỗ trợ để chuẩn hóa và lấy danh sách người thực hiện duy nhất
  function getNormalizedPerformerArray(raw: string): string[] {
    return splitAndNormalize(raw);
  }

  function validateDuplicateNgayYlByBacSi(
    xml2Records: Record<string, string>[],
    xml3Records: Record<string, string>[],
    getPatientInfo: (record: Record<string, string>) => {
      maLk?: string;
      hoTen?: string;
      ngayVao?: string;
      ngayRa?: string;
    },
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    const allRecords = [
      ...xml2Records.map((r, i) => ({ record: r, rowIndex: i, sheetName: 'XML2' })),
      ...xml3Records.map((r, i) => ({ record: r, rowIndex: i, sheetName: 'XML3' })),
    ];

    const yLenhMap = new Map<
      string,
      { record: Record<string, string>; rowIndex: number; sheetName: string }[]
    >();

    // Gom theo MA_BAC_SI + NGAY_YL
    allRecords.forEach(({ record, rowIndex, sheetName }) => {
      const maBacSi = record.MA_BAC_SI?.trim();
      let ngayYl = record.NGAY_YL?.trim();
      const maLk = record.MA_LK?.trim();

      if (!maBacSi || !ngayYl || !maLk) return;

      const key = `${maBacSi}_${ngayYl}`;
      if (!yLenhMap.has(key)) yLenhMap.set(key, []);
      yLenhMap.get(key)!.push({ record, rowIndex, sheetName });
    });

    for (const [key, recordGroup] of yLenhMap.entries()) {
      const distinctMaLk = new Set(recordGroup.map((r) => r.record.MA_LK));
      if (distinctMaLk.size <= 1) continue; // Không lỗi nếu cùng MA_LK

      const parts = key.split('_');
      const ngayYl = parts[1];

      for (const { record, rowIndex, sheetName } of recordGroup) {
        const p = getPatientInfo(record);
        const isXML3 = sheetName === 'XML3';
        const maDvkt = isXML3 ? record.MA_DICH_VU : '';
        const tenDvkt = isXML3 ? record.TEN_DICH_VU : '';

        errors.push({
          sheetName,
          rowIndex,
          fieldName: 'NGAY_YL',
          errorCode: 'Trùng thời gian y lệnh cùng một bác sĩ cho nhiều BN',
          errorMessage: `Trùng NGAY_YL ${
            isXML3 ? ` dịch vụ [${maDvkt}] - ${tenDvkt}` : 'Thuốc'
          }. NGAY_YL = ${formatDateTime(ngayYl)}. NGUOI_THUC_HIEN: ${
            record.MA_BAC_SI || 'Không rõ'
          }. Mã LK trùng: ${[...distinctMaLk].filter((ma) => ma !== p.maLk).join(', ')}`,
          severity: 'error',
          ...p,
          extra: {
            MA_BAC_SI: record.MA_BAC_SI,
            NGAY_YL: ngayYl,
          },
        });
      }
    }
    return errors;
  }

  errors.push(...validateDuplicateNgayYlByBacSi(xml2Records, xml3Records, getPatientInfo));

  // --- Lỗi NGAY_HEN_KL sai ---
  xml14Records.forEach((record, rowIndex) => {
    const ngayHenKlStr = record.NGAY_HEN_KL?.trim();
    if (!ngayHenKlStr) return;

    const ngayHenKl = ngayHenKlStr;
    if (!ngayHenKl) return; // Không kiểm nếu ngày không hợp lệ

    const ngayRa = record.NGAY_RA;
    const ngayVaoNoiTru = record.NGAY_VAO_NOI_TRU;
    const ngayVao = record.NGAY_VAO;

    const hasProblem =
      (ngayRa && ngayHenKl <= ngayRa) ||
      (ngayVaoNoiTru && ngayHenKl <= ngayVaoNoiTru) ||
      (ngayVao && ngayHenKl <= ngayVao);

    if (hasProblem) {
      const patientInfo = getPatientInfo(record);
      errors.push({
        sheetName: 'XML14',
        rowIndex,
        fieldName: 'NGAY_HEN_KL',
        errorCode: 'Ngày hẹn khám lại không hợp lệ',
        errorMessage:
          `Lỗi NGAY_HEN_KL: Ngày hẹn khám lại (${formatDateTime(ngayHenKlStr)}) ` +
          `phải sau NGAY_RA, NGAY_VAO_NOI_TRU hoặc NGAY_VAO.`,
        severity: 'error',
        ...patientInfo,
        extra: {
          NGAY_RA: ngayRa,
          NGAY_VAO_NOI_TRU: ngayVaoNoiTru,
          NGAY_VAO: ngayVao,
          NGAY_HEN_KL: ngayHenKlStr,
        },
      });
    }
  });

  // --- NGAY_YL ngoài thời gian đăng ký KCB ---
  const allowedLoaiKCB = ['01', '02', '04', '05', '07', '08'];

  const xml1Map = new Map<string, string>(); // MA_LK => MA_LOAI_KCB
  xml1Records.forEach((r) => {
    if (r.MA_LK && r.MA_LOAI_KCB) {
      xml1Map.set(r.MA_LK, r.MA_LOAI_KCB.toString().padStart(2, '0'));
    }
  });

  xml2Records.forEach((record, rowIndex) => {
    const defaultKhungGio = {
      sang: { start: '07:30', end: '11:30' },
      chieu: { start: '13:30', end: '17:00' },
    };

    // Kết hợp khung giờ từ hệ thống với khung giờ mặc định
    const settings = {
      sang: {
        start: khungGioKCB?.sang?.start || defaultKhungGio.sang.start,
        end: khungGioKCB?.sang?.end || defaultKhungGio.sang.end,
      },
      chieu: {
        start: khungGioKCB?.chieu?.start || defaultKhungGio.chieu.start,
        end: khungGioKCB?.chieu?.end || defaultKhungGio.chieu.end,
      },
    };

    const maLk = record.MA_LK;
    const maLoaiKcb = xml1Map.get(maLk);

    // Kiểm tra loại KCB
    if (!allowedLoaiKCB.includes(maLoaiKcb || '')) return;

    // 2. Hàm parse thời gian
    const parseToMinutes = (timeStr: string) => {
      if (!timeStr || typeof timeStr !== 'string') return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const sangStart = parseToMinutes(settings.sang.start);
    const sangEnd = parseToMinutes(settings.sang.end);
    const chieuStart = parseToMinutes(settings.chieu.start);
    const chieuEnd = parseToMinutes(settings.chieu.end);

    const timeFields = ['NGAY_YL', 'NGAY_TH_YL'];
    const outOfTimeDetails: { field: string; timeStr: string }[] = [];

    timeFields.forEach((field) => {
      const val = record[field]?.toString();
      if (!val || val.length < 12) return;

      const hh = parseInt(val.slice(8, 10), 10);
      const mm = parseInt(val.slice(10, 12), 10);
      const totalMinutes = hh * 60 + mm;

      const inSang = totalMinutes >= sangStart && totalMinutes <= sangEnd;
      const inChieu = totalMinutes >= chieuStart && totalMinutes <= chieuEnd;

      if (!inSang && !inChieu) {
        outOfTimeDetails.push({ field, timeStr: formatDateTime(val) });
      }
    });

    if (outOfTimeDetails.length > 0) {
      const maThuoc = record.MA_THUOC;
      const tenThuoc = record.TEN_THUOC;
      const detailText = outOfTimeDetails
        .map((d) => `${d.field} Thuốc [${maThuoc} - ${tenThuoc}] (${d.timeStr})`)
        .join(', ');
      const khungGioText = `Sáng (${settings.sang.start} - ${settings.sang.end}), Chiều (${settings.chieu.start} - ${settings.chieu.end})`;

      errors.push({
        sheetName: 'XML2',
        rowIndex,
        fieldName: outOfTimeDetails.map((d) => d.field).join(', '),
        errorCode: 'Thời gian Y lệnh thuốc ngoài khoảng thời gian hoat động',
        errorMessage: `${detailText} nằm ngoài giờ hành chính đã đăng ký: ${khungGioText}`,
        severity: 'warning',
        ...getPatientInfo(record),
        extra: {
          MA_THUOC: maThuoc,
          TEN_THUOC: tenThuoc,
          NGAY_YL: record.NGAY_YL,
        },
      });
    }
  });

  xml3Records.forEach((record, rowIndex) => {
    // 1. Khởi tạo khung giờ mặc định nếu chưa tồn tại hoặc thiếu dữ liệu
    const defaultKhungGio = {
      sang: { start: '07:30', end: '11:30' },
      chieu: { start: '13:30', end: '17:00' },
    };

    // Kết hợp khung giờ từ hệ thống với khung giờ mặc định
    const settings = {
      sang: {
        start: khungGioKCB?.sang?.start || defaultKhungGio.sang.start,
        end: khungGioKCB?.sang?.end || defaultKhungGio.sang.end,
      },
      chieu: {
        start: khungGioKCB?.chieu?.start || defaultKhungGio.chieu.start,
        end: khungGioKCB?.chieu?.end || defaultKhungGio.chieu.end,
      },
    };

    const maLk = record.MA_LK;
    const maLoaiKcb = xml1Map.get(maLk);

    // Kiểm tra loại KCB
    if (!allowedLoaiKCB.includes(maLoaiKcb || '')) return;

    // 2. Hàm parse thời gian
    const parseToMinutes = (timeStr: string) => {
      if (!timeStr || typeof timeStr !== 'string') return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const sangStart = parseToMinutes(settings.sang.start);
    const sangEnd = parseToMinutes(settings.sang.end);
    const chieuStart = parseToMinutes(settings.chieu.start);
    const chieuEnd = parseToMinutes(settings.chieu.end);

    const timeFields = ['NGAY_YL', 'NGAY_TH_YL'];
    const outOfTimeDetails: { field: string; timeStr: string }[] = [];

    timeFields.forEach((field) => {
      const val = record[field]?.toString();
      if (!val || val.length < 12) return;

      // Lấy HHmm từ vị trí 8 đến 12 (định dạng YYYYMMDDHHmm)
      const hh = parseInt(val.slice(8, 10), 10);
      const mm = parseInt(val.slice(10, 12), 10);
      const totalMinutes = hh * 60 + mm;

      const inSang = totalMinutes >= sangStart && totalMinutes <= sangEnd;
      const inChieu = totalMinutes >= chieuStart && totalMinutes <= chieuEnd;

      if (!inSang && !inChieu) {
        outOfTimeDetails.push({
          field,
          timeStr: typeof formatDateTime === 'function' ? formatDateTime(val) : val,
        });
      }
    });

    // 3. Đẩy lỗi vào danh sách nếu vi phạm
    if (outOfTimeDetails.length > 0) {
      const maDv = record.MA_DICH_VU || 'N/A';
      const tenDv = record.TEN_DICH_VU || 'N/A';
      const maNhom = record.MA_NHOM?.toString();

      const detailText = outOfTimeDetails
        .map((d) => `${d.field} [${maDv} - ${tenDv}] (${d.timeStr})`)
        .join(', ');

      const khungGioText = `Sáng (${settings.sang.start}-${settings.sang.end}), Chiều (${settings.chieu.start}-${settings.chieu.end})`;

      // Công khám
      if (maNhom === '13') {
        errors.push({
          sheetName: 'XML3',
          rowIndex,
          fieldName: outOfTimeDetails.map((d) => d.field).join(', '),
          errorCode: 'Công khám ngoài khoảng thời gian hoạt động',
          errorMessage: `${detailText} nằm ngoài giờ hành chính của công khám: ${khungGioText}`,
          severity: 'warning',
          ...(typeof getPatientInfo === 'function' ? getPatientInfo(record) : {}),
        });
      }
      // DVKT
      else {
        errors.push({
          sheetName: 'XML3',
          rowIndex,
          fieldName: outOfTimeDetails.map((d) => d.field).join(', '),
          errorCode: 'DVKT ngoài khoảng thời gian hoạt động',
          errorMessage: `${detailText} nằm ngoài giờ hành chính của DVKT: ${khungGioText}`,
          severity: 'warning',
          ...(typeof getPatientInfo === 'function' ? getPatientInfo(record) : {}),
        });
      }
    }
  });

  // --- Kiểm tra NGAY_VAO và NGAY_RA ngoài giờ hoạt động (XML1) - Chuyên đề Thời gian ngoài giấy phép ---
  xml1Records.forEach((record, rowIndex) => {
    const defaultKhungGio = {
      sang: { start: '07:30', end: '11:30' },
      chieu: { start: '13:30', end: '17:00' },
    };

    // Kết hợp khung giờ từ hệ thống với khung giờ mặc định
    const settings = {
      sang: {
        start: khungGioKCB?.sang?.start || defaultKhungGio.sang.start,
        end: khungGioKCB?.sang?.end || defaultKhungGio.sang.end,
      },
      chieu: {
        start: khungGioKCB?.chieu?.start || defaultKhungGio.chieu.start,
        end: khungGioKCB?.chieu?.end || defaultKhungGio.chieu.end,
      },
    };

    const patientInfo = getPatientInfo(record);

    // Hàm parse thời gian từ chuỗi HH:mm
    const parseToMinutes = (timeStr: string) => {
      if (!timeStr || typeof timeStr !== 'string') return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const sangStart = parseToMinutes(settings.sang.start);
    const sangEnd = parseToMinutes(settings.sang.end);
    const chieuStart = parseToMinutes(settings.chieu.start);
    const chieuEnd = parseToMinutes(settings.chieu.end);

    const outOfTimeDetails: { field: string; timeStr: string; value: string }[] = [];

    // Kiểm tra NGAY_VAO
    const ngayVao = record.NGAY_VAO?.toString();
    if (ngayVao && ngayVao.length >= 12) {
      const hh = parseInt(ngayVao.slice(8, 10), 10);
      const mm = parseInt(ngayVao.slice(10, 12), 10);
      const totalMinutes = hh * 60 + mm;

      const inSang = totalMinutes >= sangStart && totalMinutes <= sangEnd;
      const inChieu = totalMinutes >= chieuStart && totalMinutes <= chieuEnd;

      if (!inSang && !inChieu) {
        outOfTimeDetails.push({
          field: 'NGAY_VAO',
          timeStr: formatDateTime(ngayVao),
          value: ngayVao,
        });
      }
    }

    // Kiểm tra NGAY_RA
    const ngayRa = record.NGAY_RA?.toString();
    if (ngayRa && ngayRa.length >= 12) {
      const hh = parseInt(ngayRa.slice(8, 10), 10);
      const mm = parseInt(ngayRa.slice(10, 12), 10);
      const totalMinutes = hh * 60 + mm;

      const inSang = totalMinutes >= sangStart && totalMinutes <= sangEnd;
      const inChieu = totalMinutes >= chieuStart && totalMinutes <= chieuEnd;

      if (!inSang && !inChieu) {
        outOfTimeDetails.push({
          field: 'NGAY_RA',
          timeStr: formatDateTime(ngayRa),
          value: ngayRa,
        });
      }
    }

    if (outOfTimeDetails.length > 0) {
      const detailText = outOfTimeDetails.map((d) => `${d.field} (${d.timeStr})`).join(', ');

      const khungGioText = `Sáng (${settings.sang.start} - ${settings.sang.end}), Chiều (${settings.chieu.start} - ${settings.chieu.end})`;

      errors.push({
        sheetName: 'XML1',
        rowIndex,
        fieldName: outOfTimeDetails.map((d) => d.field).join(', '),
        errorCode: 'Thời gian vào/ra ngoài giờ hoạt động',
        errorMessage: `${detailText} nằm ngoài giờ hành chính của cơ sở (giấy phép hoạt động): ${khungGioText}`,
        severity: 'warning',
        topic: 'chuyen-de',
        ...patientInfo,
        extra: {
          NGAY_VAO: ngayVao,
          NGAY_RA: ngayRa,
          KHUNG_GIO: `${settings.sang.start} - ${settings.sang.end}, ${settings.chieu.start} - ${settings.chieu.end}`,
        },
      });
    }
  });

  // --- Kiểm tra thiếu XML14 khi có NGAY_TAI_KHAM ---
  xml1Records.forEach((record, rowIndex) => {
    const maLk = record.MA_LK?.toString().trim();
    const ngayTaiKham = record.NGAY_TAI_KHAM?.toString().trim();
    const patientInfo = getPatientInfo(record);

    if (ngayTaiKham) {
      const hasXML14 = (xml14Records || []).some((r) => r.MA_LK?.toString().trim() === maLk);

      if (!hasXML14) {
        errors.push({
          sheetName: 'XML1',
          rowIndex,
          fieldName: 'NGAY_TAI_KHAM',
          errorCode: 'Thiếu XML14 khi có NGAY_TAI_KHAM',
          errorMessage:
            'Lỗi thiếu XML14: NGAY_TAI_KHAM có dữ liệu nhưng không có bản ghi trong XML14.',
          severity: 'warning',
          ...patientInfo,
        });
      }
    }
  });

  const doctorList: DanhMucNhanVien[] = doctorMap;

  // Chuyển từ mảng sang Map, bỏ entry không có mã tương đương
  const doctors = new Map<string, DanhMucNhanVien>();
  for (const entry of doctorList) {
    if (entry.MACCHN) {
      doctors.set(entry.MACCHN.trim(), entry);
    }
  }

  // --- Lỗi Trùng MA_MAY ---
  const maMayNgayMap = new Map<
    string,
    { maLk: string; rowIndex: number; record: Record<string, string> }[]
  >();

  xml3Records.forEach((record, rowIndex) => {
    const maMay = record.MA_MAY?.trim();
    const ngayThYl = record.NGAY_TH_YL?.trim();
    const maLk = record.MA_LK?.trim();
    const maNhom = record.MA_NHOM?.trim();
    if (!maMay || !ngayThYl || !maLk || maNhom === '1') return;

    const key = `${maMay}_${ngayThYl.slice(0, 8)}`; // gom theo ngày
    if (!maMayNgayMap.has(key)) {
      maMayNgayMap.set(key, []);
    }
    maMayNgayMap.get(key)!.push({ maLk, rowIndex, record });
  });

  // --- Duyệt từng nhóm ---
  for (const [, group] of maMayNgayMap.entries()) {
    // Sắp xếp theo thời gian bắt đầu (số)
    group.sort((a, b) => Number(a.record.NGAY_TH_YL) - Number(b.record.NGAY_TH_YL));

    const reportedPairs = new Set<string>();

    for (let i = 0; i < group.length; i++) {
      const cur = group[i];
      const startA = Number(cur.record.NGAY_TH_YL);
      const endA = Number(cur.record.NGAY_KQ);
      if (!startA || !endA) continue;

      for (let j = i + 1; j < group.length; j++) {
        const next = group[j];
        const startB = Number(next.record.NGAY_TH_YL);
        const endB = Number(next.record.NGAY_KQ);
        if (!startB || !endB) continue;

        // Kiểm tra chồng lấn thời gian (so sánh số)
        const overlap = startA < endB && startB < endA && cur.record.MA_LK !== next.record.MA_LK;

        if (overlap) {
          const pairKey = [cur.record.MA_LK, next.record.MA_LK].sort().join('_');
          if (reportedPairs.has(pairKey)) continue;
          reportedPairs.add(pairKey);

          // 🔹 Lấy thông tin BN từ XML1
          const bnB = xml1MapByMaLk.get(next.record.MA_LK?.trim() || '') || {};
          const maBnB = bnB.MA_BN || next.record.MA_BN || '';
          const tenBnB = bnB.HO_TEN || bnB.HO_TEN || next.record.HO_TEN || '';

          errors.push({
            sheetName: 'XML3',
            rowIndex: cur.rowIndex,
            fieldName: 'MA_MAY',
            errorCode: 'Trùng thời gian trên cùng máy với BN khác',
            errorMessage: `Máy '${cur.record.MA_MAY}' bị trùng thời gian [${formatDateTime(
              cur.record.NGAY_TH_YL,
            )}–${formatDateTime(cur.record.NGAY_KQ)}] với BN ${maBnB} (${tenBnB}) [${formatDateTime(
              next.record.NGAY_TH_YL,
            )}–${formatDateTime(next.record.NGAY_KQ)}]`,
            severity: 'error',
            ...getPatientInfo(cur.record),
          });
        }
      }
    }
  }

  // --- Kiểm tra thiếu XML9 khi có CAN_NANG_CON ---
  xml1Records.forEach((record, rowIndex) => {
    const maLk = record.MA_LK?.toString().trim();
    const canNangCon = record.CAN_NANG_CON?.toString().trim();
    const patientInfo = getPatientInfo(record);

    if (canNangCon) {
      const hasXML9 = xml9MaLkSet.has(maLk);

      if (!hasXML9) {
        errors.push({
          sheetName: 'XML1',
          rowIndex,
          fieldName: 'CAN_NANG_CON',
          errorCode: 'THIEU_XML9',
          errorMessage:
            'Lỗi thiếu XML9: Có giá trị CAN_NANG_CON nhưng không tìm thấy bản ghi tương ứng trong XML9.',
          severity: 'warning',
          ...patientInfo,
        });
      }
    }
  });

  // --- Bắt đầu quy tắc mới: Trùng thời gian y lệnh/thực hiện/kết quả khác MA_LK, cùng NGUOI_THUC_HIEN (  XML3) ---
  const nhomForCrossLkDuplicate = ['2', '3', '8', '13', '18'];
  // Bước 1: Tạo Map để nhóm các bản ghi theo người thực hiện duy nhất
  const recordsByIndividualPerformer = new Map<
    string,
    Array<Record<string, string> & { originalIndex: string }>
  >();

  xml3Records.forEach((record, idx) => {
    const performers = getNormalizedPerformerArray(record.NGUOI_THUC_HIEN);
    performers.forEach((performer) => {
      if (!recordsByIndividualPerformer.has(performer)) {
        recordsByIndividualPerformer.set(performer, []);
      }
      recordsByIndividualPerformer
        .get(performer)
        ?.push({ ...record, originalIndex: (idx + 2).toString() });
    });
  });

  // Bước 2: Duyệt từng người thực hiện (duy nhất) và kiểm tra các bản ghi liên quan
  recordsByIndividualPerformer.forEach((recordsForPerformer, currentPerformer) => {
    // Chỉ cần ít nhất 2 bản ghi để có thể so sánh cặp
    if (recordsForPerformer.length < 2) {
      return;
    }

    // So sánh từng cặp bản ghi mà `currentPerformer` tham gia
    for (let i = 0; i < recordsForPerformer.length; i++) {
      for (let j = i + 1; j < recordsForPerformer.length; j++) {
        const recordA = recordsForPerformer[i];
        const recordB = recordsForPerformer[j];

        // Điều kiện 1: Khác MA_LK (trùng lặp liên lượt khám)
        if (recordA.MA_LK === recordB.MA_LK) {
          continue;
        }

        // Điều kiện 2: Cả hai bản ghi phải thuộc nhóm DVKT cần kiểm tra
        const isNhomAValid = nhomForCrossLkDuplicate.includes(recordA.MA_NHOM);
        const isNhomBValid = nhomForCrossLkDuplicate.includes(recordB.MA_NHOM);

        if (!isNhomAValid || !isNhomBValid) {
          continue;
        }

        // Điều kiện 3: Có ít nhất một người thực hiện chung (đã được đảm bảo bởi Map recordsByIndividualPerformer)
        // `currentPerformer` là người thực hiện chung đang được kiểm tra.

        // Lấy thông tin chi tiết cho báo cáo lỗi
        const maLkA = recordA.MA_LK;
        const maLkB = recordB.MA_LK;
        const maDvktA = recordA.MA_DICH_VU;
        const maDvktB = recordB.MA_DICH_VU;
        const tenDichVuA = recordA.TEN_DICH_VU;
        const tenDichVuB = recordB.TEN_DICH_VU;

        // Lấy thông tin bệnh nhân (cần truyền xml1MapByMaLk vào hàm getPatientInfo)
        // Giả định xml1MapByMaLk có sẵn trong scope này
        const patientInfoA = getPatientInfo(recordA);
        const patientInfoB = getPatientInfo(recordB);

        // Lấy thời gian thực hiện/kết quả đã được phân tích đầy đủ (ngày + giờ)
        const ngayThYlA = getParsedDateTime(recordA.NGAY_TH_YL);
        const ngayThYlB = getParsedDateTime(recordB.NGAY_TH_YL);
        const ngayKqA = getParsedDateTime(recordA.NGAY_KQ);
        const ngayKqB = getParsedDateTime(recordB.NGAY_KQ);

        // --- Kiểm tra trùng NGAY_TH_YL chính xác (cả ngày và giờ) ---
        if (ngayThYlA && ngayThYlB && ngayThYlA.getTime() === ngayThYlB.getTime()) {
          errors.push({
            sheetName: 'XML3',
            rowIndex: Number(recordA.originalIndex),
            fieldName: 'NGAY_TH_YL',
            errorCode: 'Trùng thời gian thực hiện y lệnh giữa các BN khác nhau',
            errorMessage: `Lỗi: Dịch vụ kỹ thuật "${tenDichVuA}" (Mã: ${maDvktA}) được thực hiện bởi "${currentPerformer}" trùng NGAY_TH_YL (${formatDateTime(
              recordA.NGAY_TH_YL,
            )}) với BN "${patientInfoB.hoTen}" (MA_LK: ${maLkB}).`,
            severity: 'error',
            ...patientInfoA, // Thông tin
          });
          // Có thể thêm lỗi cho recordB nếu muốn cả hai bản ghi đều hiển thị lỗi
          errors.push({
            sheetName: 'XML3',
            rowIndex: Number(recordB.originalIndex),
            fieldName: 'NGAY_TH_YL',
            errorCode: 'Trùng thời gian thực hiện y lệnh giữa các BN khác nhau',
            errorMessage: `Lỗi: Dịch vụ kỹ thuật "${tenDichVuB}" (Mã: ${maDvktB}) được thực hiện bởi "${currentPerformer}" trùng NGAY_TH_YL (${formatDateTime(
              recordB.NGAY_TH_YL,
            )}) với BN "${patientInfoA.hoTen}" (MA_LK: ${maLkA}).`,
            severity: 'error',
            ...patientInfoB,
          });
        }

        // --- Kiểm tra trùng NGAY_KQ chính xác (cả ngày và giờ) ---
        if (ngayKqA && ngayKqB && ngayKqA.getTime() === ngayKqB.getTime()) {
          errors.push({
            sheetName: 'XML3',
            rowIndex: Number(recordA.originalIndex),
            fieldName: 'NGAY_KQ',
            errorCode: 'Trùng thời gian kết quả giữa các BN khác nhau',
            errorMessage: `Lỗi: Dịch vụ kỹ thuật "${tenDichVuA}" (Mã: ${maDvktA}) có kết quả bởi "${currentPerformer}" trùng NGAY_KQ (${formatDateTime(
              recordA.NGAY_KQ,
            )}) với BN "${patientInfoB.hoTen}" (MA_LK: ${maLkB}).`,
            severity: 'error',
            ...patientInfoA,
          });
          errors.push({
            sheetName: 'XML3',
            rowIndex: Number(recordB.originalIndex),
            fieldName: 'NGAY_KQ',
            errorCode: 'Trùng thời gian kết quả giữa các BN khác nhau',
            errorMessage: `Lỗi: Dịch vụ kỹ thuật "${tenDichVuB}" (Mã: ${maDvktB}) có kết quả bởi "${currentPerformer}" trùng NGAY_KQ (${formatDateTime(
              recordB.NGAY_KQ,
            )}) với BN "${patientInfoA.hoTen}" (MA_LK: ${maLkA}).`,
            severity: 'error',
            ...patientInfoB,
          });
        }
        // --- Kiểm tra NGAY_TH_YL của A trùng NGAY_KQ của B ---
        if (ngayThYlA && ngayKqB && ngayThYlA.getTime() === ngayKqB.getTime()) {
          errors.push({
            sheetName: 'XML3',
            rowIndex: Number(recordA.originalIndex),
            fieldName: 'NGAY_TH_YL',
            errorCode: 'Trùng thời gian thực hiện y lệnh với thời gian kết quả của BN khác',
            errorMessage: `Lỗi: Dịch vụ "${tenDichVuA}" (Mã: ${maDvktA}) được thực hiện bởi "${currentPerformer}" có NGAY_TH_YL (${formatDateTime(
              recordA.NGAY_TH_YL,
            )}) trùng với NGAY_KQ Dịch vụ "${tenDichVuB}" (Mã: ${maDvktB}) của BN "${patientInfoB.hoTen}" (MA_LK: ${maLkB}).`,
            severity: 'error',
            ...patientInfoA,
          });
        }

        // --- Kiểm tra NGAY_KQ của A trùng NGAY_TH_YL của B ---
        if (ngayKqA && ngayThYlB && ngayKqA.getTime() === ngayThYlB.getTime()) {
          errors.push({
            sheetName: 'XML3',
            rowIndex: Number(recordA.originalIndex),
            fieldName: 'NGAY_KQ',
            errorCode: 'Trùng thời gian kết quả với thời gian thực hiện của BN khác',
            errorMessage: `Lỗi: Dịch vụ "${tenDichVuA}" (Mã: ${maDvktA}) có NGAY_KQ (${formatDateTime(
              recordA.NGAY_KQ,
            )}) trùng với NGAY_TH_YL của Dịch vụ "${tenDichVuB}" (Mã: ${maDvktB}) của BN "${patientInfoB.hoTen}" (MA_LK: ${maLkB}), cùng người thực hiện "${currentPerformer}".`,
            severity: 'error',
            ...patientInfoA,
          });
        }
      }
    }
  });

  const targetDvktGroups = ['1', '2', '3', '8', '13', '18'];

  // Map: MA_LK -> (MA_BAC_SI -> Array of NGAY_YL_THUOC)
  const xml2YLenhThuocByMaLkAndDoctor = new Map<string, Map<string, string[]>>();
  xml2Records.forEach((record) => {
    const maLk = record.MA_LK;
    const maBacSi = record.MA_BAC_SI;
    const ngayYlThuoc = record.NGAY_YL;
    if (maLk && maBacSi && ngayYlThuoc) {
      if (!xml2YLenhThuocByMaLkAndDoctor.has(maLk)) {
        xml2YLenhThuocByMaLkAndDoctor.set(maLk, new Map<string, string[]>());
      }
      const doctorMap = xml2YLenhThuocByMaLkAndDoctor.get(maLk)!;
      if (!doctorMap.has(maBacSi)) {
        doctorMap.set(maBacSi, []);
      }
      doctorMap.get(maBacSi)?.push(ngayYlThuoc);
    }
  });

  // Duyệt qua các dịch vụ kỹ thuật trong XML3 và so sánh
  xml3Records.forEach((dvktRecord, rowIndex) => {
    const maLkDvkt = dvktRecord.MA_LK;
    const maBacSiDvkt = dvktRecord.MA_BAC_SI;
    const maNhomDvkt = dvktRecord.MA_NHOM;
    const tenDichVu = dvktRecord.TEN_DICH_VU;

    // Lấy giá trị của 3 trường ngày/giờ từ DVKT record
    const ngayYlDvkt = dvktRecord.NGAY_YL;
    const ngayThYlDvkt = dvktRecord.NGAY_TH_YL;
    const ngayKqDvkt = dvktRecord.NGAY_KQ;

    // Lấy thông tin MA_LOAI_KCB từ XML1 cho lượt khám này
    const xml1RecordForDvkt = xml1MapByMaLk.get(maLkDvkt);
    const maLoaiKcb = xml1RecordForDvkt?.MA_LOAI_KCB;
    const patientInfo = getPatientInfo(dvktRecord);
    // Áp dụng các điều kiện ban đầu
    if (
      maLkDvkt &&
      maBacSiDvkt &&
      maLoaiKcb === '01' && // MA_LOAI_KCB = 01
      targetDvktGroups.includes(maNhomDvkt) // MA_NHOM DVKT thuộc các nhóm quy định
    ) {
      const doctorMapForMaLk = xml2YLenhThuocByMaLkAndDoctor.get(maLkDvkt);

      if (doctorMapForMaLk && doctorMapForMaLk.has(maBacSiDvkt)) {
        const yLenhThuocTimes = doctorMapForMaLk.get(maBacSiDvkt)!;
        // Tìm thời gian y lệnh thuốc muộn nhất để so sánh
        let latestYLenhThuoc: string | undefined;
        if (yLenhThuocTimes.length > 0) {
          latestYLenhThuoc = yLenhThuocTimes.reduce((latest, current) => {
            return compareDateTimesYYYYMMDDHHmm(current, latest) > 0 ? current : latest;
          }, yLenhThuocTimes[0]);
        }

        if (latestYLenhThuoc) {
          const problematicFieldsAfter: string[] = [];
          const problematicFieldsEqual: string[] = [];
          const errorDetailsAfter: string[] = [];
          const errorDetailsEqual: string[] = [];

          // Kiểm tra NGAY_YL của DVKT
          if (ngayYlDvkt) {
            const cmp = compareDateTimesYYYYMMDDHHmm(ngayYlDvkt, latestYLenhThuoc);
            if (cmp > 0) {
              problematicFieldsAfter.push('NGAY_YL');
              errorDetailsAfter.push(`NGAY_YL (${formatDateTime(ngayYlDvkt)})`);
            } else if (cmp === 0) {
              problematicFieldsEqual.push('NGAY_YL');
              errorDetailsEqual.push(`NGAY_YL (${formatDateTime(ngayYlDvkt)})`);
            }
          }

          // Kiểm tra NGAY_TH_YL của DVKT
          if (ngayThYlDvkt) {
            const cmp = compareDateTimesYYYYMMDDHHmm(ngayThYlDvkt, latestYLenhThuoc);
            if (cmp > 0) {
              problematicFieldsAfter.push('NGAY_TH_YL');
              errorDetailsAfter.push(`NGAY_TH_YL (${formatDateTime(ngayThYlDvkt)})`);
            } else if (cmp === 0) {
              problematicFieldsEqual.push('NGAY_TH_YL');
              errorDetailsEqual.push(`NGAY_TH_YL (${formatDateTime(ngayThYlDvkt)})`);
            }
          }

          // Kiểm tra NGAY_KQ của DVKT
          if (ngayKqDvkt && maNhomDvkt !== '13') {
            const cmp = compareDateTimesYYYYMMDDHHmm(ngayKqDvkt, latestYLenhThuoc);
            if (cmp > 0) {
              problematicFieldsAfter.push('NGAY_KQ');
              errorDetailsAfter.push(`NGAY_KQ (${formatDateTime(ngayKqDvkt)})`);
            } else if (cmp === 0) {
              problematicFieldsEqual.push('NGAY_KQ');
              errorDetailsEqual.push(`NGAY_KQ (${formatDateTime(ngayKqDvkt)})`);
            }
          }

          if (problematicFieldsAfter.length > 0) {
            errors.push({
              sheetName: 'XML3',
              rowIndex: rowIndex,
              fieldName: problematicFieldsAfter.join(', '),
              errorCode: 'Y lệnh DVKT sau thời gian y lệnh thuốc',
              errorMessage: `Lỗi: Y lệnh DVKT "${tenDichVu}" có ${errorDetailsAfter.join(
                ', ',
              )} sau thời gian y lệnh thuốc (${formatDateTime(latestYLenhThuoc)})`,
              severity: 'error',
              ...patientInfo,
              extra: {
                NGAY_YL: ngayYlDvkt ? formatDateTime(ngayYlDvkt) : '',
                NGAY_TH_YL: ngayThYlDvkt ? formatDateTime(ngayThYlDvkt) : '',
                NGAY_KQ: ngayKqDvkt ? formatDateTime(ngayKqDvkt) : '',
                NGAY_YL_THUOC: formatDateTime(latestYLenhThuoc),
              },
            });
          }

          if (problematicFieldsEqual.length > 0) {
            errors.push({
              sheetName: 'XML3',
              rowIndex: rowIndex,
              fieldName: problematicFieldsEqual.join(', '),
              errorCode: 'Y lệnh DVKT trùng thời gian y lệnh thuốc',
              errorMessage: `Lỗi: Y lệnh DVKT "${tenDichVu}" có ${errorDetailsEqual.join(
                ', ',
              )} trùng thời gian với y lệnh thuốc (${formatDateTime(latestYLenhThuoc)})`,
              severity: 'error',
              ...patientInfo,
              extra: {
                NGAY_YL: ngayYlDvkt ? formatDateTime(ngayYlDvkt) : '',
                NGAY_TH_YL: ngayThYlDvkt ? formatDateTime(ngayThYlDvkt) : '',
                NGAY_KQ: ngayKqDvkt ? formatDateTime(ngayKqDvkt) : '',
                NGAY_YL_THUOC: formatDateTime(latestYLenhThuoc),
              },
            });
          }
        }
      }
    }
  });

  // Map<MA_LK, Map<MA_BAC_SI, Set<NGUOI_THUC_HIEN>>>
  // Map<MA_LK, Set<MA_BAC_SI>>
  const xml3BacSiByMaLk = new Map();

  // gom tất cả bác sĩ khám/thực hiện từ XML3
  xml3Records.forEach((record) => {
    const maLk = record.MA_LK;
    const maNhom = record.MA_NHOM;
    const nguoiThucHien = record.NGUOI_THUC_HIEN;

    if (!maLk || !nguoiThucHien) return;

    // chỉ lấy DVKT nhóm 13 nếu cần
    if (maNhom !== '13') return;

    if (!xml3BacSiByMaLk.has(maLk)) {
      xml3BacSiByMaLk.set(maLk, new Set());
    }

    xml3BacSiByMaLk.get(maLk).add(nguoiThucHien);
  });

  // kiểm tra bác sĩ kê thuốc trong XML2
  xml2Records.forEach((record, rowIndex) => {
    const maLk = record.MA_LK;
    const maBacSi = record.MA_BAC_SI;
    const tenThuoc = record.TEN_THUOC;

    if (!maLk || !maBacSi) return;

    const bacSiXml3Set = xml3BacSiByMaLk.get(maLk);

    // có dữ liệu XML3 nhưng bác sĩ kê không nằm trong danh sách bác sĩ khám
    if (bacSiXml3Set && bacSiXml3Set.size > 0 && !bacSiXml3Set.has(maBacSi)) {
      errors.push({
        sheetName: 'XML2',
        rowIndex,
        fieldName: 'MA_BAC_SI',
        errorCode: 'Bác sĩ kê thuốc không thực hiện khám',
        errorMessage: `Thuốc "${tenThuoc}" có bác sĩ kê (${maBacSi}) không nằm trong danh sách bác sĩ khám/thực hiện DVKT (${Array.from(
          bacSiXml3Set,
        ).join(', ')})`,
        severity: 'error',
        ...getPatientInfo(record),
      });
    }
  });

  // --- Bắt đầu quy tắc: Trùng thời gian y lệnh thuốc (XML2) với DVKT (XML3) của cùng bác sĩ ---
  // XML2: bác sĩ ký y lệnh thuốc
  const yLenhThuocByDoctor = new Map<string, { maLk: string; time: string }[]>();
  xml2Records.forEach((r) => {
    if (r.MA_BAC_SI && r.NGAY_YL) {
      const d = r.MA_BAC_SI.trim();
      if (!yLenhThuocByDoctor.has(d)) yLenhThuocByDoctor.set(d, []);
      yLenhThuocByDoctor.get(d)!.push({ maLk: r.MA_LK, time: r.NGAY_YL });
    }
  });

  // XML3: bác sĩ ký y lệnh DVKT
  const yLenhDvktByDoctor = new Map<
    string,
    { maLk: string; time: string; maDV: string; tenDV: string }[]
  >();
  xml3Records.forEach((r) => {
    if (r.MA_BAC_SI && r.NGAY_YL) {
      const d = r.MA_BAC_SI.trim();
      if (!yLenhDvktByDoctor.has(d)) yLenhDvktByDoctor.set(d, []);
      yLenhDvktByDoctor.get(d)!.push({
        maLk: r.MA_LK,
        time: r.NGAY_YL,
        maDV: r.MA_DICH_VU,
        tenDV: r.TEN_DICH_VU,
      });
    }
  });

  // Kiểm tra trùng thời gian DVKT với y lệnh thuốc hoặc DVKT khác
  // Set để tránh trùng lỗi theo bác sĩ + thời điểm y lệnh
  const ylTimeByDoctorSet = new Set();

  xml3Records.forEach((dvktRecord, rowIndex) => {
    const { NGAY_TH_YL, NGAY_KQ, MA_LK, MA_DICH_VU, TEN_DICH_VU } = dvktRecord;
    // 🔥 Lấy cấu hình DVKT
    const cfg = dvktConfigMap.get(MA_DICH_VU?.trim() || '');

    // 👉 Nếu không có cấu hình hoặc không bật checkTrungEkip thì bỏ qua
    if (!cfg || Number(cfg.checkTrungEkip) !== 1) return;
    const maNhomDvkt = dvktRecord.MA_NHOM;
    if (maNhomDvkt === '13' || maNhomDvkt === '01') return; // bỏ công khám & xét nghiệm

    const nguoiThucHienList = dvktRecord.NGUOI_THUC_HIEN
      ? dvktRecord.NGUOI_THUC_HIEN.split(';').map((s) => s.trim())
      : [];
    if (nguoiThucHienList.length === 0) return;

    if (!NGAY_TH_YL || !NGAY_KQ) return;

    const start = NGAY_TH_YL;
    const end = NGAY_KQ;

    nguoiThucHienList.forEach((doctor) => {
      // 1) Kiểm y lệnh THUỐC
      const ylThuocList = yLenhThuocByDoctor.get(doctor) || [];
      ylThuocList.forEach((yl) => {
        if (yl.maLk !== MA_LK && isBetween(yl.time, start, end)) {
          const keyByTime = `YLThuoc|${doctor}|${formatDateTime(yl.time)}`;
          if (!ylTimeByDoctorSet.has(keyByTime)) {
            ylTimeByDoctorSet.add(keyByTime);
            errors.push({
              sheetName: 'XML3',
              rowIndex,
              fieldName: 'NGAY_TH_YL/NGAY_KQ',
              errorCode: 'Trùng ekip thực hiện DVKT',
              errorMessage:
                `DVKT [${MA_DICH_VU}] - ${TEN_DICH_VU} (${formatDateTime(start)} - ${formatDateTime(
                  end,
                )}) ` +
                `bác sĩ [${doctor}] phát sinh y lệnh thuốc cho BN khác (MA_LK: ${yl.maLk}) ` +
                `${formatDateTime(yl.time)}`,
              severity: 'error',
              ...getPatientInfo(dvktRecord),
            });
          }
        }
      });

      // 2) Kiểm y lệnh DVKT
      const ylDvktList = yLenhDvktByDoctor.get(doctor) || [];
      ylDvktList.forEach((yl) => {
        if (yl.maLk !== MA_LK && isBetween(yl.time, start, end)) {
          const keyByTime = `YLDVKT|${doctor}|${formatDateTime(yl.time)}`;
          if (!ylTimeByDoctorSet.has(keyByTime)) {
            ylTimeByDoctorSet.add(keyByTime);
            errors.push({
              sheetName: 'XML3',
              rowIndex,
              fieldName: 'NGAY_TH_YL/NGAY_KQ',
              errorCode: 'Trùng ekip thực hiện DVKT',
              errorMessage:
                `DVKT [${MA_DICH_VU}] - ${TEN_DICH_VU} (${formatDateTime(start)} - ${formatDateTime(
                  end,
                )}) ` +
                `bác sĩ [${doctor}] phát sinh y lệnh DVKT [${yl.maDV}] - ${yl.tenDV} ` +
                `cho BN khác (MA_LK: ${yl.maLk}) lúc ${formatDateTime(yl.time)}`,
              severity: 'error',
              ...getPatientInfo(dvktRecord),
            });
          }
        }
      });

      // 3) Kiểm NGÀY_KQ của bệnh nhân khác
      xml3Records.forEach((other) => {
        if (other.MA_LK === MA_LK) return;
        if (!other.NGAY_KQ) return;
        if (other.MA_NHOM === '1') return;
        if (other.MA_NHOM === '18') return;
        if (other.MA_NHOM === '2') return;

        const otherDoctors = other.NGUOI_THUC_HIEN
          ? other.NGUOI_THUC_HIEN.split(';').map((s) => s.trim())
          : [];
        if (!otherDoctors.includes(doctor)) return;

        if (isBetween(other.NGAY_KQ, start, end)) {
          const keyByTime = `KQDVKT|${doctor}|${formatDateTime(other.NGAY_KQ)}`;
          if (!ylTimeByDoctorSet.has(keyByTime)) {
            ylTimeByDoctorSet.add(keyByTime);
            errors.push({
              sheetName: 'XML3',
              rowIndex,
              fieldName: 'NGAY_TH_YL/NGAY_KQ',
              errorCode: 'Trùng ekip thực hiện DVKT',
              errorMessage:
                `DVKT [${MA_DICH_VU}] - ${TEN_DICH_VU} (${formatDateTime(start)} - ${formatDateTime(
                  end,
                )}) ` +
                `bác sĩ [${doctor}] phát sinh NGAY_KQ ` +
                ` DVKT [${other.MA_DICH_VU}] - ${other.TEN_DICH_VU} ` +
                `cho BN khác (MA_LK: ${other.MA_LK}) ` +
                `lúc ${formatDateTime(other.NGAY_KQ)}`,
              severity: 'error',
              ...getPatientInfo(dvktRecord),
            });
          }
        }
      });
      // 4) Kiểm TRÙNG EKIP (DVKT - DVKT chồng khoảng)
      xml3Records.forEach((other) => {
        if (other === dvktRecord) return;
        if (other.MA_LK === MA_LK) return; // bỏ cùng bệnh nhân
        if (!other.NGAY_TH_YL || !other.NGAY_KQ) return;
        if (dvktRecord.MA_NHOM === '13' || other.MA_NHOM === '13') return;
        const otherDoctors = other.NGUOI_THUC_HIEN
          ? other.NGUOI_THUC_HIEN.split(';').map((s) => s.trim())
          : [];

        if (!otherDoctors.includes(doctor)) return;

        const otherStart = other.NGAY_TH_YL;
        const otherEnd = other.NGAY_KQ;

        // Hàm kiểm tra chồng khoảng thời gian
        const isOverlap = start < otherEnd && end > otherStart;

        if (isOverlap) {
          const keyByTime = `TRUNG_EKIP|${doctor}|${formatDateTime(otherStart)}|${formatDateTime(otherEnd)}`;
          if (!ylTimeByDoctorSet.has(keyByTime)) {
            ylTimeByDoctorSet.add(keyByTime);

            errors.push({
              sheetName: 'XML3',
              rowIndex,
              fieldName: 'NGAY_TH_YL/NGAY_KQ',
              errorCode: 'Trùng ekip thực hiện DVKT',
              errorMessage:
                `DVKT [${MA_DICH_VU}] - ${TEN_DICH_VU} (${formatDateTime(start)} - ${formatDateTime(end)}) ` +
                `bác sĩ [${doctor}] đồng thời thực hiện DVKT khác ` +
                `[${other.MA_DICH_VU}] - ${other.TEN_DICH_VU} ` +
                `cho BN khác (MA_LK: ${other.MA_LK}) ` +
                `(${formatDateTime(otherStart)} - ${formatDateTime(otherEnd)})`,
              severity: 'error',
              ...getPatientInfo(dvktRecord),
            });
          }
        }
      });
      // 4) Kiểm công khám chồng khoảng thời gian
      xml3Records.forEach((other) => {
        if (other === dvktRecord) return;
        if (other.MA_LK === MA_LK) return;

        // Chỉ xét công khám
        if (other.MA_NHOM !== '13') return;

        // Nếu bệnh nhân này còn có CLS khác thì bỏ qua
        const hasCLS = xml3Records.some(
          (r) => r.MA_LK === other.MA_LK && r !== other && r.MA_NHOM !== '13',
        );

        if (hasCLS) return;

        if (!other.NGAY_TH_YL || !other.NGAY_KQ) return;

        const otherDoctors = other.NGUOI_THUC_HIEN
          ? other.NGUOI_THUC_HIEN.split(';').map((s) => s.trim())
          : [];

        if (!otherDoctors.includes(doctor)) return;

        const otherStart = other.NGAY_TH_YL;
        const otherEnd = other.NGAY_KQ;

        const isOverlap = start < otherEnd && end > otherStart;

        if (!isOverlap) return;

        const keyByTime = `KHAM_ONLY|${doctor}|${other.MA_LK}|${formatDateTime(otherStart)}|${formatDateTime(otherEnd)}`;

        if (ylTimeByDoctorSet.has(keyByTime)) return;

        ylTimeByDoctorSet.add(keyByTime);

        errors.push({
          sheetName: 'XML3',
          rowIndex,
          fieldName: 'NGAY_TH_YL/NGAY_KQ',
          errorCode: 'Trùng ekip thực hiện DVKT',
          errorMessage:
            `DVKT [${MA_DICH_VU}] - ${TEN_DICH_VU} ` +
            `(${formatDateTime(start)} - ${formatDateTime(end)}) ` +
            `trùng thời gian khám của bác sĩ [${doctor}] ` +
            `cho BN chỉ có công khám (MA_LK: ${other.MA_LK}) ` +
            `(${formatDateTime(otherStart)} - ${formatDateTime(otherEnd)})`,
          severity: 'error',
          ...getPatientInfo(dvktRecord),
        });
      });
    });
  });

  const hasCommonUser = (a: string, b: string) => {
    const setA = new Set(a.split(';').map((s) => s.trim()));
    const setB = new Set(b.split(';').map((s) => s.trim()));

    return [...setA].some((user) => setB.has(user));
  };

  const toMinutes = (timeStr: string) => {
    const year = Number(timeStr.slice(0, 4));
    const month = Number(timeStr.slice(4, 6)) - 1;
    const day = Number(timeStr.slice(6, 8));
    const hour = Number(timeStr.slice(8, 10));
    const minute = Number(timeStr.slice(10, 12));

    return new Date(year, month, day, hour, minute).getTime() / 60000;
  };
  const groupByDvktAndUser: Record<string, any[]> = {};

  xml3Records.forEach((r, index) => {
    if (!r.MA_DICH_VU || !r.NGAY_TH_YL || !r.NGUOI_THUC_HIEN) return;

    const key = `${r.MA_DICH_VU}_${r.NGUOI_THUC_HIEN}`;

    if (!groupByDvktAndUser[key]) groupByDvktAndUser[key] = [];

    groupByDvktAndUser[key].push({ ...r, rowIndex: index });
  });

  // 2. Kiểm tra gối giờ trên từng nhóm dịch vụ
  Object.keys(groupByDvktAndUser).forEach((key) => {
    const records = groupByDvktAndUser[key];
    const maDvkt = records[0].MA_DICH_VU;

    const cfg = dvktConfigMap.get(maDvkt || '');
    if (!cfg || !cfg.soPhutGoiGio || Number(cfg.soPhutGoiGio) <= 0) return;

    const soPhutGoiGio = Number(cfg.soPhutGoiGio);

    records.sort((a, b) => toMinutes(a.NGAY_TH_YL) - toMinutes(b.NGAY_TH_YL));

    for (let i = 1; i < records.length; i++) {
      const prev = records[i - 1];
      const curr = records[i];

      // ❗ Chỉ bắt khi có ít nhất 1 người trùng
      if (!hasCommonUser(prev.NGUOI_THUC_HIEN, curr.NGUOI_THUC_HIEN)) {
        continue;
      }

      const diffMinutes = toMinutes(curr.NGAY_TH_YL) - toMinutes(prev.NGAY_TH_YL);

      if (diffMinutes < soPhutGoiGio) {
        errors.push({
          sheetName: 'XML3',
          rowIndex: curr.rowIndex,
          fieldName: 'NGAY_TH_YL',
          errorCode: 'DVKT Gối giờ sai số phút cấu hình',
          errorMessage:
            `Dịch vụ [${curr.TEN_DICH_VU}] gối giờ sai số phút cấu hình (` +
            `Thực hiện lúc ${formatDateTime(prev.NGAY_TH_YL)} và ` +
            `ca tiếp theo: (Mã BN: ${curr.MA_LK}) thực hiện lúc ${formatDateTime(curr.NGAY_TH_YL)}. ` +
            `Khoảng cách: ${diffMinutes} phút (< ${soPhutGoiGio} phút))`,
          severity: 'warning',
          ...getPatientInfo(prev), // Thông tin bệnh nhân của bản ghi trước
        });
      }
    }
  });

  const calculateAge = (dobString: any) => {
    // Ép kiểu sang chuỗi và kiểm tra độ dài
    const str = String(dobString);
    if (!str || str.length < 8) return 0;

    const year = parseInt(str.substring(0, 4), 10);
    // Kiểm tra nếu year không hợp lệ (ví dụ: chuỗi rác)
    if (isNaN(year)) return 0;

    return new Date().getFullYear() - year;
  };

  xml3Records.forEach((dvktRecord, rowIndex) => {
    // Giả sử mã ngày sinh nằm ở trường NGAY_SINH
    // Thêm dòng này trước khi tính tuổi

    const dob = patientMap.get(dvktRecord.MA_LK);

    // Nếu không tìm thấy ngày sinh, có thể dữ liệu chưa được tải hoặc lỗi liên kết
    if (!dob) {
      console.warn(`Không tìm thấy thông tin BN cho MA_LK: ${dvktRecord.MA_LK}`);
      return;
    }
    const age = calculateAge(dob);
    const cfg = dvktConfigMap.get(dvktRecord.MA_DICH_VU?.trim() || '');

    if (!cfg) return;

    // Kiểm tra độ tuổi với cấu hình
    const min = cfg.tuoiMin !== null ? Number(cfg.tuoiMin) : null;
    const max = cfg.tuoiMax !== null ? Number(cfg.tuoiMax) : null;

    if ((min && age < min) || (max && age > max)) {
      errors.push({
        sheetName: 'XML3',
        rowIndex,
        fieldName: 'NGAY_SINH',
        errorCode: 'Chống chỉ định DVKT',
        errorMessage: `Dịch vụ [${dvktRecord.MA_DICH_VU} - ${dvktRecord.TEN_DICH_VU}] không áp dụng cho độ tuổi ${age} (Cho phép: ${min}-${max}).`,
        severity: 'error',
        ...getPatientInfo(dvktRecord),
      });
    }
  });

  xml3Records.forEach((dvktRecord, rowIndex) => {
    const { MA_DICH_VU } = dvktRecord;
    const cfg = dvktConfigMap.get(MA_DICH_VU?.trim() || '');
    const dob = patientMapGioiTinh.get(dvktRecord.MA_LK);
    if (!cfg) return;

    if (cfg.gioiTinh === 'Nam' && Number(dob) === 2) {
      errors.push({
        sheetName: 'XML3',
        rowIndex,
        fieldName: 'GIOI_TINH',
        errorCode: 'Chống chỉ định DVKT',
        errorMessage: `Dịch vụ [${MA_DICH_VU}] chỉ áp dụng cho Nam.`,
        severity: 'error',
        ...getPatientInfo(dvktRecord),
      });
    } else if (cfg.gioiTinh === 'Nữ' && Number(dob) === 1) {
      errors.push({
        sheetName: 'XML3',
        rowIndex,
        fieldName: 'GIOI_TINH',
        errorCode: 'Chống chỉ định DVKT',
        errorMessage: `Dịch vụ [${MA_DICH_VU}] chỉ áp dụng cho Nữ.`,
        severity: 'error',
        ...getPatientInfo(dvktRecord),
      });
    }
  });

  // Hàm kiểm tra thời gian nằm trong khoảng
  function isBetween(time: string, start: string, end: string): boolean {
    return (
      compareDateTimesYYYYMMDDHHmm(time, start) >= 0 && compareDateTimesYYYYMMDDHHmm(time, end) <= 0
    );
  }

  // --- Bắt đầu quy tắc: Y lệnh DVKT trước thời gian y lệnh CÔNG KHÁM (XML3) ---
  const dvktGroupsForCongKhamRule = ['1', '2', '3', '8', '18'];
  const CONG_KHAM_MA_NHOM = '13';

  const xml3YLenhCongKhamByMaLkAndDoctor = new Map<string, Map<string, string[]>>();

  xml3Records.forEach((record) => {
    const maLk = record.MA_LK;
    const maBacSi = record.MA_BAC_SI;
    const maNhom = record.MA_NHOM;
    const ngayYl = record.NGAY_YL;

    if (maLk && maBacSi && ngayYl && maNhom === CONG_KHAM_MA_NHOM) {
      if (!xml3YLenhCongKhamByMaLkAndDoctor.has(maLk)) {
        xml3YLenhCongKhamByMaLkAndDoctor.set(maLk, new Map<string, string[]>());
      }
      const doctorMap = xml3YLenhCongKhamByMaLkAndDoctor.get(maLk)!;
      if (!doctorMap.has(maBacSi)) {
        doctorMap.set(maBacSi, []);
      }
      doctorMap.get(maBacSi)?.push(ngayYl);
    }
  });

  xml3Records.forEach((dvktRecord, rowIndex) => {
    const maLkDvkt = dvktRecord.MA_LK;
    const maBacSiDvkt = dvktRecord.MA_BAC_SI;
    const maNhomDvkt = dvktRecord.MA_NHOM;
    const ngayYlDvkt = dvktRecord.NGAY_YL;
    const tenDichVuDvkt = dvktRecord.TEN_DICH_VU;

    if (maNhomDvkt === CONG_KHAM_MA_NHOM) {
      return;
    }

    const patientInfo = getPatientInfo(dvktRecord);

    const xml1RecordForDvkt = xml1MapByMaLk.get(maLkDvkt);
    const maLoaiKcb = xml1RecordForDvkt?.MA_LOAI_KCB;
    if (
      maLkDvkt &&
      maBacSiDvkt &&
      ngayYlDvkt &&
      maLoaiKcb === '01' &&
      dvktGroupsForCongKhamRule.includes(maNhomDvkt)
    ) {
      const doctorMapForMaLk = xml3YLenhCongKhamByMaLkAndDoctor.get(maLkDvkt);

      if (doctorMapForMaLk && doctorMapForMaLk.has(maBacSiDvkt)) {
        const yLenhCongKhamTimes = doctorMapForMaLk.get(maBacSiDvkt)!;

        let earliestYLenhCongKham: string | undefined;
        if (yLenhCongKhamTimes.length > 0) {
          earliestYLenhCongKham = yLenhCongKhamTimes.reduce((earliest, current) => {
            return compareDateTimesYYYYMMDDHHmm(current, earliest) < 0 ? current : earliest;
          }, yLenhCongKhamTimes[0]);
        }
        if (earliestYLenhCongKham) {
          if (compareDateTimesYYYYMMDDHHmm(earliestYLenhCongKham, ngayYlDvkt) > 0) {
            errors.push({
              sheetName: 'XML3',
              rowIndex: rowIndex,
              fieldName: 'NGAY_YL',
              errorCode: 'Y lệnh DVKT trước thời gian y lệnh công khám',
              errorMessage: `Lỗi: Y lệnh DVKT "${tenDichVuDvkt}" có NGAY_YL (${formatDateTime(
                ngayYlDvkt,
              )}) trước NGAY_YL Công khám (${formatDateTime(earliestYLenhCongKham)})}.`,
              severity: 'error',
              ...patientInfo,
              extra: {
                NGAY_YL: formatDateTime(ngayYlDvkt),
                NGAY_YL_CONG_KHAM: formatDateTime(earliestYLenhCongKham),
              },
            });
          }
        }
      }
    }
  });

  // --- Bắt đầu quy tắc: Y lệnh THUỐC trước thời gian y lệnh CÔNG KHÁM (XML2 & XML3) ---
  const THUOC_GROUP = '4';

  // Gom thời gian công khám từ XML3
  const xml3CongKhamTimesByMaLkAndBacSi = new Map<string, Map<string, string[]>>();

  xml3Records.forEach((record) => {
    const maLk = record.MA_LK;
    const maBacSi = record.MA_BAC_SI;
    const maNhom = record.MA_NHOM;
    const ngayYl = record.NGAY_YL;

    if (maLk && maBacSi && ngayYl && maNhom === CONG_KHAM_MA_NHOM) {
      if (!xml3CongKhamTimesByMaLkAndBacSi.has(maLk)) {
        xml3CongKhamTimesByMaLkAndBacSi.set(maLk, new Map());
      }
      const doctorMap = xml3CongKhamTimesByMaLkAndBacSi.get(maLk)!;
      if (!doctorMap.has(maBacSi)) {
        doctorMap.set(maBacSi, []);
      }
      doctorMap.get(maBacSi)!.push(ngayYl);
    }
  });

  xml2Records.forEach((thuocRecord, rowIndex) => {
    const maLk = thuocRecord.MA_LK;
    const maBacSi = thuocRecord.MA_BAC_SI;
    const maNhom = thuocRecord.MA_NHOM;
    const ngayYlThuoc = thuocRecord.NGAY_YL;
    const tenThuoc = thuocRecord.TEN_THUOC || 'Không rõ';
    const maThuoc = thuocRecord.MA_THUOC || 'Không rõ';

    if (maNhom !== THUOC_GROUP) return;

    const xml1Record = xml1MapByMaLk.get(maLk);
    const maLoaiKcb = xml1Record?.MA_LOAI_KCB;
    if (maLoaiKcb !== '01') return;

    const congKhamMap = xml3CongKhamTimesByMaLkAndBacSi.get(maLk || '');
    if (!congKhamMap) return;

    const congKhamTimes = congKhamMap.get(maBacSi || '');
    if (!congKhamTimes || !ngayYlThuoc) return;

    const earliestCongKham = congKhamTimes.reduce((earliest, current) => {
      return compareDateTimesYYYYMMDDHHmm(current, earliest) < 0 ? current : earliest;
    }, congKhamTimes[0]);

    if (compareDateTimesYYYYMMDDHHmm(earliestCongKham, ngayYlThuoc) > 0) {
      errors.push({
        sheetName: 'XML2',
        rowIndex,
        fieldName: 'NGAY_YL',
        errorCode: 'Y lệnh Thuốc trước thời gian y lệnh công khám',
        errorMessage: `NGAY_YL [${tenThuoc}] (${formatDateTime(
          ngayYlThuoc,
        )}) trước NGAY_YL Công khám (${formatDateTime(earliestCongKham)})`,
        severity: 'error',
        ...getPatientInfo(thuocRecord),
        extra: {
          MA_THUOC: maThuoc,
          TEN_THUOC: tenThuoc,
          NGAY_YL: formatDateTime(ngayYlThuoc),
          NGAY_YL_CONG_KHAM: formatDateTime(earliestCongKham),
        },
      });
    }
  });

  // --- Bắt đầu quy tắc mới: Chưa kết thúc khám bệnh nhân này đã thực hiện khám bệnh nhân khác (XML3) ---

  xml3Records.forEach((record, rowIndex) => {
    const patientInfo = getPatientInfo(record); // từ XML1
    const maLk = patientInfo.maLk?.toString().trim();
    if (!maLk) return;

    // Chỉ xét lượt công khám (MA_NHOM === '13') của BN A
    if (record.MA_NHOM !== '13') return;
    if (patientInfo.maDoiTuong === '2') return;

    const maLkMeta = xml3MetaByMaLk.get(maLk);
    if (!maLkMeta || maLkMeta.hasClsOrService || !maLkMeta.hasDrug || maLkMeta.congKhamCount >= 2) {
      return;
    }

    // Khung thời gian khám của BN A
    const startTime = parseDateTime(record.NGAY_TH_YL);
    const endTime = parseDateTime(record.NGAY_KQ);
    if (!startTime || !endTime) return;

    const maBacSi = record.MA_BAC_SI || record.MA_BS; // Tên trường mã BS trong XML3
    if (!maBacSi) return;

    // Lặp tìm các hoạt động trùng của CÙNG BÁC SĨ đó với BN khác
    for (let otherRecord of xml3Records) {
      if (otherRecord === record) continue;

      // Phải cùng Bác sĩ mới kiểm tra
      const otherBacSi = otherRecord.MA_BAC_SI || otherRecord.MA_BS;
      if (maBacSi !== otherBacSi) continue;

      const otherPatient = getPatientInfo(otherRecord);
      if (otherPatient.maLk === maLk) continue; // Bỏ qua nếu trùng bệnh nhân A

      // Lấy các mốc thời gian phát sinh hoạt động của BN B
      const timePoints = [
        {
          type: 'cho y lệnh',
          time: parseDateTime(otherRecord.NGAY_YL),
          rawStr: otherRecord.NGAY_YL,
        },
        {
          type: 'thực hiện DVKT/khám',
          time: parseDateTime(otherRecord.NGAY_TH_YL),
          rawStr: otherRecord.NGAY_TH_YL,
        },
        {
          type: 'kết thúc khám/trả KQ',
          time: parseDateTime(otherRecord.NGAY_KQ),
          rawStr: otherRecord.NGAY_KQ,
        },
      ];

      for (let point of timePoints) {
        if (!point.time) continue;

        // KIỂM TRA: Mốc thời gian của BN B nằm TRONG khoảng khám của BN A
        if (point.time >= startTime && point.time <= endTime) {
          errors.push({
            sheetName: 'XML3',
            rowIndex,
            fieldName: 'NGAY_TH_YL/NGAY_KQ',
            errorCode:
              'Chưa kết thúc khám bệnh nhân này đã thực hiện y lệnh/kết thúc khám cho bệnh nhân khác',
            errorMessage: `Trong khi khám cho BN (không thực hiện CLS) từ ${formatDateTime(record.NGAY_TH_YL)} đến ${formatDateTime(record.NGAY_KQ)}, BS (${maBacSi}) đã ${point.type} cho BN khác (MA_LK: ${otherPatient.maLk}) lúc ${formatDateTime(point.rawStr)}`,
            severity: 'error',
            ...patientInfo,
            extra: {
              NGAY_TH_YL: record.NGAY_TH_YL,
              NGAY_KQ: record.NGAY_KQ,
            },
          });

          // Đã tìm thấy 1 điểm vi phạm của lượt khám này -> break ngắt vòng lặp ngay
          return;
        }
      }
    }
  });

  // --- Kết thúc quy tắc mới ---
  // --- Bắt đầu quy tắc mới: Lỗi thiếu MA_MAY (XML3) ---
  // Cấu hình quy tắc MA_MAY theo loại dịch vụ
  const quyTacMay = [
    { tuKhoa: 'siêu âm', prefix: 'SA', moTa: 'Siêu âm' },
    { tuKhoa: 'chụp x-quang', prefix: 'XQ', moTa: 'Chụp X-quang' },
    { tuKhoa: 'điện tim', prefix: 'ĐT', moTa: 'Điện tim' },
    { tuKhoa: 'điện Châm', prefix: 'TT', moTa: 'Điện châm' },
    // có thể thêm nữa sau
  ];

  xml3Records.forEach((record, rowIndex) => {
    const maDichVu = record.MA_DICH_VU;
    const maMay = record.MA_MAY?.trim().toUpperCase() || '';
    const tenDichVu = record.TEN_DICH_VU?.trim().toLowerCase() || '';
    const maNhom = record.MA_NHOM;

    const patientInfo = getPatientInfo(record);

    if (!record.NGAY_TH_YL && !record.NGAY_KQ) return;
    if (maNhom === '13') return;
    if (danhMucArray.includes(maDichVu)) return;

    quyTacMay.forEach((rule) => {
      // Nếu TEN_DICH_VU chứa từ khóa quy tắc
      if (tenDichVu.includes(rule.tuKhoa)) {
        // Nhưng mã máy lại không đúng prefix tương ứng
        if (!maMay.startsWith(rule.prefix)) {
          errors.push({
            sheetName: 'XML3',
            rowIndex,
            fieldName: 'MA_MAY',
            errorCode: 'Sai Mã máy theo loại dịch vụ',
            errorMessage: `Lỗi: Dịch vụ "${record.TEN_DICH_VU}" (Mã DV: ${maDichVu}), mã máy phải bắt đầu bằng "${rule.prefix}"`,
            severity: 'warning',
            ...patientInfo,
            extra: {
              MA_DICH_VU: maDichVu,
              TEN_DICH_VU: record.TEN_DICH_VU,
              MA_MAY: maMay,
            },
          });
        }
      }
    });
  });

  // --- 3. CHỐNG CHỈ ĐỊNH THUỐC (XML2) ---
  xml2Records.forEach((record, rowIndex) => {
    const maThuoc = record.MA_THUOC?.trim();
    const soDangKy = record.SO_DANG_KY?.trim();
    const tenThuoc = record.TEN_THUOC?.trim();
    const maLk = record.MA_LK?.trim();
    const patientInfo = getPatientInfo(record);

    if (!maThuoc || !maLk) return;

    const xml1 = xml1MapByMaLk.get(maLk);
    if (!xml1) return;

    // ================================
    // LẤY THÔNG TIN BỆNH NHÂN
    // ================================
    const tuoi = xml1.TUOI != null && xml1.TUOI !== '' ? Number(xml1.TUOI) : null;

    const gioiTinh =
      xml1.GIOI_TINH != null && xml1.GIOI_TINH !== '' ? Number(xml1.GIOI_TINH) : null;

    const dsMaBenh = [
      xml1.MA_BENH_CHINH,
      ...(xml1.MA_BENH_KT?.split(';') || []),
      ...(xml1.MA_BENH_YHCT?.split(';') || []),
    ]
      .map((x) => x?.trim())
      .filter(Boolean);

    // ================================
    // LỌC CẤU HÌNH PHÙ HỢP
    // ================================
    const matchedEntries = chongChiDinhThuocList.filter((entry) => {
      const matchMaThuoc = entry.maThuoc?.trim() === maThuoc;

      const matchSoDangKy = !entry.soDangKy || entry.soDangKy.trim() === soDangKy;

      return matchMaThuoc && matchSoDangKy;
    });

    if (matchedEntries.length === 0) return;

    // ================================
    // KIỂM TRA TỪNG RULE
    // ================================
    for (const entry of matchedEntries) {
      let hasError = false;

      // 🔹 1. Kiểm tra tuổi
      if (
        tuoi != null &&
        ((entry.tuoiMin != null && tuoi < entry.tuoiMin) ||
          (entry.tuoiMax != null && tuoi > entry.tuoiMax))
      ) {
        hasError = true;

        errors.push({
          sheetName: 'XML2',
          rowIndex,
          fieldName: 'MA_THUOC',
          errorCode: 'Chống chỉ định thuốc',
          errorMessage: `Thuốc "${tenThuoc}" chống chỉ định với tuổi ${tuoi} (giới hạn: ${
            entry.tuoiMin ?? '-'
          } ~ ${entry.tuoiMax ?? '-'})`,
          severity: 'error',
          ...patientInfo,
        });
      }

      // 🔹 2. Kiểm tra giới tính (QUAN TRỌNG: != null)
      if (gioiTinh != null && entry.gioiTinh != null && Number(entry.gioiTinh) === gioiTinh) {
        hasError = true;

        errors.push({
          sheetName: 'XML2',
          rowIndex,
          fieldName: 'MA_THUOC',
          errorCode: 'Chống chỉ định thuốc',
          errorMessage: `Thuốc "${tenThuoc}" chống chỉ định với giới tính ${
            gioiTinh === 0 ? 'Nam' : 'Nữ'
          }.`,
          severity: 'error',
          ...patientInfo,
        });
      }

      // 🔹 3. Kiểm tra chống chỉ định mã bệnh (hỗ trợ nhiều mã)
      if (entry.chongChiDinhMaBenh) {
        const benhList = entry.chongChiDinhMaBenh
          .split(';')
          .map((x) => x.trim())
          .filter(Boolean);

        const foundBenh = dsMaBenh.find((b) => benhList.includes(b));

        if (foundBenh) {
          hasError = true;

          errors.push({
            sheetName: 'XML2',
            rowIndex,
            fieldName: 'MA_THUOC',
            errorCode: 'Chống chỉ định thuốc',
            errorMessage: `Thuốc "${tenThuoc}" chống chỉ định với mã bệnh ${foundBenh}.`,
            severity: 'error',
            ...patientInfo,
          });
        }
      }

      // 🔹 4. Kiểm tra bắt buộc mã bệnh
      if (entry.buocChiDinhMaBenh) {
        const benhList = entry.buocChiDinhMaBenh
          .split(';')
          .map((x) => x.trim())
          .filter(Boolean);

        const hasRequiredBenh = dsMaBenh.some((b) => benhList.includes(b));

        if (!hasRequiredBenh) {
          hasError = true;

          errors.push({
            sheetName: 'XML2',
            rowIndex,
            fieldName: 'MA_THUOC',
            errorCode: 'Bắt buộc mã bệnh đối với thuốc',
            errorMessage: `Thuốc "${tenThuoc}" yêu cầu có ít nhất một mã bệnh trong [${benhList.join(
              ', ',
            )}].`,
            severity: 'error',
            ...patientInfo,
          });
        }
      }

      // Nếu đã có lỗi theo rule này thì không cần check rule khác nữa
      if (hasError) break;
    }
  });

  const chucDanhOptions = [
    { value: 0, label: 'Không chọn' },
    { value: 1, label: 'Bác sĩ' },
    { value: 2, label: 'Y sĩ' },
    { value: 3, label: 'Điều dưỡng' },
    { value: 4, label: 'Hộ sinh' },
    { value: 5, label: 'Kỹ thuật viên' },
    { value: 6, label: 'Cử nhân X-quang' },
    { value: 7, label: 'Dược sĩ đại học' },
    { value: 8, label: 'Dược sĩ trung cấp' },
    { value: 9, label: 'Lương y' },
    { value: 10, label: 'Cử nhân xét nghiệm' },
  ];

  xml3Records.forEach((record, rowIndex) => {
    const maDvkt = record.MA_DICH_VU?.trim();
    const tenDvkt = record.TEN_DICH_VU?.trim();
    const maLk = record.MA_LK?.trim();
    const maMay = record.MA_MAY?.trim();
    const nguoiThucHienStr = record.NGUOI_THUC_HIEN?.trim();

    if (!maDvkt || !maLk) return;

    const patientInfo = getPatientInfo(record);
    const isMandatoryMachineDvkt = dvktBatBuocMaMaySet.has(maDvkt.toUpperCase());
    const cfg = dvktConfigMap.get(maDvkt || '');

    if (isMandatoryMachineDvkt && !maMay) {
      errors.push({
        sheetName: 'XML3',
        rowIndex,
        fieldName: 'MA_MAY',
        errorCode: 'DVKT bắt buộc có mã máy',
        errorMessage: `DVKT [${maDvkt} - ${tenDvkt}] thuộc danh mục bắt buộc phải có mã máy (MA_MAY).`,
        severity: 'warning',
        topic: 'chuyen-de',
        ...patientInfo,
        extra: {
          MA_DVKT: maDvkt,
          TEN_DVKT: tenDvkt,
        },
      });
    }

    if (!cfg) {
      return;
    }

    const xml1 = xml1MapByMaLk.get(maLk);
    if (!xml1) return;

    const dsMaBenh = [
      xml1.MA_BENH_CHINH,
      ...(xml1.MA_BENH_KT?.split(';') || []),
      ...(xml1.MA_BENH_YHCT?.split(';') || []),
    ].filter(Boolean);

    // 🔹 1. Kiểm tra CHỐNG CHỈ ĐỊNH theo mã bệnh
    if (cfg.chongChiDinhMaBenh) {
      const chongChiDinhs = cfg.chongChiDinhMaBenh
        .split(';')
        .map((x) => x.trim())
        .filter(Boolean);
      const found = dsMaBenh.find((benh) => chongChiDinhs.includes(benh));
      if (found) {
        errors.push({
          sheetName: 'XML3',
          rowIndex,
          fieldName: 'MA_DICH_VU',
          errorCode: 'Chống chỉ định DVKT',
          errorMessage: `DVKT [${maDvkt} - ${tenDvkt}] chống chỉ định với mã bệnh ${found}.`,
          severity: 'error',
          ...patientInfo,
        });
      }
    }

    // 🔹 2. Kiểm tra BUỘC CHỈ ĐỊNH theo mã bệnh
    if (cfg.buocChiDinhMaBenh) {
      const buocChiDinhs = cfg.buocChiDinhMaBenh
        .split(';')
        .map((x) => x.trim())
        .filter(Boolean);
      const found = dsMaBenh.some((benh) => buocChiDinhs.includes(benh));
      if (!found) {
        errors.push({
          sheetName: 'XML3',
          rowIndex,
          fieldName: 'MA_DICH_VU',
          errorCode: 'Bắt buộc mã bệnh đối với DVKT',
          errorMessage: `DVKT [${maDvkt} - ${tenDvkt}] yêu cầu phải có ít nhất một mã bệnh trong [${buocChiDinhs.join(
            ', ',
          )}].`,
          severity: 'error',
          ...patientInfo,
        });
      }
    }

    const dvktCungHoSo = xml3Records
      .filter((r) => r.MA_LK?.trim() === maLk)
      .map((r) => r.MA_DICH_VU?.trim())
      .filter(Boolean);

    if (cfg.chongChiDinhDVKT) {
      const chongChiDinhs = cfg.chongChiDinhDVKT
        .split(';')
        .map((x) => x.trim())
        .filter(Boolean);

      const found = dvktCungHoSo.find((dv) => chongChiDinhs.includes(dv));

      if (found) {
        errors.push({
          sheetName: 'XML3',
          rowIndex,
          fieldName: 'MA_DICH_VU',
          errorCode: 'Chống chỉ định DVKT',
          errorMessage: `DVKT [${maDvkt} - ${tenDvkt}] chống chỉ định với DVKT ${found}.`,
          severity: 'error',
          ...patientInfo,
        });
      }
    }

    if (cfg.checkMaMay === 1 && !isMandatoryMachineDvkt) {
      if (!maMay) {
        errors.push({
          sheetName: 'XML3',
          rowIndex,
          fieldName: 'MA_MAY',
          errorCode: 'Thiếu Mã máy',
          errorMessage: `Lỗi từ cấu hình: DVKT [${maDvkt} - ${tenDvkt}] yêu cầu phải có mã máy (MA_MAY).`,
          severity: 'warning',
          ...patientInfo,
        });
      }
    }

    if (nguoiThucHienStr) {
      const nguoiList = nguoiThucHienStr.split(';').filter(Boolean);

      const foundDoctors: DanhMucNhanVien[] = nguoiList
        .map((ma) => doctors.get(ma))
        .filter((d): d is DanhMucNhanVien => !!d);

      // 🔸 Kiểm tra chức danh
      if (cfg.chucDanh) {
        const rawValue = String(cfg.chucDanh); // 🔥 ép về string an toàn

        const allowedChucDanh = rawValue
          .split(';')
          .map(Number)
          .filter((n) => n > 0);

        if (allowedChucDanh.length > 0) {
          const invalidDoctors = foundDoctors.filter(
            (doc) => !allowedChucDanh.includes(Number(doc.CHUCDANH_NN)),
          );

          if (invalidDoctors.length > 0) {
            const chucDanhMap = Object.fromEntries(
              chucDanhOptions.map((opt) => [opt.value, opt.label]),
            );

            const allowedNames = allowedChucDanh.map((cd) => chucDanhMap[cd]).join('; ');

            const invalidNames = invalidDoctors
              .map((doc) => chucDanhMap[Number(doc.CHUCDANH_NN)] || doc.CHUCDANH_NN)
              .join('; ');

            errors.push({
              sheetName: 'XML3',
              rowIndex,
              fieldName: 'NGUOI_THUC_HIEN',
              errorCode: 'Người thực hiện có chức danh không hợp lệ',
              errorMessage: `DVKT [${maDvkt} - ${tenDvkt}] yêu cầu chức danh: ${allowedNames}. Phát hiện không hợp lệ: ${invalidNames}`,
              severity: 'error',
              ...patientInfo,
            });
          }
        }
      }

      if (cfg.pvcm && String(cfg.pvcm).trim() !== '') {
        const pvcmList = String(cfg.pvcm)
          .split(';')
          .map((x) => x.trim())
          .filter(Boolean);

        // 🔹 1. Thu thập toàn bộ PVCM của nhóm người thực hiện
        const doctorPvcmSet = new Set<string>();
        foundDoctors.forEach((doc) => {
          const pvcmStr = String(doc.PHAMVI_CM || '').trim();
          if (pvcmStr !== '') {
            pvcmStr
              .split(';')
              .map((p) => p.trim())
              .filter(Boolean)
              .forEach((p) => doctorPvcmSet.add(p));
          }
        });

        // 🔹 2. THAY ĐỔI LOGIC TẠI ĐÂY:
        // Kiểm tra xem nhóm người thực hiện có "ít nhất một" PVCM nằm trong danh sách yêu cầu không
        const hasValidPvcm = pvcmList.some((p) => doctorPvcmSet.has(p));

        // Nếu không có bất kỳ mã PVCM nào trùng khớp thì mới báo lỗi
        if (!hasValidPvcm) {
          errors.push({
            sheetName: 'XML3',
            rowIndex,
            fieldName: 'NGUOI_THUC_HIEN',
            errorCode: 'Người thực hiện không có PVCM phù hợp',
            errorMessage: `DVKT [${maDvkt} - ${tenDvkt}] yêu cầu một trong các PVCM: [${pvcmList.join(
              '; ',
            )}]. Tuy nhiên, những người thực hiện chỉ có: [${Array.from(doctorPvcmSet).join('; ') || 'Trống'}]`,
            severity: 'error',
            ...patientInfo,
          });
        }
      }
    } else {
      if (cfg.chucDanh || cfg.pvcm) {
        errors.push({
          sheetName: 'XML3',
          rowIndex,
          fieldName: 'NGUOI_THUC_HIEN',
          errorCode: 'Thiếu người thực hiện',
          errorMessage: `DVKT [${maDvkt} - ${tenDvkt}] yêu cầu có người thực hiện (NGUOI_THUC_HIEN).`,
          severity: 'error',
          ...patientInfo,
        });
      }
    }
  });

  // --- Trùng thời gian thực hiện cùng bệnh nhân ---
  const groupByMaLk = new Map<string, any[]>();

  xml3Records.forEach((record, rowIndex) => {
    const maLk = record.MA_LK?.trim();
    if (!maLk) return;
    if (!groupByMaLk.has(maLk)) {
      groupByMaLk.set(maLk, []);
    }

    groupByMaLk.get(maLk)!.push({ ...record, rowIndex });
  });

  groupByMaLk.forEach((records) => {
    for (let i = 0; i < records.length; i++) {
      const r1 = records[i];
      const ngayTh1 = r1.NGAY_TH_YL?.trim();
      const ngayKq1 = r1.NGAY_KQ?.trim();
      const maNhom1 = Number(r1.MA_NHOM);

      const patientInfo = getPatientInfo(r1);

      for (let j = i + 1; j < records.length; j++) {
        const r2 = records[j];
        const ngayTh2 = r2.NGAY_TH_YL?.trim();
        const ngayKq2 = r2.NGAY_KQ?.trim();
        const maNhom2 = Number(r2.MA_NHOM);

        // --- Kiểm tra trùng NGAY_TH_YL ---
        if ([2, 3, 8, 18].includes(maNhom1) && [2, 3, 8, 18].includes(maNhom2)) {
          if (ngayTh1 && ngayTh2 && ngayTh1 === ngayTh2) {
            errors.push({
              sheetName: 'XML3',
              rowIndex: r1.rowIndex,
              fieldName: 'NGAY_TH_YL',
              errorCode: 'Trùng thời gian thực hiện trên cùng bệnh nhân',
              errorMessage:
                `Trùng thời gian thực hiện (${formatDateTime(ngayTh1)}) giữa hai dịch vụ: ` +
                `${r1.TEN_DICH_VU} và ${r2.TEN_DICH_VU}.`,
              severity: 'warning',
              ...patientInfo,
            });
          }
        }

        // --- Kiểm tra lồng thời gian ---
        if ([2, 3, 8, 18].includes(maNhom1) && [2, 3, 8, 18].includes(maNhom2)) {
          if (ngayTh1 && ngayKq1 && ngayTh2 && ngayKq2) {
            if (ngayTh1 < ngayKq2 && ngayTh2 < ngayKq1) {
              errors.push({
                sheetName: 'XML3',
                rowIndex: r1.rowIndex,
                fieldName: 'NGAY_TH_YL / NGAY_KQ',
                errorCode: 'Trùng thời gian thực hiện trên cùng bệnh nhân',
                errorMessage:
                  `Dịch vụ "${r1.TEN_DICH_VU}" thời gian ` +
                  `(${formatDateTime(ngayTh1)} → ${formatDateTime(ngayKq1)}) ` +
                  `bị lồng với dịch vụ "${r2.TEN_DICH_VU}"` +
                  ` (${formatDateTime(ngayTh2)} → ${formatDateTime(ngayKq2)}).`,
                severity: 'warning',
                ...patientInfo,
              });
            }
          }
        }
      }
    }
  });

  // --- Kiểm lỗi chuyên đề: Trùng thời gian y lệnh (XML2 và XML3) ---
  const yLenhByMaLkAndTime = new Map<
    string,
    { record: Record<string, string>; rowIndex: number; sheetName: string }[]
  >();

  [
    ...xml2Records.map((record, rowIndex) => ({ record, rowIndex, sheetName: 'XML2' })),
    ...xml3Records.map((record, rowIndex) => ({ record, rowIndex, sheetName: 'XML3' })),
  ].forEach(({ record, rowIndex, sheetName }) => {
    const maLk = getTrimmedValue(record.MA_LK);
    const ngayYl = getTrimmedValue(record.NGAY_YL);
    const maBacSi = getTrimmedValue(record.MA_BAC_SI);
    if (!maLk || !ngayYl || !maBacSi) return;

    const key = `${maLk}|${ngayYl}`;
    if (!yLenhByMaLkAndTime.has(key)) {
      yLenhByMaLkAndTime.set(key, []);
    }
    yLenhByMaLkAndTime.get(key)!.push({ record, rowIndex, sheetName });
  });

  for (const [, records] of yLenhByMaLkAndTime.entries()) {
    const doctors = new Set(records.map(({ record }) => getTrimmedValue(record.MA_BAC_SI)));
    if (doctors.size <= 1) continue;

    const ngayYl = getTrimmedValue(records[0].record.NGAY_YL);
    const maLk = getTrimmedValue(records[0].record.MA_LK);
    const doctorList = Array.from(doctors).join(', ');

    records.forEach(({ record, rowIndex, sheetName }) => {
      const patientInfo = getPatientInfo(record);
      errors.push({
        sheetName,
        rowIndex,
        fieldName: 'NGAY_YL',
        errorCode: 'Trùng thời gian y lệnh với bác sĩ khác',
        errorMessage: `Trùng thời gian y lệnh: MA_LK ${maLk}, NGAY_YL ${formatDateTime(
          ngayYl,
        )} nhưng có nhiều bác sĩ (${doctorList}).`,
        severity: 'warning',
        ...patientInfo,
      });
    });
  }

  type ViolationBase = {
    rowIndex: number;
    maBacSi: string;
    ngayYl: string; // yyyyMMddhhmm
    patientInfo: ReturnType<typeof getPatientInfo>; // chứa maLk, hoTen, ngayVao, ngayRa...
  };

  const violationsMap = new Map<string, { base: ViolationBase; conflicts: string[] }>();
  const doctorVisitsByMaBacSi = new Map<
    string,
    {
      rowIndex: number;
      maLk: string;
      ngayYl: string;
      patientInfo: ReturnType<typeof getPatientInfo>;
    }[]
  >();

  xml3Records.forEach((record, rowIndex) => {
    if (record.MA_NHOM !== '13') return;

    const maBacSi = getTrimmedValue(record.MA_BAC_SI);
    const ngayYl = getTrimmedValue(record.NGAY_YL);
    const patientInfo = getPatientInfo(record);
    const maLk = patientInfo.maLk?.trim();

    if (!maBacSi || !ngayYl || !maLk) return;

    if (!doctorVisitsByMaBacSi.has(maBacSi)) {
      doctorVisitsByMaBacSi.set(maBacSi, []);
    }
    doctorVisitsByMaBacSi.get(maBacSi)!.push({ rowIndex, maLk, ngayYl, patientInfo });
  });

  doctorVisitsByMaBacSi.forEach((visits, maBacSi) => {
    visits.sort((a, b) => compareDateTimesYYYYMMDDHHmm(a.ngayYl, b.ngayYl));

    for (let i = 0; i < visits.length; i++) {
      const base = visits[i];
      const baseTime = getParsedDateTime(base.ngayYl);
      if (!baseTime) continue;

      for (let j = i + 1; j < visits.length; j++) {
        const current = visits[j];
        if (current.maLk === base.maLk) continue;

        const currentTime = getParsedDateTime(current.ngayYl);
        if (!currentTime) continue;

        const diffMinutes = (currentTime.getTime() - baseTime.getTime()) / (1000 * 60);
        if (diffMinutes >= 2) break;

        const key = `${maBacSi}|${base.maLk}|${base.ngayYl}`;
        if (!violationsMap.has(key)) {
          violationsMap.set(key, {
            base: {
              rowIndex: base.rowIndex,
              maBacSi,
              ngayYl: base.ngayYl,
              patientInfo: base.patientInfo,
            },
            conflicts: [],
          });
        }

        violationsMap
          .get(key)!
          .conflicts.push(
            `BN "${current.patientInfo.hoTen}" (MA_LK: ${current.maLk}, NGAY_YL: ${formatDateTime(
              current.ngayYl,
            )}, cách ${Number(diffMinutes.toFixed(1))} phút)`,
          );
      }
    }
  });

  violationsMap.forEach(({ base, conflicts }) => {
    const { patientInfo, maBacSi, ngayYl, rowIndex } = base;
    errors.push({
      sheetName: 'XML3',
      rowIndex,
      fieldName: 'NGAY_YL',
      errorCode: 'Thời gian y lệnh công khám quá gần',
      errorMessage: `Bác sĩ [${maBacSi}] khám BN "${patientInfo.hoTen}" (MA_LK: ${
        patientInfo.maLk
      }, NGAY_YL: ${formatDateTime(ngayYl)}) và ${conflicts.join('; ')}.`,
      severity: 'warning',
      ...patientInfo,
    });
  });

  // --- Kiểm lỗi chuyên đề: Số lượt thực hiện thủ thuật (MA_NHOM=18) > 4 tại cùng thời điểm (XML3) ---
  const thuThuatCounter = new Map<string, { count: number; rows: number[] }>();

  xml3Records.forEach((record, index) => {
    const maLk = record.MA_LK?.trim();
    const maNhom = record.MA_NHOM?.trim();
    const ngayThYl = record.NGAY_TH_YL?.trim();

    if (maLk && maNhom === '18' && ngayThYl) {
      const key = `${maLk}_${ngayThYl}`;
      if (!thuThuatCounter.has(key)) {
        thuThuatCounter.set(key, { count: 1, rows: [index] });
      } else {
        const entry = thuThuatCounter.get(key)!;
        entry.count += 1;
        entry.rows.push(index);
      }
    }
  });

  // Kiểm tra và tạo lỗi
  for (const [key, entry] of thuThuatCounter.entries()) {
    if (entry.count > 4) {
      const [maLk, thoiGian] = key.split('_');
      const patientInfo = getPatientInfo(xml3Records[entry.rows[0]]);
      errors.push({
        sheetName: 'XML3',
        rowIndex: entry.rows[0],
        fieldName: 'NGAY_TH_YL',
        errorCode: 'Thủ thuật thực hiện quá nhiều lần',
        errorMessage: `Số lượt thực hiện thủ thuật (MA_NHOM = 18) vượt quá 4 lần tại thời điểm ${thoiGian}.`,
        severity: 'warning',
        maLk,
        ...patientInfo,
      });
    }
  }

  // --- Kiểm tra tương tác thuốc chống chỉ định trong XML2 ---
  const allXML2ByMaLK: Record<string, any[]> = {};

  xml2Records.forEach((record) => {
    const maLk = record.MA_LK?.toString().trim();
    if (!maLk) return;

    if (!allXML2ByMaLK[maLk]) {
      allXML2ByMaLK[maLk] = [];
    }
    allXML2ByMaLK[maLk].push(record);
  });

  for (const [maLk, thuocList] of Object.entries(allXML2ByMaLK)) {
    const hoatChatList = thuocList
      .map((t) => t.MA_HOAT_CHAT?.toLowerCase()?.trim())
      .filter(Boolean);
    const maThuocList = thuocList.map((t) => t.MA_THUOC?.toLowerCase()?.trim()).filter(Boolean);

    for (const rule of chongTuongTacThuocList) {
      const { ma_hoat_chat_1, ma_hoat_chat_2, ma_thuoc_1, ma_thuoc_2 } = rule;

      const matchHoatChat =
        hoatChatList.includes(ma_hoat_chat_1.toLowerCase()) &&
        hoatChatList.includes(ma_hoat_chat_2.toLowerCase());

      const matchMaThuoc = maThuocList.includes(ma_thuoc_1) && maThuocList.includes(ma_thuoc_2);

      if (matchHoatChat || matchMaThuoc) {
        const rowIndex = xml2FirstRowIndexByMaLk.get(maLk) ?? 0;
        const patientInfo = getPatientInfo(xml2Records[rowIndex]);

        errors.push({
          sheetName: 'XML2',
          rowIndex,
          fieldName: 'MA_THUOC',
          errorCode: 'Lỗi tương tác thuốc',
          errorMessage: `Lỗi tương tác thuốc: Thuốc chứa hoạt chất "${ma_hoat_chat_1}" và "${ma_hoat_chat_2}" không được dùng chung theo 5948/QĐ-BYT.`,
          severity: 'error',
          ...patientInfo,
        });

        break; // chỉ cảnh báo 1 lần trên mỗi MA_LK
      }
    }
  }

  const tienKhamsMap = new Map<string, TienKham>();
  tienKhamList.forEach((f) => {
    if (f.CONG_KHAM) {
      tienKhamsMap.set(f.CONG_KHAM.trim(), f);
    }
  });

  function normalize(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value)
      .trim()
      .replace(/\u200B/g, '');
  }

  xml3Records.forEach((record, rowIndex) => {
    const maBacSi = normalize(record.MA_BAC_SI);
    const maDichVu = normalize(record.MA_DICH_VU);
    const maNhom = normalize(record.MA_NHOM);

    if (!maBacSi || !maDichVu || maNhom !== '13') return;

    const doctor = doctors.get(maBacSi);
    const facility = tienKhamsMap.get(maDichVu);

    if (!doctor || !facility) return;

    const dvPvcm = normalize(facility.PVCM?.toString());
    const dvBanKham = normalize(facility.BAN_KHAM);
    const tenCongKham = normalize(facility.TEN_CONG_KHAM);

    let validPvcm = false;
    let validBanKham = false;

    // Kiểm tra PVCM
    if (dvPvcm && doctor.PHAMVI_CM) {
      const pvcmList = String(doctor.PHAMVI_CM)
        .split(';')
        .map((p) => normalize(p))
        .filter((p) => p !== '');
      validPvcm = pvcmList.includes(dvPvcm);
    }

    // Kiểm tra bàn khám
    if (dvBanKham && doctor.MA_KHOA) {
      const banList = String(doctor.MA_KHOA)
        .split(';')
        .map((k) => normalize(k))
        .filter((k) => k !== '');
      validBanKham = banList.includes(dvBanKham);
    }

    // Báo lỗi bàn khám
    if (!validBanKham) {
      errors.push({
        sheetName: 'XML3',
        rowIndex,
        fieldName: 'MA_DICH_VU',
        errorCode: 'Công khám không phù hợp với phạm vi khoa',
        errorMessage: `Công khám [${maDichVu} - ${tenCongKham}] yêu cầu bàn khám (${dvBanKham}) ngoài phạm vi khoa được phân công của bác sĩ [${maBacSi} - ${doctor.HO_TEN}] (khoa: ${doctor.MA_KHOA})`,
        severity: 'warning',
        ...getPatientInfo(record),
      });
    }

    // Báo lỗi PVCM
    if (!validPvcm) {
      errors.push({
        sheetName: 'XML3',
        rowIndex,
        fieldName: 'MA_DICH_VU',
        errorCode: 'Công khám không phù hợp với phạm vi chuyên môn',
        errorMessage: `Công khám [${maDichVu} - ${tenCongKham}] yêu cầu PVCM (${dvPvcm}) ngoài phạm vi chuyên môn của bác sĩ [${maBacSi} - ${doctor.HO_TEN}] (PVCM: ${doctor.PHAMVI_CM})`,
        severity: 'warning',
        ...getPatientInfo(record),
      });
    }
  });

  const normalizeDvktCode = (value?: string): string =>
    value?.toString().trim().replace(/\s+/g, '').toUpperCase() || '';

  const dvktConfigs = Array.isArray(dvktTimeConfigList) ? dvktTimeConfigList : [];

  const dvktTimeMap = new Map<string, DanhMucThoiGianThucHienDVKT>();

  // Xây map DVKT
  // Nếu trùng MA_BYT thì lấy cấu hình có thoiGianThucHienMin thấp nhất
  dvktConfigs.forEach((cfg) => {
    const maByt = normalizeDvktCode((cfg as any)?.maByt ?? (cfg as any)?.MA_BYT);

    if (!maByt) return;

    const existingCfg = dvktTimeMap.get(maByt);

    // Chưa có → thêm luôn
    if (!existingCfg) {
      dvktTimeMap.set(maByt, cfg);
      return;
    }

    const currentMin =
      cfg.thoiGianThucHienMin !== null &&
      cfg.thoiGianThucHienMin !== undefined &&
      Number.isFinite(Number(cfg.thoiGianThucHienMin))
        ? Number(cfg.thoiGianThucHienMin)
        : Infinity;

    const existingMin =
      existingCfg.thoiGianThucHienMin !== null &&
      existingCfg.thoiGianThucHienMin !== undefined &&
      Number.isFinite(Number(existingCfg.thoiGianThucHienMin))
        ? Number(existingCfg.thoiGianThucHienMin)
        : Infinity;

    // Trùng mã DVKT → lấy cấu hình có MIN thấp hơn
    if (currentMin < existingMin) {
      dvktTimeMap.set(maByt, cfg);
    }
  });

  xml3Records.forEach((record, rowIndex) => {
    const maDvkt = normalizeDvktCode(record.MA_DICH_VU);
    const ngayThYl = record.NGAY_TH_YL?.trim();
    const ngayKq = record.NGAY_KQ?.trim();
    const maLk = record.MA_LK?.trim();

    if (!maDvkt || !ngayThYl || !ngayKq || !maLk) return;

    // Lấy cấu hình DVKT đã được chọn
    // Nếu có nhiều cấu hình trùng MA_BYT thì đây là cấu hình có MIN thấp nhất
    const cfg = dvktTimeMap.get(maDvkt);

    if (!cfg) return;

    const start = parseDateTime(ngayThYl);
    const end = parseDateTime(ngayKq);

    if (!start || !end) return;

    const diffMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));

    const minMinutes =
      cfg.thoiGianThucHienMin !== null &&
      cfg.thoiGianThucHienMin !== undefined &&
      Number.isFinite(Number(cfg.thoiGianThucHienMin))
        ? Number(cfg.thoiGianThucHienMin)
        : null;

    const maxMinutes =
      cfg.thoiGianThucHienMax !== null &&
      cfg.thoiGianThucHienMax !== undefined &&
      Number.isFinite(Number(cfg.thoiGianThucHienMax))
        ? Number(cfg.thoiGianThucHienMax)
        : null;

    // Kiểm tra thời gian thực hiện DVKT
    const isOutOfRange =
      (minMinutes !== null && diffMinutes < minMinutes) ||
      (maxMinutes !== null && diffMinutes > maxMinutes);

    if (isOutOfRange) {
      errors.push({
        sheetName: 'XML3',
        rowIndex,
        fieldName: 'NGAY_KQ',
        errorCode: 'Thời gian thực hiện DVKT nằm ngoài thời gian cấu hình',
        errorMessage: `DVKT [${record.MA_DICH_VU?.trim()} - ${
          cfg.tenDvkt
        }] có thời gian thực hiện ${diffMinutes} phút, nằm ngoài khoảng cho phép (${
          minMinutes ?? '...'
        } - ${maxMinutes ?? '...'} phút).`,
        severity: 'warning',
        ...getPatientInfo(record),
      });
    }

    // Kiểm tra thứ tự thực hiện DVKT
    if (cfg.hoanThanhTruocDvkt) {
      const requiredDvktCode = normalizeDvktCode(cfg.hoanThanhTruocDvkt);

      const dvktPhaiSau = requiredDvktCode
        ? xml3ByMaLkAndDvkt.get(maLk)?.get(requiredDvktCode)
        : undefined;

      if (dvktPhaiSau && dvktPhaiSau.NGAY_KQ) {
        const ngayKqPhaiSau = parseDateTime(dvktPhaiSau.NGAY_KQ.trim());

        if (ngayKqPhaiSau && end.getTime() >= ngayKqPhaiSau.getTime()) {
          errors.push({
            sheetName: 'XML3',
            rowIndex,
            fieldName: 'NGAY_KQ',
            errorCode: 'Thứ tự thực hiện DVKT không hợp lệ',
            errorMessage: `DVKT [${record.MA_DICH_VU?.trim()} - ${
              cfg.tenDvkt
            }] phải hoàn thành trước DVKT [${cfg.hoanThanhTruocDvkt}].`,
            severity: 'warning',
            ...getPatientInfo(record),
          });
        }
      }
    }
  });

  const congKhamByMaLk = new Map<string, Set<string>>();

  xml3Records.forEach((record) => {
    const maLk = record.MA_LK;
    const maNhom = record.MA_NHOM;
    const ngayYl = record.NGAY_YL;

    if (!maLk || !ngayYl) return;

    if (maNhom === '13') {
      if (!congKhamByMaLk.has(maLk)) {
        congKhamByMaLk.set(maLk, new Set());
      }

      congKhamByMaLk.get(maLk)?.add(ngayYl);
    }
  });

  xml3Records.forEach((record, rowIndex) => {
    const maLk = record.MA_LK;
    const maNhom = record.MA_NHOM;
    const ngayYl = record.NGAY_YL;

    if (!maLk || !ngayYl) return;

    // Bỏ qua công khám
    if (maNhom === '13') return;

    const congKhamTimes = congKhamByMaLk.get(maLk);

    if (!congKhamTimes) return;

    if (congKhamTimes.has(ngayYl)) {
      errors.push({
        sheetName: 'XML3',
        rowIndex,
        fieldName: 'NGAY_YL',
        errorCode: 'Lỗi trùng giờ y lệnh DVKT với giờ y lệnh công khám',
        errorMessage: `DVKT [${record.MA_DICH_VU} - ${record.TEN_DICH_VU}] có giờ y lệnh (${formatDateTime(ngayYl)}) trùng với giờ y lệnh Công khám.`,
        severity: 'warning',
        ...getPatientInfo(record),
      });
    }
  });

  // --- Bắt đầu quy tắc mới: Y lệnh DVKT trùng với thời gian thực hiện/kết quả DVKT khác mã LK ---
  xml3Records.forEach((record, rowIndex) => {
    const maLk = record.MA_LK?.trim();
    const maNhom = record.MA_NHOM?.trim();
    const ngayYl = record.NGAY_YL?.trim();
    const maBacSi = record.MA_BAC_SI?.trim();

    // Bỏ qua nếu thiếu dữ liệu hoặc nhóm 13
    if (!maLk || !ngayYl || !maBacSi || maNhom === '13') return;

    xml3Records.forEach((other, otherIndex) => {
      if (otherIndex === rowIndex) return;

      const otherMaLk = other.MA_LK?.trim();
      const otherMaNhom = other.MA_NHOM?.trim();
      const nguoiThucHien = other.NGUOI_THUC_HIEN?.trim();

      // Chỉ kiểm tra khác MA_LK
      if (!otherMaLk || otherMaLk === maLk) return;

      // Bỏ qua nhóm 13
      if (otherMaNhom === '13') return;

      // Bác sĩ y lệnh của hồ sơ này phải trùng người thực hiện của hồ sơ kia
      if (!nguoiThucHien || nguoiThucHien !== maBacSi) return;

      const ngayThYlOther = other.NGAY_TH_YL?.trim();
      const ngayKqOther = other.NGAY_KQ?.trim();

      // Trùng với thời gian thực hiện
      if (ngayThYlOther && ngayYl === ngayThYlOther) {
        errors.push({
          sheetName: 'XML3',
          rowIndex,
          fieldName: 'NGAY_YL',
          errorCode: 'Bác sĩ vừa y lệnh vừa thực hiện DVKT cho bệnh nhân khác cùng thời điểm',
          errorMessage: `Bác sĩ [${maBacSi}] ra y lệnh DVKT [${
            record.MA_DICH_VU
          } - ${record.TEN_DICH_VU}] lúc ${formatDateTime(
            ngayYl,
          )} cho hồ sơ (${maLk}), đồng thời là người thực hiện DVKT [${
            other.MA_DICH_VU
          } - ${other.TEN_DICH_VU}] của hồ sơ khác (${otherMaLk}) tại cùng thời điểm.`,
          severity: 'warning',
          ...getPatientInfo(record),
        });
      }

      // Trùng với thời gian kết quả
      if (ngayKqOther && ngayYl === ngayKqOther) {
        errors.push({
          sheetName: 'XML3',
          rowIndex,
          fieldName: 'NGAY_YL',
          errorCode: 'Bác sĩ vừa y lệnh vừa trả kết quả DVKT cho bệnh nhân khác cùng thời điểm',
          errorMessage: `Bác sĩ [${maBacSi}] ra y lệnh DVKT [${
            record.MA_DICH_VU
          } - ${record.TEN_DICH_VU}] lúc ${formatDateTime(
            ngayYl,
          )} cho hồ sơ (${maLk}), đồng thời là người thực hiện/trả kết quả DVKT [${
            other.MA_DICH_VU
          } - ${other.TEN_DICH_VU}] của hồ sơ khác (${otherMaLk}) tại cùng thời điểm.`,
          severity: 'warning',
          ...getPatientInfo(record),
        });
      }
    });
  });

  // --- Kiểm lỗi chuyên đề: Dư ngày giường (XML3) ---
  const groupByNgayYL: Record<string, { rowIndex: number; record: any }[]> = {};

  xml3Records.forEach((record, rowIndex) => {
    if (record.MA_NHOM === '15') {
      const ngay = record.NGAY_YL;
      const key = `${record.MA_LK}__${ngay}`;

      if (!groupByNgayYL[key]) groupByNgayYL[key] = [];
      groupByNgayYL[key].push({ rowIndex, record });
    }
  });

  // Kiểm lỗi theo nhóm
  for (const [, records] of Object.entries(groupByNgayYL)) {
    if (records.length <= 1) continue;

    const total = records.reduce((sum, r) => sum + Number(r.record.SO_LUONG), 0);

    if (total > 1) {
      records.forEach(({ record, rowIndex }) => {
        errors.push({
          sheetName: 'XML3',
          rowIndex,
          fieldName: 'SO_LUONG',
          errorCode: 'Dư ngày giường',
          errorMessage: `Cùng ngày chỉ định ${formatDateTime(
            record.NGAY_YL,
          )} có tổng số lượng giường > 1`,
          severity: 'error',
          ...getPatientInfo(record),
        });
      });
    }
  }

  // --- Kiểm lỗi chuyên đề: Trùng giường (XML3) ---
  const groupByGiuong: Record<string, { rowIndex: number; record: any }[]> = {};

  xml3Records.forEach((record, rowIndex) => {
    if (
      record.MA_NHOM === '15' &&
      record.MA_GIUONG &&
      record.MA_KHOA &&
      Number(record.TYLE_TT_DV) === 100
    ) {
      const key = `${record.MA_GIUONG}__${record.MA_KHOA}`;
      if (!groupByGiuong[key]) groupByGiuong[key] = [];
      groupByGiuong[key].push({ rowIndex, record });
    }
  });

  for (const [, records] of Object.entries(groupByGiuong)) {
    for (let i = 0; i < records.length; i++) {
      const a = records[i];
      const fromA = new Date(a.record.NGAY_YL);
      const toA = new Date(a.record.NGAY_KQ);

      for (let j = i + 1; j < records.length; j++) {
        const b = records[j];

        // Bỏ qua nếu trùng MA_LK
        if (a.record.MA_LK === b.record.MA_LK) continue;

        const fromB = new Date(b.record.NGAY_YL);
        const toB = new Date(b.record.NGAY_KQ);

        const overlap = fromA <= toB && fromB <= toA;

        if (overlap) {
          const msg = `Giường [${a.record.MA_GIUONG}] tại khoa [${a.record.MA_KHOA}] bị trùng giữa bệnh nhân MA_LK: ${a.record.MA_LK} và ${b.record.MA_LK}, thời gian lồng nhau: ${a.record.NGAY_YL} - ${a.record.NGAY_KQ} và ${b.record.NGAY_YL} - ${b.record.NGAY_KQ}`;

          [a, b].forEach(({ record, rowIndex }) => {
            errors.push({
              sheetName: 'XML3',
              rowIndex,
              fieldName: 'MA_GIUONG',
              errorCode: 'Lỗi trùng giường',
              errorMessage: msg,
              severity: 'error',
              ...getPatientInfo(record),
            });
          });
        }
      }
    }
  }

  // --- Kiểm lỗi chuyên đề: Tỷ lệ TT BH công khám (XML1 + XML3) ---
  const benhNhanKhamNgoaiTru = new Set<string>();

  xml1Records.forEach((record) => {
    if (record.MA_LOAI_KCB === '01' && record.MA_LK) {
      benhNhanKhamNgoaiTru.add(record.MA_LK);
    }
  });

  const groupByMaLkCongKham: Record<string, { rowIndex: number; record: any }[]> = {};

  xml3Records.forEach((record, rowIndex) => {
    const maLk = record.MA_LK;
    const maNhom = record.MA_NHOM;

    if (!maLk || maNhom !== '13') return;

    if (!groupByMaLkCongKham[maLk]) groupByMaLkCongKham[maLk] = [];
    groupByMaLkCongKham[maLk].push({ rowIndex, record });
  });

  // B3: Kiểm tra số dòng công khám có TYLE_TT_DV === 100 cho từng bệnh nhân ngoại trú
  for (const [maLk, records] of Object.entries(groupByMaLkCongKham)) {
    if (!benhNhanKhamNgoaiTru.has(maLk)) continue;

    const congKham100 = records.filter((r) => Number(r.record.TYLE_TT_DV) === 100);

    if (congKham100.length > 1) {
      congKham100.forEach(({ rowIndex, record }) => {
        errors.push({
          sheetName: 'XML3',
          rowIndex,
          fieldName: 'TYLE_TT_DV',
          errorCode: 'Công khám trùng TT 100%',
          errorMessage: `Bệnh nhân MA_LK = ${maLk} có nhiều hơn 1 công khám được thanh toán 100% (MA_DICH_VU = ${record.MA_DICH_VU})`,
          severity: 'error',
          ...getPatientInfo(record),
        });
      });
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr;

    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);

    return `${day}/${month}/${year}`;
  };

  // 1. Map lưu trữ tần suất: Key là "MA_LK|MA_DICH_VU|YYYYMMDD"
  const visitCountMap = new Map<string, number>();

  xml3Records.forEach((dvktRecord, rowIndex) => {
    const { MA_LK, MA_DICH_VU, NGAY_TH_YL, TEN_DICH_VU } = dvktRecord;

    const cfg = dvktConfigMap.get(MA_DICH_VU?.trim() || '');

    // Chỉ kiểm tra nếu cấu hình yêu cầu "Không quá 1 lượt" (soLuotThucHien === 1)
    if (!cfg || Number(cfg.soLuotThucHien) !== 1) return;

    // 2. Lấy YYYYMMDD từ chuỗi YYYYMMDDHHmm
    const datePart = NGAY_TH_YL ? String(NGAY_TH_YL).substring(0, 8) : '';
    if (!datePart) return;

    const key = `${MA_LK}|${MA_DICH_VU}|${datePart}`;

    // 3. Kiểm tra trùng lặp
    if (visitCountMap.has(key)) {
      errors.push({
        sheetName: 'XML3',
        rowIndex,
        fieldName: 'NGAY_TH_YL',
        errorCode: 'Dịch vụ thực hiện quá 1 lần trong ngày',
        errorMessage: `Dịch vụ [${MA_DICH_VU} - ${TEN_DICH_VU}] đã thực hiện ngày ${formatDate(datePart)}, không được phép làm quá 1 lần trong ngày.`,
        severity: 'error',
        ...getPatientInfo(dvktRecord),
      });
    } else {
      visitCountMap.set(key, 1);
    }
  });

  // --- Kiểm lỗi chuyên đề: MA_LOAI_KCB = 09 nhưng có tiền giường (XML1 + XML3) ---

  const noiTruNganHan = new Set<string>();

  xml1Records.forEach((record) => {
    if (record.MA_LOAI_KCB === '09' && record.MA_LK) {
      noiTruNganHan.add(record.MA_LK);
    }
  });

  xml3Records.forEach((record, rowIndex) => {
    const maLk = record.MA_LK;
    const maNhom = record.MA_NHOM;

    if (!maLk || maNhom !== '15') return;
    if (!noiTruNganHan.has(maLk)) return;

    // Ghi lỗi
    errors.push({
      sheetName: 'XML3',
      rowIndex,
      fieldName: 'MA_NHOM',
      errorCode: 'Lỗi tiền giường KCB 09',
      errorMessage: `Bệnh nhân MA_LOAI_KCB = 09 (nội trú dưới 4 giờ) nhưng vẫn có chi phí giường (MA_DICH_VU = ${record.MA_DICH_VU})`,
      severity: 'error',
      ...getPatientInfo(record),
    });
  });

  // Kiểm tra vượt công suất bàn khám (>65 lượt khám/ngày/bác sĩ)

  const congKhamByDoctorDay = new Map<
    string,
    {
      maLkSet: Set<string>;
      records: { record: any; rowIndex: number }[];
    }
  >();

  xml3Records.forEach((record, rowIndex) => {
    // Chỉ lấy công khám
    if (record.MA_NHOM !== '13') return;

    const maBacSi = record.MA_BAC_SI?.trim();
    const maLk = record.MA_LK?.trim();
    const ngayYl = record.NGAY_YL;

    if (!maBacSi || !maLk || !ngayYl) return;

    // Lấy ngày YYYYMMDD
    const ngay = ngayYl.substring(0, 8);

    const key = `${maBacSi}_${ngay}`;

    if (!congKhamByDoctorDay.has(key)) {
      congKhamByDoctorDay.set(key, {
        maLkSet: new Set(),
        records: [],
      });
    }

    const item = congKhamByDoctorDay.get(key)!;

    // Đếm MA_LK duy nhất
    item.maLkSet.add(maLk);

    // Lưu các dòng để báo lỗi sau
    item.records.push({
      record,
      rowIndex,
    });
  });

  // Kiểm tra vượt 65 lượt khám
  congKhamByDoctorDay.forEach((item) => {
    const soLuotKham = item.maLkSet.size;

    if (soLuotKham <= 65) return;

    item.records.forEach(({ record, rowIndex }) => {
      errors.push({
        sheetName: 'XML3',
        rowIndex,
        fieldName: 'MA_BAC_SI',
        errorCode: 'Lỗi vượt công suất bàn khám',
        errorMessage: `Bác sĩ ${record.MA_BAC_SI} có ${soLuotKham} lượt khám trong ngày, vượt giới hạn 65 lượt khám/ngày.`,
        severity: 'warning',
        ...getPatientInfo(record),
      });
    });
  });

  return errors;
}
