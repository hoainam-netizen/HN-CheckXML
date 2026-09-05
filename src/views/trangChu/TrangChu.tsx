import React, { useEffect, useMemo, useRef, useState } from "react";
import { validateRecord, type ValidationError } from "src/utils/danhMucKiemLoi/kiemChuyenDe";
import { validateInterRecords } from 'src/utils/danhMucKiemLoi/kiemChuyenDe';
import DailyActivity from "src/components/dashboard/DailyActivity";
import { Icon } from "@iconify/react/dist/iconify.js";
import { notification } from 'antd';
import { useFacilities } from "src/utils/interface/danhMucCSKCB";
import { ColumnDef } from "@tanstack/react-table";
import { useBenhYHCT } from "src/utils/interface/danhMucBenhYHCT";
import { useICD10 } from "src/utils/interface/danhMucICD10";
import { useChongTuongTacThuoc } from "src/utils/interface/danhMucTuongTacThuoc";
import { base64ToXml, isBase64, parseXmlToJson } from "src/utils/Base64Helper";
import { useTienKham } from "src/utils/interface/danhMucTienKham";
import { DataTableNoCheckbox } from "./BangHienThiKhongCheckbox";
import { DataTable } from "./BangHienThi";
import { useBenhManTinh } from "src/utils/interface/danhMucBenhManTinh";
import { useMucHuong } from "src/utils/interface/danhMucMucHuong";
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from "uuid";
import { formatDateTime } from "src/utils/danhMucKiemLoi/hamHoTro";
import {
  CheckCircle2,
  ChevronDown,
  X,
  LayoutList,
  RefreshCw,
  Search,
  ArrowLeftRight
} from 'lucide-react';
import { create } from "xmlbuilder2";
import { useAuth } from "./AuthContext";
// ---------------- COMPONENT -------------------
const XMLViewer: React.FC = () => {
  const ACTIVE_SHEET_KEY = "TrangChuActiveSheet";
  const SELECTED_ERROR_CODE_KEY = "TrangChuSelectedErrorCode";
  const VALIDATION_MODE_KEY = "TrangChuValidationMode";
  const { permissions } = useAuth();
  const [sheetsData, setSheetsData] = useState<Record<string, Record<string, string>[]>>({});
  const [activeSheet, setActiveSheet] = useState<string>(() => sessionStorage.getItem(ACTIVE_SHEET_KEY) || "");
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [comparisonErrors, setComparisonErrors] = useState<ValidationError[]>([]);
  const [isComparisonMode, setIsComparisonMode] = useState<boolean>(() => sessionStorage.getItem(VALIDATION_MODE_KEY) === 'inter');
  const [selectedErrorCode, setSelectedErrorCode] = useState<string>(() => sessionStorage.getItem(SELECTED_ERROR_CODE_KEY) || 'ALL');

  useEffect(() => {
    if (activeSheet) {
      sessionStorage.setItem(ACTIVE_SHEET_KEY, activeSheet);
    }
  }, [activeSheet]);

  useEffect(() => {
    sessionStorage.setItem(SELECTED_ERROR_CODE_KEY, selectedErrorCode);
  }, [selectedErrorCode]);

  const [validationMode, setValidationMode] = useState<ValidationMode>(() => {
    const saved = sessionStorage.getItem(VALIDATION_MODE_KEY);
    return saved === 'intra' || saved === 'inter' ? saved : 'all';
  });

  useEffect(() => {
    sessionStorage.setItem(VALIDATION_MODE_KEY, validationMode);
    setIsComparisonMode(validationMode === 'inter');
  }, [validationMode]);

  // Lỗi hiển thị dựa trên tab được chọn
  const displayedErrors = useMemo(
    () => (activeSheet === "ERROR_COMPARISON" ? comparisonErrors : validationErrors),
    [activeSheet, comparisonErrors, validationErrors]
  );

  const errorCodes = useMemo(
    () => Array.from(new Set(displayedErrors.map(e => e.errorCode))),
    [displayedErrors]
  );

  const filteredErrors = useMemo(() => {
    return selectedErrorCode === 'ALL'
      ? displayedErrors
      : displayedErrors.filter(err => err.errorCode === selectedErrorCode);
  }, [displayedErrors, selectedErrorCode]);
  type ValidationMode = 'all' | 'intra' | 'inter';
  const [api, contextHolder] = notification.useNotification();
  const [loadingImport, setLoadingImport] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isXmlImported, setIsXmlImported] = useState(false);
  const [importSuccess, setImportSuccess] = useState<null | number>(null);
  const [isValidated, setIsValidated] = useState(false);

  const excelInputRef = useRef<HTMLInputElement | null>(null);

  const cskcbList = useFacilities();
  const yhctList = useBenhYHCT();
  const icd10List = useICD10();
  const tuongTacThuocList = useChongTuongTacThuoc();
  const tienKhams = useTienKham();
  const manTinhList = useBenhManTinh();
  const danhMucMucHuong = useMucHuong();

  type KhungGioKCB = {
    sang: { start: string; end: string };
    chieu: { start: string; end: string };
    toi?: { start: string; end: string };
  };

  const [drugCatalogMap, setDrugCatalogMap] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [chongChiDinhThuocList, setChongChiDinhThuocList] = useState<any[]>([]);
  const [tbytList, setTbytList] = useState<any[]>([]);
  const [dvktTimeConfigList, setDvktTimeConfigList] = useState<any[]>([]);
  const [khungGioKCB, setKhungGioKCB] = useState<KhungGioKCB>({
    sang: { start: '07:00', end: '11:30' },
    chieu: { start: '13:00', end: '17:00' },
  });
  const [danhMucBoCheckMaMay, setDanhMucBoCheckMaMay] = useState<any[]>([]);
  const [dvktBatBuocMaMay, setDvktBatBuocMaMay] = useState<any[]>([]);
  const [danhMucCauHinhDVKT, setDanhMucCauHinhDVKT] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);

  const loadJson = async () => {
    try {
      const [
        drugCatalogMap,
        doctors,
        tbytList,
        chongChiDinhThuocList,
        dvktTimeConfigList,
        khungGioSystem,
        dvktKhongKiemTraMaMay,
        danhMucCauHinhDVKT,
      ] = await Promise.all([
        window.electronAPI.readJsonFile("FileDanhMucThuoc.json"),
        window.electronAPI.readJsonFile("FileNhanVienYTe.json"),
        window.electronAPI.readJsonFile("FileTrangThietBi.json"),
        window.electronAPI.readJsonFile("DanhMucChongChiDinhThuoc.json"),
        window.electronAPI.readJsonFile("ThoiGianThucHienDVKT.json"),
        window.electronAPI.readJsonFile("KhungGioKCB.json"),
        window.electronAPI.readJsonFile("DanhMucBoCheckMaMay.json"),
        window.electronAPI.readJsonFile("CauHinhDichVu.json"),
      ]);

      const fallbackKhungGioKCB = {
        sang: { start: '07:00', end: '11:30' },
        chieu: { start: '13:00', end: '17:00' },
      };

      const normalizedKhungGio =
        khungGioSystem && typeof khungGioSystem === 'object'
          ? {
              sang: {
                start: khungGioSystem?.sang?.start || fallbackKhungGioKCB.sang.start,
                end: khungGioSystem?.sang?.end || fallbackKhungGioKCB.sang.end,
              },
              chieu: {
                start: khungGioSystem?.chieu?.start || fallbackKhungGioKCB.chieu.start,
                end: khungGioSystem?.chieu?.end || fallbackKhungGioKCB.chieu.end,
              },
              ...(khungGioSystem?.toi
                ? {
                    toi: {
                      start: khungGioSystem.toi.start || '',
                      end: khungGioSystem.toi.end || '',
                    },
                  }
                : {}),
            }
          : fallbackKhungGioKCB;

      setDrugCatalogMap(drugCatalogMap || []);
      setDoctors(doctors || []);
      setChongChiDinhThuocList(chongChiDinhThuocList || []);
      setTbytList(tbytList || []);
      setDvktTimeConfigList(dvktTimeConfigList || []);
      setKhungGioKCB(normalizedKhungGio);
      setDanhMucBoCheckMaMay(dvktKhongKiemTraMaMay || []);
      const dvktBatBuocMaMayResponse = await fetch(
        `${import.meta.env.BASE_URL}DVKTBatbuocmamay.json`,
      );
      setDvktBatBuocMaMay(
        dvktBatBuocMaMayResponse.ok ? await dvktBatBuocMaMayResponse.json() : [],
      );
      setDanhMucCauHinhDVKT(Array.isArray(danhMucCauHinhDVKT)
        ? danhMucCauHinhDVKT
        : danhMucCauHinhDVKT?.list || []);
    } catch (err) {
      console.error("Lỗi khi đọc file JSON:", err);
    }
  };

  useEffect(() => {
    loadJson();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setLoadingImport(true);
    const tempData: Record<string, Record<string, string>[]> = {};
    const loadErrors: ValidationError[] = [];

    setIsXmlImported(false);
    setIsValidated(false);
    setValidationErrors([]);
    setComparisonErrors([]);
    setIsComparisonMode(false);

    try {
      for (const file of Array.from(files)) {
        const text = await file.text();
        const xmlDoc = new DOMParser().parseFromString(text, "text/xml");
        const hosoList = xmlDoc.getElementsByTagName("HOSO");

        for (let i = 0; i < hosoList.length; i++) {
          const fileNodes = hosoList[i].getElementsByTagName("FILEHOSO");
          for (let j = 0; j < fileNodes.length; j++) {
            const fileNode = fileNodes[j];
            const loai = fileNode.getElementsByTagName("LOAIHOSO")[0]?.textContent || "Unknown";
            const base64 = fileNode.getElementsByTagName("NOIDUNGFILE")[0]?.textContent || "";

            if (!isBase64(base64)) {
              loadErrors.push({
                sheetName: loai,
                rowIndex: -1,
                fieldName: "NOIDUNGFILE",
                errorCode: "INVALID_BASE64",
                errorMessage: `Nội dung file cho loại hồ sơ "${loai}" không phải Base64 hợp lệ.`,
                severity: "error",
              });
              continue;
            }

            const decoded = base64ToXml(base64);
            const records = parseXmlToJson(decoded);

            if (!tempData[loai]) tempData[loai] = [];
            tempData[loai].push(...records);
          }
        }
      }

      const maLkSet = new Set<string>();
      for (const records of Object.values(tempData)) {
        records.forEach(record => {
          if (record.MA_LK) {
            maLkSet.add(record.MA_LK);
          }
        });
      }

      const totalUniqueHoSo = maLkSet.size;

      setSheetsData(tempData);
      const savedSheet = sessionStorage.getItem(ACTIVE_SHEET_KEY);
      setActiveSheet(savedSheet && tempData[savedSheet] ? savedSheet : Object.keys(tempData)[0] || "");
      setValidationErrors(loadErrors);
      setIsXmlImported(true);
      setImportSuccess(totalUniqueHoSo);

    } catch (error) {
      console.error("Error loading file:", error);
    } finally {
      setLoadingImport(false);
    }
  };

  useEffect(() => {
    if (importSuccess !== null) {
      api.open({
        message: 'Đã import File XML thành công',
        description: `Tổng số hồ sơ XML đã đọc: ${importSuccess} hồ sơ`,
        icon: <Icon icon="solar:check-circle-linear" color="#108ee9" height={24} />,
      });

      setImportSuccess(null);
    }
  }, [importSuccess]);



  const handleValidate = () => {
    // 1. Kiểm tra dữ liệu đầu vào
    if (!sheetsData || Object.keys(sheetsData).length === 0) {
      setIsValidating(false);
      return;
    }

    // Khởi tạo/Reset các biến
    setValidationErrors([]); // Xóa kết quả cũ nếu có
    let allErrors: ValidationError[] = [];
    const xml1Records = sheetsData['XML1'] || [];

    // 2. Kiểm tra ma_cskcb trong permission với MA_CSKCB trong XML1
    if (xml1Records.length > 0) {
      const xmlMaCskcb = xml1Records[0].MA_CSKCB?.trim();
      const permissionMaCskcb = permissions.ma_cskcb?.trim();

      if (permissionMaCskcb !== '40594' &&
        xmlMaCskcb &&
        permissionMaCskcb &&
        xmlMaCskcb !== permissionMaCskcb) {
        setIsValidating(false);
        api.error({
          message: 'Kiểm tra quyền không hợp lệ',
          description: `Mã CSKCB người dùng đăng ký (${permissionMaCskcb}) không khớp với XML (${xmlMaCskcb}). Bạn không có quyền kiểm lỗi tài liệu này.`,
        });
        return;
      }
    }

    // 2. Kiểm tra MA_LK trùng (CHẶN TẠI ĐÂY)
    const maLkMap = new Map<string, number[]>();
    xml1Records.forEach((item, index) => {
      const maLK = item.MA_LK?.trim();
      if (!maLK) return;
      if (!maLkMap.has(maLK)) {
        maLkMap.set(maLK, []);
      }
      maLkMap.get(maLK)?.push(index + 1);
    });

    const duplicateErrors: string[] = [];
    maLkMap.forEach((rows, maLK) => {
      if (rows.length > 1) duplicateErrors.push(maLK);
    });

    if (duplicateErrors.length > 0) {
      api.error({
        message: (
          <span style={{ color: '#000', fontWeight: 700, fontSize: '16px' }}>
            Trùng lặp Mã Liên Kết (MA_LK)
          </span>
        ),
        description: (
          <div style={{ color: '#262626', fontSize: '14px', lineHeight: '1.6' }}>
            <p style={{ marginBottom: '8px', color: '#000' }}>
              Hệ thống <b style={{ color: '#f5222d' }}>đã dừng kiểm lỗi</b> vì các mã sau bị trùng:
            </p>

            <ul style={{
              color: '#cf1322', // Màu đỏ đậm hơn (vivid red)
              fontWeight: '600',
              backgroundColor: '#fff1f0', // Thêm nền nhẹ để làm nổi bật danh sách lỗi
              padding: '8px 25px',
              borderRadius: '4px',
              border: '1px solid #ffa39e',
              maxHeight: '150px',
              overflowY: 'auto'
            }}>
              {duplicateErrors.slice(0, 10).map((err, i) => (
                <li key={i} style={{ marginBottom: '4px' }}>{err}</li>
              ))}
              {duplicateErrors.length > 10 && (
                <li style={{ listStyle: 'none', marginLeft: '-15px', color: '#8c8c8c' }}>
                  ...và {duplicateErrors.length - 10} mã khác
                </li>
              )}
            </ul>

            <p style={{ marginTop: '8px', fontWeight: '500', color: '#000' }}>
              Vui lòng xử lý trùng lặp trước khi tiếp tục!
            </p>
          </div>
        ),
        duration: 0,
        style: {
          width: '450px',
          borderLeft: '4px solid #ff4d4f', // Thêm đường kẻ dọc bên trái để tăng tính cảnh báo
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)' // Làm bóng đổ rõ hơn
        }
      });

      // QUAN TRỌNG: Phải tắt loading trước khi thoát
      setIsValidating(false);
      setIsValidated(false);
      return; // Dừng toàn bộ hàm, không chạy xuống logic kiểm lỗi bên dưới
    }

    const xml1MapByMaLk = new Map<string, Record<string, string>>();
    xml1Records.forEach(record => {
      if (record.MA_LK) {
        xml1MapByMaLk.set(record.MA_LK, record);
      }
    });

    const xml3MapByMaLk = new Map<string, Record<string, string>[]>();
    (sheetsData.XML3 ?? []).forEach(record => {
      if (!record.MA_LK) return;
      const records = xml3MapByMaLk.get(record.MA_LK) ?? [];
      records.push(record);
      xml3MapByMaLk.set(record.MA_LK, records);
    });

    if (validationMode === 'intra' || validationMode === 'all') {
      for (const loaiHoSo in sheetsData) {
        const records = sheetsData[loaiHoSo];
        records.forEach((record, idx) => {
          const errors = validateRecord(
            loaiHoSo,
            record,
            idx,
            xml1MapByMaLk,
            cskcbList,
            drugCatalogMap,
            doctors,
            tbytList,
            yhctList,
            manTinhList,
            icd10List,
            xml3MapByMaLk);
          allErrors.push(...errors);
        });
      }
    }

    if (validationMode === 'inter' || validationMode === 'all') {
      const interErrors = validateInterRecords(
        sheetsData,
        chongChiDinhThuocList,
        tuongTacThuocList,
        doctors,
        tienKhams,
        dvktTimeConfigList,
        danhMucBoCheckMaMay,
        danhMucMucHuong,
        danhMucCauHinhDVKT,
        khungGioKCB,
        tbytList,
        dvktBatBuocMaMay,
      );
      allErrors.push(...interErrors);
    }

    const maLkWithError = new Set<string>();
    allErrors.forEach(error => {
      const sheet = error.sheetName;
      const row = error.rowIndex;
      const record = sheetsData[sheet]?.[row];
      const maLk = record?.MA_LK;
      if (maLk) {
        maLkWithError.add(maLk);
      }
    });
    api.open({
      message: 'Kết quả kiểm lỗi',
      description: `Tổng số hồ sơ XML phát hiện lỗi: ${maLkWithError.size} hồ sơ`,
      icon: <Icon icon="solar:check-circle-linear" color="#108ee9" height={24} />,
    });

    if (maLkWithError.size > 0) {
      setIsValidated(true);
    }
    setValidationErrors(allErrors);
    if (selectedErrorCode !== 'ALL' && !allErrors.some(e => e.errorCode === selectedErrorCode)) {
      setSelectedErrorCode('ALL');
    }

    if (allErrors.length > 0) {
      setSelectedErrorCode('ALL');
      setActiveSheet("ERROR");
    }
    setIsValidating(false);
  };

  const formatDOB = (value?: string) => {
    if (!value || value.length < 8) return '';

    const year = Number(value.substring(0, 4));
    const month = Number(value.substring(4, 6)) - 1;
    const day = Number(value.substring(6, 8));

    const date = new Date(year, month, day);

    return date.toLocaleDateString('vi-VN'); // 24/12/1954
  };

  const errorRecords = useMemo(() => {
    return filteredErrors.map((err, index) => ({
      STT: String(index + 1),
      'Mã LK': err.maLk || 'N/A',
      'Mã BN': err.maBn || 'N/A',
      'Họ Tên': err.hoTen || 'N/A',
      'Ngày Sinh': formatDOB(err.ngaySinh) || 'N/A',
      'Ngày Vào': formatDateTime(err.ngayVao) || 'N/A',
      'Ngày Ra': formatDateTime(err.ngayRa) || 'N/A',
      'Mã Loại KCB': err.maLoaiKcb || 'N/A',
      'Mã CSKCB': err.maCskcb || 'N/A',
      'Mô tả lỗi': `[${err.severity?.toUpperCase()}] Sheet: ${err.sheetName}${err.fieldName ? ` - Trường: ${err.fieldName}` : ''} (Mã lỗi: ${err.errorCode})`,
      'Chi tiết Lỗi': err.errorMessage,
    }));
  }, [filteredErrors]);


  const errorColumns: ColumnDef<Record<string, string>>[] = useMemo(() => {
    if (errorRecords.length === 0) return [];

    return Object.keys(errorRecords[0]).map(key => ({
      accessorKey: key,
      header: key,
      cell: info => {
        const value = info.getValue();
        if (key === 'Chi tiết Lỗi') {
          return <span style={{ color: 'red', fontWeight: 'bold' }}>{String(value)}</span>;
        }
        return value;
      },
    }));
  }, [errorRecords]);

  const handleExport = async () => {
    // Kiểm tra quyền
    if (!permissions.canExport) {
      api.open({
        message: 'Bạn không có quyền xuất dữ liệu!',
        description: "Vui lòng liên hệ quản trị viên để được cấp quyền!",
        type: 'error',
      });
      return;
    }

    // Kiểm tra ma_cskcb trong permission với MA_CSKCB trong XML1
    const xml1Records = sheetsData['XML1'] || [];
    if (xml1Records.length > 0) {
      const xmlMaCskcb = xml1Records[0].MA_CSKCB?.trim();
      const permissionMaCskcb = permissions.ma_cskcb?.trim();

      if (permissionMaCskcb !== '40594' &&
        xmlMaCskcb &&
        permissionMaCskcb &&
        xmlMaCskcb !== permissionMaCskcb) {
        api.error({
          message: 'Kiểm tra quyền không hợp lệ',
          description: `Mã CSKCB người dùng đăng ký (${permissionMaCskcb}) không khớp với XML (${xmlMaCskcb}). Bạn không có quyền xuất tài liệu này.`,
        });
        return;
      }
    }

    try {
      const filePath = await window.electronAPI.exportExcel(sheetsData);
      console.log("Excel exported and opened:", filePath);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };


  const exportErrorsEachCodeToExcel = async () => {
    // Kiểm tra quyền
    if (!permissions.canExport) {
      api.open({
        message: 'Bạn không có quyền xuất dữ liệu!',
        description: "Vui lòng liên hệ quản trị viên để được cấp quyền!",
        type: 'error',
      });
      return;
    }

    // Kiểm tra ma_cskcb trong permission với MA_CSKCB trong XML1
    const xml1Records = sheetsData['XML1'] || [];
    if (xml1Records.length > 0) {
      const xmlMaCskcb = xml1Records[0].MA_CSKCB?.trim();
      const permissionMaCskcb = permissions.ma_cskcb?.trim();

      if (permissionMaCskcb !== '40594' &&
        xmlMaCskcb &&
        permissionMaCskcb &&
        xmlMaCskcb !== permissionMaCskcb) {
        api.error({
          message: 'Kiểm tra quyền không hợp lệ',
          description: `Mã CSKCB người dùng đăng ký (${permissionMaCskcb}) không khớp với XML (${xmlMaCskcb}). Bạn không có quyền xuất tài liệu này.`,
        });
        return;
      }
    }

    try {
      await window.electronAPI.exportErrorsExcel(validationErrors);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };
  const exportErrorsCompareToExcel = async () => {
    // Kiểm tra quyền
    if (!permissions.canExport) {
      api.open({
        message: 'Bạn không có quyền xuất dữ liệu!',
        description: "Vui lòng liên hệ quản trị viên để được cấp quyền!",
        type: 'error',
      });
      return;
    }

    // Kiểm tra ma_cskcb trong permission với MA_CSKCB trong XML1
    const xml1Records = sheetsData['XML1'] || [];
    if (xml1Records.length > 0) {
      const xmlMaCskcb = xml1Records[0].MA_CSKCB?.trim();
      const permissionMaCskcb = permissions.ma_cskcb?.trim();

      if (permissionMaCskcb !== '40594' &&
        xmlMaCskcb &&
        permissionMaCskcb &&
        xmlMaCskcb !== permissionMaCskcb) {
        api.error({
          message: 'Kiểm tra quyền không hợp lệ',
          description: `Mã CSKCB người dùng đăng ký (${permissionMaCskcb}) không khớp với XML (${xmlMaCskcb}). Bạn không có quyền xuất tài liệu này.`,
        });
        return;
      }
    }

    try {
      await window.electronAPI.exportErrorsExcel(comparisonErrors);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };


  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleButtonClick = () => fileInputRef.current?.click();

  const sheetNames = useMemo(() => Object.keys(sheetsData), [sheetsData]);
  const rowData = useMemo(() => sheetsData[activeSheet] || [], [sheetsData, activeSheet]);

  const allSheets = useMemo(
    () => [
      ...(validationErrors.length > 0 ? ["ERROR"] : []),
      ...(isComparisonMode ? ["ERROR_COMPARISON"] : []),
      ...sheetNames,
    ],
    [validationErrors.length, isComparisonMode, sheetNames]
  );

  const sortedSheets = useMemo(() => {
    return [...allSheets].sort((a, b) => {
      if (a === "ERROR") return -1;
      if (a === "ERROR_COMPARISON") return -0.5;
      if (b === "ERROR") return 1;
      if (b === "ERROR_COMPARISON") return 0.5;

      const aNum = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const bNum = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return aNum - bNum;
    });
  }, [allSheets]);

  const columns: ColumnDef<Record<string, string>>[] = useMemo(() => {
    if (rowData.length === 0) return [];

    return Object.keys(rowData[0]).map(key => ({
      accessorKey: key,
      header: key,
      cell: info => {
        const value = info.getValue();
        // Nếu là cột "Chi tiết Lỗi", thì tô đỏ
        if (key === 'Chi tiết Lỗi') {
          return (
            <span style={{ color: 'red', fontWeight: 'bold' }}>
              {String(value)}
            </span>
          );
        }
        return value;
      },
      size: 160,
    }));
  }, [rowData]);

  const normalizeString = (val?: string) =>
    (val || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ');

  const normalizeDate = (val?: string) => {
    return (val || '').replace(/[^0-9]/g, '').slice(0, 12);
  };

  const buildKey = (hoTen?: string, maThe?: string, ngayVao?: string) => {
    return [
      normalizeString(hoTen),
      normalizeString(maThe),
      normalizeDate(ngayVao),
    ].join('|');
  };

  const buildExcelMap = (excelData: Record<string, string>[]) => {
    const map = new Map<string, Record<string, string>>();

    excelData.forEach(row => {
      const key = buildKey(
        row.HO_TEN,
        row.MA_THE_BHYT,
        row.NGAY_VAO
      );

      if (key) {
        map.set(key, row);
      }
    });

    return map;
  };

  const REQUIRED_COLUMNS = [
    'STT',
    'HO_TEN',
    'NGAY_SINH',
    'GIOI_TINH',
    'MA_THE_BHYT',
    'MA_BENH_CHINH',
    'NGAY_VAO',
    'NGAY_VAO_NOI_TRU',
    'NGAY_RA',
    'SO_NGAY_DTRI',
    'MA_LOAI_KCB',
    'T_TONGCHI_BV',
    'T_TONGCHI_BH',
    'T_BHTT',
    'T_BNCCT',
    'T_BNTT',
    'T_NGUONKHAC',
    'MA_CSKCB',
    'NAM_QT',
    'THANG_QT',
  ];

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingImport(true);

    try {
      const data = await file.arrayBuffer();
      // cellDates: true giúp xử lý ngày tháng tốt hơn
      const workbook = XLSX.read(data, { cellDates: true });

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, {
        defval: '',
      });

      // 1. Kiểm tra rỗng
      if (!jsonData.length) {
        setTimeout(() => {
          api.error({
            message: 'File Excel rỗng',
            description: 'Không có dữ liệu để xử lý',
          });
        }, 100);
        return;
      }

      // 2. Kiểm tra cột
      const excelColumns = Object.keys(jsonData[0] || {});
      const missingColumns = REQUIRED_COLUMNS.filter(
        col => !excelColumns.includes(col)
      );

      if (missingColumns.length > 0) {
        // ✅ Vẫn phải setLoading(false) trước khi return
        setLoadingImport(false);

        setTimeout(() => {
          api.error({
            message: 'Thiếu cột bắt buộc',
            description: `Thiếu: ${missingColumns.join(', ')}`,
          });
        }, 100);
        return; // Kết thúc tại đây nếu sai file
      }

      // 3. Nếu đúng file thì thực hiện đối chiếu
      const errors = compareExcelWithXml(sheetsData, jsonData);

      setComparisonErrors(errors);
      setIsComparisonMode(true);
      setSelectedErrorCode('ALL');
      setActiveSheet('ERROR_COMPARISON');

      const hoSoSet = new Set(errors.map(e => e.maLk));

      // ✅ Bọc trong setTimeout để tránh lỗi "notice in render"
      setTimeout(() => {
        api.open({
          message: 'Kết quả đối chiếu',
          description: `Số hồ sơ lệch: ${hoSoSet.size}`,
          icon: <Icon icon="solar:check-circle-linear" color="#108ee9" height={24} />,
          showProgress: true,
          pauseOnHover: true,
        });
      }, 150);

    } catch (err) {
      setTimeout(() => {
        api.error({
          message: 'Lỗi đọc file Excel',
          description: 'File không hợp lệ hoặc bị lỗi định dạng',
        });
      }, 100);
    } finally {
      setLoadingImport(false);
      e.target.value = '';
    }
  };

  const compareExcelWithXml = (
    sheetsData: Record<string, Record<string, string>[]>,
    excelData: Record<string, string>[],
  ): ValidationError[] => {
    const errors: ValidationError[] = [];

    const xml1Records = sheetsData['XML1'] || [];
    const excelMap = buildExcelMap(excelData);

    // =======================
    // 🔧 NORMALIZE
    // =======================
    const normalize = (val?: any) => (val ?? '').toString().trim();

    const normalizeDate = (val?: string) =>
      (val ?? '').replace(/[-: ]/g, '').substring(0, 12);

    const normalizeNumber = (val?: any) =>
      Number((val ?? '0').toString().replace(/,/g, ''));



    // =======================
    // 🔧 PUSH ERROR
    // =======================
    const pushError = (xml: any, index: number, field: string, label: string, xmlVal: any, excelVal: any) => {
      errors.push({
        sheetName: 'XML1',
        rowIndex: index,
        fieldName: field,
        errorCode: 'Lệch dữ liệu',
        errorMessage: `Chênh lệch dữ liệu (${label}): Đã gửi đề nghị thanh toán BHXH (${xmlVal}) khác với File 01/BH (${excelVal}).`,
        severity: 'error',
        maLk: xml.MA_LK,
        maBn: xml.MA_BN,
        hoTen: xml.HO_TEN,
        ngaySinh: xml.NGAY_SINH,
        gioiTinh: xml.GIOI_TINH,
        ngayVao: xml.NGAY_VAO,
        ngayRa: xml.NGAY_RA,
        maLoaiKcb: xml.MA_LOAI_KCB,
        maCskcb: xml.MA_CSKCB,
      });
    };

    const compareText = (
      xml: any,
      index: number,
      field: string,
      label: string,
      xmlVal: any,
      excelVal: any
    ) => {
      const normalizeText = (value: any) =>
        normalize(value)
          ?.toString()
          .trim()
          .toLowerCase();

      if (normalizeText(xmlVal) !== normalizeText(excelVal)) {
        pushError(xml, index, field, label, xmlVal, excelVal);
      }
    };

    const compareDate = (xml: any, index: number, field: string, label: string, xmlVal: any, excelVal: any) => {
      if (normalizeDate(xmlVal) !== normalizeDate(excelVal)) {
        pushError(xml, index, field, label, xmlVal, excelVal);
      }
    };

    const compareNumber = (xml: any, index: number, field: string, label: string, xmlVal: any, excelVal: any) => {
      if (normalizeNumber(xmlVal) !== normalizeNumber(excelVal)) {
        pushError(xml, index, field, label, xmlVal, excelVal);
      }
    };

    // =======================
    // 🔍 LOOP XML1
    // =======================
    xml1Records.forEach((xml, index) => {
      const key = buildKey(xml.HO_TEN, xml.MA_THE_BHYT, xml.NGAY_VAO);
      const excelRow = excelMap.get(key);

      // ❌ Không tìm thấy
      if (!excelRow) {
        errors.push({
          sheetName: 'XML1',
          rowIndex: index,
          fieldName: 'HO_TEN, MA_THE_BHYT, NGAY_VAO',
          errorCode: 'Không tìm thấy hồ sơ trong Excel',
          errorMessage: `Không tìm thấy hồ sơ trong Excel (Tên: ${xml.HO_TEN}, Thẻ: ${xml.MA_THE_BHYT}, Ngày vào: ${formatDateTime(xml.NGAY_VAO)})`,
          severity: 'error',

          maLk: xml.MA_LK,
          maBn: xml.MA_BN,
          hoTen: xml.HO_TEN,
          ngaySinh: xml.NGAY_SINH,
          gioiTinh: xml.GIOI_TINH,
          ngayVao: xml.NGAY_VAO,
          ngayRa: xml.NGAY_RA,
          maLoaiKcb: xml.MA_LOAI_KCB,
          maCskcb: xml.MA_CSKCB,
        });
        return;
      }

      // =======================
      // 🔍 SO FIELD
      // =======================

      // TEXT
      compareText(xml, index, 'HO_TEN', 'Họ tên', xml.HO_TEN, excelRow.HO_TEN);
      compareText(xml, index, 'MA_THE_BHYT', 'Mã thẻ', xml.MA_THE_BHYT, excelRow.MA_THE_BHYT);
      compareText(xml, index, 'MA_BENH_CHINH', 'Mã bệnh chính', xml.MA_BENH_CHINH, excelRow.MA_BENH_CHINH);
      compareText(xml, index, 'MA_CSKCB', 'Mã CSKCB', xml.MA_CSKCB, excelRow.MA_CSKCB);

      // DATE
      compareDate(xml, index, 'NGAY_SINH', 'Ngày sinh', xml.NGAY_SINH, excelRow.NGAY_SINH);
      compareDate(xml, index, 'NGAY_VAO', 'Ngày vào', xml.NGAY_VAO, excelRow.NGAY_VAO);
      compareDate(xml, index, 'NGAY_VAO_NOI_TRU', 'Ngày vào nội trú', xml.NGAY_VAO_NOI_TRU, excelRow.NGAY_VAO_NOI_TRU);
      compareDate(xml, index, 'NGAY_RA', 'Ngày ra', xml.NGAY_RA, excelRow.NGAY_RA);
      // NUMBER
      compareNumber(xml, index, 'MA_LOAI_KCB', 'Loại KCB', Number(xml.MA_LOAI_KCB), excelRow.MA_LOAI_KCB);
      compareNumber(xml, index, 'GIOI_TINH', 'Giới tính', Number(xml.GIOI_TINH), excelRow.GIOI_TINH);
      compareNumber(xml, index, 'SO_NGAY_DTRI', 'Số ngày điều trị', Number(xml.SO_NGAY_DTRI), excelRow.SO_NGAY_DTRI);
      compareNumber(xml, index, 'T_TONGCHI_BV', 'Tổng chi BV', Number(xml.T_TONGCHI_BV), excelRow.T_TONGCHI_BV);
      compareNumber(xml, index, 'T_TONGCHI_BH', 'Tổng chi BH', Number(xml.T_TONGCHI_BH), excelRow.T_TONGCHI_BH);
      compareNumber(xml, index, 'T_BHTT', 'BH thanh toán', Number(xml.T_BHTT), excelRow.T_BHTT);
      compareNumber(xml, index, 'T_BNCCT', 'BN cùng chi trả', Number(xml.T_BNCCT), excelRow.T_BNCCT);
      compareNumber(xml, index, 'T_BNTT', 'BN tự trả', Number(xml.T_BNTT), excelRow.T_BNTT);
      compareNumber(xml, index, 'T_NGUONKHAC', 'Nguồn khác', Number(xml.T_NGUONKHAC), excelRow.T_NGUONKHAC);

      // =======================
      // 🔥 NĂM_QT / THÁNG_QT
      // =======================

      compareNumber(xml, index, 'NAM_QT', 'Năm quyết toán', Number(xml.NAM_QT), excelRow.NAM_QT);
      compareNumber(xml, index, 'THANG_QT', 'Tháng quyết toán', Number(xml.THANG_QT), excelRow.THANG_QT);
    });

    return errors;
  };

  const buildSummaryData = () => {
    const xml1 = sheetsData["XML1"] || [];

    // Kiểm tra MA_LK trùng
    const maLkMap = new Map<string, number[]>();

    xml1.forEach((item, index) => {
      const maLK = item.MA_LK?.trim();

      if (!maLK) return;

      if (!maLkMap.has(maLK)) {
        maLkMap.set(maLK, []);
      }

      maLkMap.get(maLK)?.push(index + 1); // lưu STT
    });

    // Lấy danh sách MA_LK bị trùng
    const duplicateErrors: string[] = [];

    maLkMap.forEach((rows, maLK) => {
      if (rows.length > 1) {
        duplicateErrors.push(
          `${maLK}`
        );
      }
    });

    // Báo lỗi nếu có MA_LK trùng
    if (duplicateErrors.length > 0) {
      api.error({
        message: (
          <span style={{ color: '#000', fontWeight: 700, fontSize: '16px' }}>
            Trùng lặp Mã Liên Kết (MA_LK)
          </span>
        ),
        description: (
          <div style={{ color: '#262626', fontSize: '14px', lineHeight: '1.6' }}>
            <p style={{ marginBottom: '8px', color: '#000' }}>
              Hệ thống <b style={{ color: '#f5222d' }}>không thể xuất File</b> vì các mã sau trùng:
            </p>

            <ul style={{
              color: '#cf1322', // Màu đỏ đậm hơn (vivid red)
              fontWeight: '600',
              backgroundColor: '#fff1f0', // Thêm nền nhẹ để làm nổi bật danh sách lỗi
              padding: '8px 25px',
              borderRadius: '4px',
              border: '1px solid #ffa39e',
              maxHeight: '150px',
              overflowY: 'auto'
            }}>
              {duplicateErrors.slice(0, 10).map((err, i) => (
                <li key={i} style={{ marginBottom: '4px' }}>{err}</li>
              ))}
              {duplicateErrors.length > 10 && (
                <li style={{ listStyle: 'none', marginLeft: '-15px', color: '#8c8c8c' }}>
                  ...và {duplicateErrors.length - 10} mã khác
                </li>
              )}
            </ul>

            <p style={{ marginTop: '8px', fontWeight: '500', color: '#000' }}>
              Vui lòng xử lý trùng lặp trước khi thực hiện lại!
            </p>
          </div>
        ),
        duration: 0,
        style: {
          width: '450px',
          borderLeft: '4px solid #ff4d4f', // Thêm đường kẻ dọc bên trái để tăng tính cảnh báo
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)' // Làm bóng đổ rõ hơn
        }
      });
      return null;
    }

    return xml1.map((item, index) => ({
      STT: index + 1,
      HO_TEN: item.HO_TEN || "",
      NGAY_SINH: item.NGAY_SINH || "",
      GIOI_TINH: Number(item.GIOI_TINH) || "",
      MA_THE_BHYT: item.MA_THE_BHYT || "",
      MA_BENH_CHINH: item.MA_BENH_CHINH || "",
      NGAY_VAO: item.NGAY_VAO || "",
      NGAY_VAO_NOI_TRU: item.NGAY_VAO_NOI_TRU || "",
      NGAY_RA: item.NGAY_RA || "",
      SO_NGAY_DTRI: Number(item.SO_NGAY_DTRI) || 0,
      MA_LOAI_KCB: item.MA_LOAI_KCB || "",
      T_TONGCHI_BV: Number(item.T_TONGCHI_BV) || 0,
      T_TONGCHI_BH: Number(item.T_TONGCHI_BH) || 0,
      T_BHTT: Number(item.T_BHTT) || 0,
      T_BNCCT: Number(item.T_BNCCT) || 0,
      T_BNTT: Number(item.T_BNTT) || 0,
      T_NGUONKHAC: Number(item.T_NGUONKHAC) || 0,
      MA_CSKCB: item.MA_CSKCB || "",
      NAM_QT: Number(item.NAM_QT) || 0,
      THANG_QT: Number(item.THANG_QT) || 0,
    }));
  };

  const [loadingSign, setLoadingSign] = useState(false);

  const XML_CONFIGS: Record<string, any> = {
    MAU01: {
      label: "Mẫu 01/BH - C79 Hồ sơ thanh toán BHYT",
      rootWrapper: "HSTH01BH",
      rootTag: "DS_CHITIET",
      itemTag: "CHITIET_HS01BH",
      includeNamespace: false,
      columns: [
        "STT", "HO_TEN", "NGAY_SINH", "GIOI_TINH", "MA_THE_BHYT", "MA_BENH_CHINH",
        "NGAY_VAO", "NGAY_VAO_NOI_TRU", "NGAY_RA", "SO_NGAY_DTRI", "MA_LOAI_KCB",
        "T_TONGCHI_BV", "T_TONGCHI_BH", "T_BHTT", "T_BNCCT", "T_BNTT", "T_NGUONKHAC",
        "MA_CSKCB", "NAM_QT", "THANG_QT"
      ],
      fileName: "Mẫu 01BH - C79 Hồ sơ thanh toán BHYT",
    },
  };

  const currentConfig = useMemo(() => XML_CONFIGS["MAU01"], []);

  /**
   * LOGIC TẠO XML TRƯỚC KHI KÝ
   */
  const buildXmlLogic = (inputData: any[], isSigning: boolean) => {
    const documentId = uuidv4();
    const rootName = currentConfig.rootWrapper || "HSDANHMUC";
    const rootAttrs = currentConfig.includeNamespace
      ? { "xmlns:xsd": "http://www.w3.org/2001/XMLSchema", "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance" }
      : undefined;

    const root = create({ version: "1.0", encoding: "UTF-8" }).ele(rootName, rootAttrs);
    const listNode = root.ele(currentConfig.rootTag, { Id: `Id-${documentId}` });

    inputData.forEach((item) => {
      const node = listNode.ele(currentConfig.itemTag);
      currentConfig.columns.forEach((col: string) => {
        node.ele(col).txt(String(item[col] ?? ""));
      });
    });

    if (isSigning) {
      root.ele("CHUKYDONVI", { Id: `CHUKYDONVI-Id-${documentId}` });
    }
    return root;
  };

  /**
   * XỬ LÝ XUẤT EXCEL TỔNG HỢP (Mẫu 01/BH)
   * Dùng cho nút ở Nhóm 3
   */
  const handleExportSummary = async () => {
    if (!permissions.canExport) {
      api.open({
        message: 'Bạn không có quyền xuất File Excel 01/BH!',
        description: "Vui lòng liên hệ quản trị viên để được cấp quyền!",
        type: 'error',
      });
      return;
    }

    // 2. Kiểm tra xem đã import XML chưa (Logic nghiệp vụ của bạn)
    if (!isXmlImported) {
      api.open({
        message: 'Chưa có dữ liệu XML',
        description: "Vui lòng nhập dữ liệu XML trước khi thực hiện!",
        type: 'warning',
      });
      return;
    }

    // 3. Kiểm tra ma_cskcb trong permission với MA_CSKCB trong XML1
    const xml1Records = sheetsData['XML1'] || [];
    if (xml1Records.length > 0) {
      const xmlMaCskcb = xml1Records[0].MA_CSKCB?.trim();
      const permissionMaCskcb = permissions.ma_cskcb?.trim();

      // Mã 40594 được phép xuất tất cả
      if (
        permissionMaCskcb !== '40594' &&
        xmlMaCskcb &&
        permissionMaCskcb &&
        xmlMaCskcb !== permissionMaCskcb
      ) {
        api.error({
          message: 'Kiểm tra quyền không hợp lệ',
          description: `Mã CSKCB người dùng đăng ký (${permissionMaCskcb}) không khớp với XML (${xmlMaCskcb}). Bạn không có quyền xuất tài liệu này.`,
        });
        return;
      }
    }

    try {
      // buildSummaryData() là hàm bạn dùng để tính toán số liệu tổng từ rowData
      const sData = buildSummaryData();
      // DỪNG LẠI NẾU CÓ LỖI (Dữ liệu trùng hoặc lỗi logic)
      if (sData === null) return;

      const result = await window.electronAPI.exportExcelSummary({
        "Mẫu 01 BH": sData
      });

      if (result) {
        api.open({
          message: 'Xuất báo cáo thành công',
          description: `File đã được lưu tại đường dẫn Export.`,
          type: 'success',
        });
      }
    } catch (err) {
      api.open({
        message: 'Lỗi xuất Excel',
        description: 'Không thể trích xuất dữ liệu tổng hợp 01/BH.',
        type: 'error',
      });
    }
  };

  /**
 * XỬ LÝ XUẤT XML + KÝ SỐ (MẪU 01/BH)
 * Lấy dữ liệu từ buildSummaryData() thay vì đọc từ file Excel input
 */
  const handleExportXmlAndSign = async () => {
    // Kiểm tra điều kiện
    if (!permissions.canExport) {
      api.open({
        message: 'Bạn không có quyền xuất File XML + Ký số (01/BH)!',
        description: "Vui lòng liên hệ quản trị viên để được cấp quyền!",
        type: 'error',
      });
      return;
    }

    // 2. Kiểm tra xem đã import XML chưa (Logic nghiệp vụ của bạn)
    if (!isXmlImported) {
      api.open({
        message: 'Chưa có dữ liệu XML!',
        description: "Vui lòng nhập dữ liệu XML trước khi thực hiện!",
        type: 'warning',
      });
      return;
    }

    // 3. Kiểm tra ma_cskcb trong permission với MA_CSKCB trong XML1
    const xml1Records = sheetsData['XML1'] || [];
    if (xml1Records.length > 0) {
      const xmlMaCskcb = xml1Records[0].MA_CSKCB?.trim();
      const permissionMaCskcb = permissions.ma_cskcb?.trim();

      if (permissionMaCskcb !== '40594' &&
        xmlMaCskcb &&
        permissionMaCskcb &&
        xmlMaCskcb !== permissionMaCskcb) {
        api.error({
          message: 'Kiểm tra quyền không hợp lệ',
          description: `Mã CSKCB người dùng đăng ký (${permissionMaCskcb}) không khớp với XML (${xmlMaCskcb}). Bạn không có quyền xuất tài liệu này.`,
        });
        return;
      }
    }

    setLoadingSign(true);

    try {
      // 1. Lấy dữ liệu tổng hợp
      const sData = buildSummaryData();
      if (sData === null) return;
      if (!sData || sData.length === 0) {
        throw new Error("Dữ liệu tổng hợp trống.");
      }

      // 2. Tạo cấu trúc XML (Gửi true để có node CHUKYDONVI cho file EXE xử lý)
      const doc = buildXmlLogic(sData, true);
      const xmlString = doc.end({ prettyPrint: true });

      // 3. Gọi hàm ký số (Sử dụng đúng tên hàm trong preload)
      // Lưu ý: window.electronAPI.signXml sẽ gọi invoke("sign-xml-with-exe")
      const signedXml = await window.electronAPI.signXml(xmlString);

      if (!signedXml) {
        setLoadingSign(false);
        return api.open({
          message: 'Hủy bỏ',
          description: 'Người dùng đã hủy hoặc ký số thất bại.',
          type: 'info',
        });
      }

      // 4. Lưu file (Truyền đúng Object { content, fileName })
      const saveResult = await window.electronAPI.saveFile({
        content: signedXml,
        fileName: "Mẫu 01BH - C79 Hồ sơ thanh toán BHYT.xml"
      });

      if (saveResult?.success) {
        api.open({
          message: 'Thành công',
          description: 'Hồ sơ đã được ký và lưu thành công!',
          type: 'success',
        });
      } else if (saveResult?.message !== "Người dùng đã hủy") {
        throw new Error(saveResult?.message);
      }

    } catch (err: any) {
      api.open({
        message: 'Có lỗi xảy ra khi thực hiện',
        description: typeof err === 'string' ? err : err.message,
        type: 'error',
      });
    } finally {
      setLoadingSign(false);
    }
  };

  const handleValidateClick = () => {
    // 2. Kiểm tra quyền kiểm lỗi
    if (!permissions.canValidate) {
      api.open({
        message: 'Bạn không có quyền thực hiện kiểm lỗi!',
        description: "Vui lòng liên hệ quản trị viên để được cấp quyền!",
        type: 'error',
      });
      return;
    }

    // 3. Kiểm tra điều kiện dữ liệu
    if (!isXmlImported) {
      api.open({
        message: 'Chưa có dữ liệu XML!',
        description: "Vui lòng nhập dữ liệu XML trước khi thực hiện!",
        type: 'warning',
      });
      return;
    }

    // Nếu tất cả đều ổn thì mở Modal
    setIsModalOpen(true);
  };

  const handleCompareExcelClick = () => {
    // 1. Kiểm tra quyền thực hiện (canExport hoặc một quyền canCompare nếu bạn có)
    if (!permissions.canCompare) {
      api.open({
        message: 'Bạn không có quyền thực hiện đối chiếu!',
        description: "Vui lòng liên hệ quản trị viên để được cấp quyền!",
        type: 'error',
      });
      return;
    }

    // 2. Kiểm tra xem đã import XML chưa (Logic nghiệp vụ của bạn)
    if (!isXmlImported) {
      api.open({
        message: 'Chưa có dữ liệu XML!',
        description: "Vui lòng nhập dữ liệu XML trước khi thực hiện!",
        type: 'warning',
      });
      return;
    }

    // 3. Kiểm tra ma_cskcb trong permission với MA_CSKCB trong XML1
    const xml1Records = sheetsData['XML1'] || [];
    if (xml1Records.length > 0) {
      const xmlMaCskcb = xml1Records[0].MA_CSKCB?.trim();
      const permissionMaCskcb = permissions.ma_cskcb?.trim();

      if (permissionMaCskcb !== '40594' &&
        xmlMaCskcb &&
        permissionMaCskcb &&
        xmlMaCskcb !== permissionMaCskcb) {
        api.error({
          message: 'Kiểm tra quyền không hợp lệ',
          description: `Mã CSKCB người dùng đăng ký (${permissionMaCskcb}) không khớp với XML (${xmlMaCskcb}). Bạn không có quyền đối chiếu tài liệu này.`,
        });
        return;
      }
    }

    // 4. Nếu đủ điều kiện thì mới kích hoạt chọn file
    excelInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 relative">
      {contextHolder}
      {isValidating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <div className="rounded-3xl bg-white p-8 shadow-2xl border border-slate-200 flex flex-col items-center gap-4">
            <RefreshCw className="animate-spin text-[#3F8A3E]" size={48} />
            <p className="text-slate-700 font-semibold text-lg">Đang kiểm lỗi, vui lòng chờ...</p>
            <p className="text-slate-500 text-sm">Hệ thống đang quét và tổng hợp kết quả lỗi.</p>
          </div>
        </div>
      )}
      {loadingImport ? (
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <RefreshCw className="animate-spin text-[#3F8A3E] mb-4" size={48} />
          <p className="text-slate-500 animate-pulse">Đang tải dữ liệu, vui lòng đợi...</p>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto space-y-8">


          {/* ====== KHU VỰC ĐIỀU KHIỂN (CONTROLS) ====== */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
            {/* Nhóm 1: Nhập liệu - GIỮ NGUYÊN */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 px-1">
                <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                  <Icon icon="solar:import-bold" width={18} height={18} />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-widest">Nhập dữ liệu</h3>
              </div>
              <div className="flex flex-col gap-3 h-full">
                <button onClick={handleButtonClick} className="flex-1 flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-500 hover:shadow-md transition-all group">
                  <span className="font-bold text-slate-600 group-hover:text-indigo-600">Import XML</span>
                  <Icon icon="solar:add-circle-bold" className="text-indigo-500" width={24} />
                </button>

                <input type="file" accept=".xlsx, .xls" ref={excelInputRef} className="hidden" onChange={handleExcelImport} />
                <button
                  onClick={handleCompareExcelClick}
                  className="flex-1 flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all group disabled:opacity-40"
                >
                  <div className="flex flex-col items-start">
                    <span className="font-bold text-slate-600 group-hover:text-blue-600">Đối chiếu XML với 01/BH</span>
                    <span className="text-[12px] text-slate-400">Import File Excel</span>
                  </div>
                  <ArrowLeftRight size={24} className="text-green-500" />
                </button>
              </div>
            </div>

            {/* Nhóm 2: Hệ thống kiểm tra - GIỮ NGUYÊN */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 px-1">
                <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg">
                  <Icon icon="solar:shield-warning-bold" width={18} height={18} />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-widest">Hệ thống kiểm tra</h3>
              </div>
              <button
                onClick={handleValidateClick}
                className="relative flex-1 flex flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 p-6 shadow-lg shadow-rose-200 hover:shadow-rose-300 hover:-translate-y-1 transition-all disabled:grayscale disabled:opacity-50"
              >
                <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm border border-white/30">
                  <Icon icon="solar:danger-triangle-bold-duotone" width={32} height={32} className="text-white" />
                </div>
                <div className="text-center">
                  <span className="block text-white font-bold text-base leading-tight">KIỂM LỖI HỒ SƠ</span>
                  <p className="text-rose-100 text-[12px] mt-1 font-medium opacity-80">Click để bắt đầu quét lỗi</p>
                </div>
              </button>
            </div>

            {/* Nhóm 3: Xuất dữ liệu - CHỈ GIỮ LẠI NÚT 01/BH */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 px-1">
                <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                  <Icon icon="solar:export-bold" width={18} height={18} />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-widest">Xuất báo cáo</h3>
              </div>
              <div className="flex flex-col gap-3 h-full">
                <button
                  onClick={handleExportSummary}
                  className="flex-1 flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all group disabled:opacity-40"
                >
                  <Icon icon="solar:document-text-bold" width={24} className="text-emerald-600" />
                  <span className="font-bold text-slate-600 group-hover:text-blue-600">Xuất Excel (Mẫu 01/BH)</span>
                </button>
                <button
                  onClick={handleExportXmlAndSign}
                  disabled={loadingSign}
                  className="flex-1 flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all group disabled:opacity-40"
                >
                  {loadingSign ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
                  ) : (
                    <Icon icon="solar:file-right-bold" width={24} className="text-orange-600" />
                  )}
                  <div className="flex flex-col items-start text-left">
                    <span className="font-bold text-slate-600 group-hover:text-blue-600">
                      {loadingSign ? "Đang xử lý ký số..." : "Xuất XML + Ký số (Mẫu 01/BH)"}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* ====== KHU VỰC HIỂN THỊ BẢNG (RESULTS) ====== */}
          {(rowData.length > 0 || validationErrors.length > 0 || comparisonErrors.length > 0 || isComparisonMode) && (
            <div className="text-dark animate-in fade-in slide-in-from-bottom-4 duration-500 mt-8">
              <div className="rounded-2xl shadow-xl shadow-slate-200/50 bg-white border border-slate-200 overflow-hidden">

                {/* Header Table */}
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${activeSheet === "ERROR" ? "bg-red-100" : activeSheet === "ERROR_COMPARISON" ? "bg-orange-100" : "bg-blue-100"}`}>
                      <LayoutList size={20} className={activeSheet === "ERROR" ? "text-red-600" : activeSheet === "ERROR_COMPARISON" ? "text-orange-600" : "text-blue-600"} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">
                        {activeSheet === "ERROR" ? "Danh sách lỗi Chuyên đề" : activeSheet === "ERROR_COMPARISON" ? "Lỗi Đối chiếu 01/BH" : "Thông tin hồ sơ XML"}
                      </h2>
                      <p className="text-xs text-slate-500">Dữ liệu chi tiết cho mục tiêu kiểm tra</p>
                    </div>
                  </div>

                  {/* Filter Mã lỗi */}
                  {(activeSheet === "ERROR" || activeSheet === "ERROR_COMPARISON") && (
                    <div className="relative w-full md:w-64">
                      <select
                        value={selectedErrorCode}
                        onChange={(e) => setSelectedErrorCode(e.target.value)}
                        className="w-full pl-3 pr-10 py-2 bg-white border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
                      >
                        <option value="ALL">Tất cả mã lỗi</option>
                        {errorCodes.map((code) => <option key={code} value={code}>{code}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-2.5 pointer-events-none" size={16} />
                    </div>
                  )}
                </div>

                {/* Tabs điều hướng + CÁC NÚT XUẤT TƯƠNG ỨNG */}
                <div className="px-6 flex flex-row justify-between items-center border-b border-slate-100 bg-white gap-4">

                  {/* 1. Phần danh sách Tabs: flex-1 cho phép chiếm vùng trống, overflow-x-auto để cuộn */}
                  <div className="flex-1 flex gap-1 overflow-x-auto no-scrollbar py-1">
                    {sortedSheets.map((sheet) => {
                      const isError = sheet === "ERROR";
                      const isComp = sheet === "ERROR_COMPARISON";
                      const isActive = activeSheet === sheet;
                      const count = isError ? validationErrors.length : isComp ? comparisonErrors.length : null;

                      return (
                        <button
                          key={sheet}
                          onClick={() => setActiveSheet(sheet)}
                          className={`flex items-center gap-2 px-4 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${isActive
                            ? isError
                              ? "border-red-500 text-red-600 bg-red-50/50"
                              : isComp
                                ? "border-orange-500 text-orange-600 bg-orange-50/50"
                                : "border-blue-500 text-blue-600 bg-blue-50/50"
                            : "border-transparent text-slate-500 hover:text-slate-600 hover:bg-slate-50"
                            }`}
                        >
                          {sheet === "ERROR" ? "Lỗi Chuyên đề" : sheet === "ERROR_COMPARISON" ? "Lỗi Đối chiếu" : sheet}
                          {count !== null && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${isActive ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* 2. Phần nút Xuất: flex-shrink-0 đảm bảo nút không bao giờ bị bóp méo/co dãn */}
                  <div className="py-2 flex gap-2 flex-shrink-0">
                    {/* 1. Nếu đang ở tab Đối chiếu Excel */}
                    {activeSheet === "ERROR_COMPARISON" ? (
                      <button
                        onClick={exportErrorsCompareToExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl hover:bg-amber-100 transition-all text-sm font-bold shadow-sm whitespace-nowrap"
                      >
                        <Icon icon="solar:clipboard-list-bold" width={18} />
                        <span>Xuất KQ Đối chiếu</span>
                      </button>
                    ) :
                      /* 2. Nếu đang ở tab Kiểm lỗi XML thông thường */
                      activeSheet === "ERROR" ? (
                        <button
                          onClick={exportErrorsEachCodeToExcel}
                          disabled={!isValidated}
                          className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-100 transition-all text-sm font-bold shadow-sm disabled:opacity-40 whitespace-nowrap"
                        >
                          <Icon icon="solar:bug-minimalistic-bold" width={18} />
                          <span>Xuất Danh sách lỗi XML</span>
                        </button>
                      ) : (
                        /* 3. Các tab dữ liệu khác (Bảng kê 01, 02, ...) */
                        <button
                          onClick={handleExport}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all text-sm font-bold shadow-sm whitespace-nowrap"
                        >
                          <Icon icon="solar:file-download-bold" width={18} />
                          <span>Xuất Excel Hồ sơ XML</span>
                        </button>
                      )}
                  </div>
                </div>

                {/* Table Content */}
                <div className="overflow-x-auto">
                  {activeSheet === "ERROR" && validationErrors.length === 0 ? (
                    <EmptyState message="Không phát hiện lỗi các Chuyên đề" />
                  ) : activeSheet === "ERROR_COMPARISON" && comparisonErrors.length === 0 ? (
                    <EmptyState message="Không phát hiện lỗi Đối chiếu HS 01/BH" color="emerald" />
                  ) : (activeSheet === "ERROR" || activeSheet === "ERROR_COMPARISON") ? (
                    <DataTableNoCheckbox columns={errorColumns} data={errorRecords} />
                  ) : (
                    <DataTable columns={columns} data={rowData} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ====== MODAL CHỌN CHUYÊN ĐỀ ====== */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
              <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-blue-100 rounded-2xl">
                    <Icon icon="solar:danger-triangle-bold" width={24} height={24} className="text-blue-600" />
                  </div>
                  <h2 className="text-xl font-black text-slate-800">Cấu hình kiểm lỗi</h2>
                </div>

                <label className="block text-sm font-bold text-slate-500 mb-2 ml-1 uppercase tracking-tighter">Chọn chế độ kiểm tra</label>
                <div className="relative mb-8">
                  <select
                    value={validationMode}
                    onChange={(e) => setValidationMode(e.target.value as ValidationMode)}
                    className="w-full border-2 border-slate-100 p-4 rounded-2xl text-slate-800 font-bold focus:border-blue-500 outline-none appearance-none transition-all"
                  >
                    <option value="all">Kiểm tra tất cả (Đề xuất)</option>
                    <option value="intra">Kiểm tra quy tắc (Nội bộ)</option>
                    <option value="inter">Kiểm tra chuyên đề (Liên kết)</option>
                  </select>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all"
                  >
                    Huỷ bỏ
                  </button>
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      setIsValidating(true);
                      setTimeout(() => handleValidate(), 100);
                    }}
                    disabled={loadingImport || isValidating}
                    className="flex-2 px-8 py-4 bg-[#3F8A3E] hover:bg-[#3F8A3E] text-white rounded-2xl font-bold shadow-lg shadow-green-200 transition-all disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    {loadingImport || isValidating ? 'Đang chạy...' : 'Bắt đầu kiểm tra'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ====== MODAL DANH SÁCH CHỨC NĂNG ====== */}
          {openModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] shadow-2xl relative flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <LayoutList className="text-blue-600" /> Danh mục chức năng hệ thống
                  </h3>
                  <button onClick={() => setOpenModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto">
                  <DailyActivity />
                </div>
              </div>
            </div>
          )}

          {/* ====== FOOTER ====== */}
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

          {/* Input file ẩn */}
          <input
            type="file"
            accept=".xml"
            multiple
            onChange={handleFileChange}
            ref={fileInputRef}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
};

// Component con hỗ trợ hiển thị trống
const EmptyState = ({ message, color = "blue" }: { message: string; color?: string }) => (
  <div className="flex flex-col items-center justify-center py-20 bg-white">
    <div className={`p-4 rounded-full bg-${color}-50 mb-4 animate-bounce`}>
      <CheckCircle2 size={48} className={`text-${color}-500`} />
    </div>
    <p className={`text-${color}-600 text-lg font-black`}>{message}</p>
    <p className=" text-sm mt-1">Hệ thống không phát hiện bất thường nào.</p>
  </div>
);

export default XMLViewer;

