import React, { useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { create } from "xmlbuilder2";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";

// 1. CẤU HÌNH TẤT CẢ CÁC MẪU TẠI ĐÂY
const XML_CONFIGS: Record<string, any> = {
    MAU07: {
        label: "Mẫu 01/BH - C79 Hồ sơ thanh toán BHYT",
        rootWrapper: "HSTH01BH",
        rootTag: "DS_CHITIET",
        itemTag: "CHITIET_HS01BH",
        includeNamespace: false,
        columns: [
            "STT",
            "HO_TEN",
            "NGAY_SINH",
            "GIOI_TINH",
            "MA_THE_BHYT",
            "MA_BENH_CHINH",
            "NGAY_VAO",
            "NGAY_VAO_NOI_TRU",
            "NGAY_RA",
            "SO_NGAY_DTRI",
            "MA_LOAI_KCB",
            "T_TONGCHI_BV",
            "T_TONGCHI_BH",
            "T_BHTT",
            "T_BNCCT",
            "T_BNTT",
            "T_NGUONKHAC",
            "MA_CSKCB",
            "NAM_QT",
            "THANG_QT"
        ],
        fileName: "Mẫu 01BH - C79 Hồ sơ thanh toán BHYT",
    },
    MAU01: {
        label: "Mẫu 01/DM - DM bộ phận chuyên môn",
        rootTag: "DANHSACH_DMBOPHANCHUYENMON",
        itemTag: "DMBOPHANCHUYENMON",
        fileName: "Mẫu 01 - DM bộ phận chuyên môn",
        includeNamespace: true,
        columns: ["STT", "MA_KHOA", "TEN_KHOA", "BAN_KHAM", "GIUONG_PD", "GIUONG_TK", "GIUONG_HSTC", "GIUONG_HSCC", "TU_NGAY", "DEN_NGAY", "MA_CSKCB"]
    },
    MAU02: {
        label: "Mẫu 02/DM - DM nhân lực tham gia KBCB",
        rootTag: "DANHSACH_DMNHANLUCKBCB",
        itemTag: "DMNHANLUCKBCB",
        includeNamespace: true,
        fileName: "Mẫu 02 - DM nhân lực tham gia KBCB",
        columns: [
            "STT",
            "MA_KHOA",
            "TEN_KHOA",
            "HO_TEN",
            "GIOI_TINH",
            "SO_DINH_DANH",
            "CHUCDANH_NN",
            "VI_TRI",
            "MACCHN",
            "NGAYCAP_CCHN",
            "NOICAP_CCHN",
            "PHAMVI_CM",
            "PHAMVI_CMBS",
            "DVKT_KHAC",
            "VB_PHANCONG",
            "THOIGIAN_DK",
            "THOIGIAN_NGAY",
            "THOIGIAN_TUAN",
            "CSKCB_KHAC",
            "CSKCB_CGKT",
            "QD_CGKT",
            "TU_NGAY",
            "DEN_NGAY",
            "MA_CSKCB"
        ]
    },
    MAU03: {
        label: "Mẫu 03/DM - DM thuốc, máu, chế phẩm máu thanh toán BHYT",
        rootTag: "DANHSACH_DMTHUOCMAUCHEPHAMMAU",
        itemTag: "DMTHUOCMAUCHEPHAMMAU",
        includeNamespace: true,
        fileName: "Mẫu 03 - DM thuốc, máu, chế phẩm máu thanh toán BHYT",
        columns: [
            "STT",
            "MA_THUOC",
            "TEN_HOAT_CHAT",
            "TEN_THUOC",
            "DON_VI_TINH",
            "HAM_LUONG",
            "DUONG_DUNG",
            "MA_DUONG_DUNG",
            "DANG_BAO_CHE",
            "SO_DANG_KY",
            "SO_LUONG",
            "DON_GIA",
            "DON_GIA_BH",
            "QUY_CACH",
            "NHA_SX",
            "NUOC_SX",
            "NHA_THAU",
            "TT_THAU",
            "TU_NGAY_HD",
            "DEN_NGAY_HD",
            "MA_CSKCB",
            "LOAI_THUOC",
            "LOAI_THAU",
            "HT_THAU",
            "MA_DVKT",
            "TCCL",
            "BO_PHAN_VT",
            "TEN_KHOA_HOC",
            "NGUON_GOC",
            "PP_CHEBIEN",
            "MA_DL_NHAP",
            "MA_DL_CB",
            "TLHH_CB",
            "TLHH_BQ",
            "MA_CSKCB_THUOC",
            "TU_NGAY",
            "DEN_NGAY"
        ]
    },
    MAU04: {
        label: "Mẫu 04/DM - DM thiết bị y tế thanh toán BHYT",
        rootTag: "DSACH_TBYT",
        itemTag: "DM_TBYT",
        includeNamespace: true,
        fileName: "Mẫu 04 - DM thiết bị y tế thanh toán BHYT",
        columns: [
            "STT",
            "MA_VAT_TU",
            "NHOM_VAT_TU",
            "TEN_VAT_TU",
            "MA_HIEU",
            "SO_LUU_HANH",
            "TINHNANG_KT",
            "QUY_CACH",
            "HANG_SX",
            "NUOC_SX",
            "DON_VI_TINH",
            "DON_GIA",
            "DON_GIA_BH",
            "TYLE_TT_BH",
            "SO_LUONG",
            "DINH_MUC",
            "NHA_THAU",
            "TT_THAU",
            "TU_NGAY_HD",
            "DEN_NGAY_HD",
            "MA_CSKCB",
            "LOAI_THAU",
            "HT_THAU",
            "MA_CSKCB_TBYT",
            "TU_NGAY",
            "DEN_NGAY"
        ]
    },
    MAU05: {
        label: "Mẫu 05/DM - DM dịch vụ khám bệnh, chữa bệnh thanh toán BHYT",
        rootTag: "DANHSACH_DMDICHVUKBCB",
        itemTag: "DMDICHVUKBCB",
        includeNamespace: true,
        // Các cột thuộc level 1
        columns: [
            "STT", "MA_DICH_VU", "TEN_DICH_VU", "TEN_DVKT_GIA", "DON_GIA",
            "QUY_TRINH", "SO_LUONG_CGKT", "CSKCB_CGKT", "CSKCB_CLS",
            "QD_DVKT", "QD_PD_GIA", "GHI_CHU", "TU_NGAY", "DEN_NGAY",
            "MA_CSKCB", "GIA_THANH_TOAN"
        ],
        // Định nghĩa phần lồng nhau
        nested: {
            wrapper: "DS_THUOCPX",
            item: "TT_THUOCPX",
            prefix: "THUOCPX_",
            columns: [
                "STT", "MA_THUOC", "TEN_THUOC", "SO_DANG_KY", "DON_VI_TINH",
                "TT_THAU", "DON_GIA_THUOC", "DM_NSX_CDD", "DM_THUCTE_CDD",
                "LIEU_BQ_PX", "TL_THUCTE_BQ_PX", "THANH_TIEN_THUOC"
            ]
        },
        fileName: "Mẫu 05 - DM dịch vụ khám bệnh, chữa bệnh thanh toán BHYT",
    },
    MAU06: {
        label: "Mẫu 06/DM - DM thiết bị y tế để thực hiện dịch vụ kỹ thuật",
        rootTag: "DSACH_TBYTTHDV",
        itemTag: "DM_TBYTTHDV",
        includeNamespace: true,
        fileName: "Mẫu 06 - DM thiết bị y tế để thực hiện dịch vụ kỹ thuật",
        columns: [
            "STT",
            "TEN_TB",
            "KY_HIEU",
            "CONGTY_SX",
            "NUOC_SX",
            "NAM_SX",
            "NAM_SD",
            "MA_MAY",
            "SO_LUU_HANH",
            "HD_TU",
            "HD_DEN",
            "TU_NGAY",
            "DEN_NGAY",
            "MA_CSKCB"
        ]
    },

    // Thêm các mẫu khác cực kỳ đơn giản tại đây...
};

const ImportData = () => {
    const [selectedKey, setSelectedKey] = useState("MAU01");
    const [data, setData] = useState<any[]>([]);
    const [xmlPreview, setXmlPreview] = useState("");
    const [loadingExport, setLoadingExport] = useState(false);
    const [loadingSign, setLoadingSign] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Lấy cấu hình hiện tại dựa trên Combobox
    const currentConfig = useMemo(() => XML_CONFIGS[selectedKey], [selectedKey]);

    // Xử lý File Excel
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: "binary" });
            const ws = wb.Sheets[wb.SheetNames[0]];

            const headers = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as string[];
            const missing = currentConfig.columns.filter((col: string) => !headers.includes(col));

            if (missing.length > 0) {
                toast.error(`File thiếu cột: ${missing.join(", ")}`);

                // reset input
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }

                return;
            }

            const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
            setData(json);

            const previewDoc = buildXmlLogic(json, false);
            setXmlPreview(previewDoc.end({ prettyPrint: true }));

            // reset input để chọn lại file
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        };

        reader.readAsBinaryString(file);
    };

    // Hàm tạo XML dùng chung cho cả Export và Preview
    const buildXmlLogic = (inputData: any[], isSigning: boolean) => {
        const documentId = uuidv4();

        const rootName = currentConfig.rootWrapper || "HSDANHMUC";

        const rootAttrs = currentConfig.includeNamespace
            ? {
                "xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
                "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
            }
            : undefined;

        const root = create({ version: "1.0", encoding: "UTF-8" })
            .ele(rootName, rootAttrs);

        const listNode = root.ele(currentConfig.rootTag, {
            Id: `Id-${documentId}`,
        });

        inputData.forEach((item) => {
            const node = listNode.ele(currentConfig.itemTag);

            currentConfig.columns.forEach((col: string) => {
                node.ele(col).txt(String(item[col] ?? ""));
            });

            if (currentConfig.nested) {
                const { wrapper, item: subItemTag, columns, prefix } =
                    currentConfig.nested;

                const wrapperNode = node.ele(wrapper);
                const subNode = wrapperNode.ele(subItemTag);

                columns.forEach((col: string) => {
                    const excelKey = `${prefix}${col}`;
                    subNode.ele(col).txt(String(item[excelKey] ?? ""));
                });
            }
        });

        if (isSigning) {
            root.ele("CHUKYDONVI", { Id: `CHUKYDONVI-Id-${documentId}` });
        }

        return root;
    };

    const handleProcess = async (isSigning: boolean) => {
        if (data.length === 0) return toast.warning("Chưa có dữ liệu để xuất!");

        isSigning ? setLoadingSign(true) : setLoadingExport(true);
        try {
            const doc = buildXmlLogic(data, isSigning);
            let xmlString = doc.end({ prettyPrint: true });

            if (isSigning) {
                // Chờ kết quả từ Plugin ký số
                const signedXml = await (window as any).electronAPI.signXml(xmlString);

                // KIỂM TRA NẾU NGƯỜI DÙNG CANCEL (Hủy ký)
                if (!signedXml) {
                    toast.info("Đã hủy quá trình ký số.");
                    return; // Thoát hàm luôn, không chạy xuống phần lưu file và báo success
                }

                xmlString = signedXml;
                toast.success("Ký số thành công!");
            }

            // Chỉ khi ký thành công hoặc không chọn ký mới chạy đến đây
            const saveResult = await (window as any).electronAPI.saveFile({
                content: xmlString,
                fileName: currentConfig.fileName
            });

            // Kiểm tra xem lưu file có thành công không (nếu API có trả về success)
            if (saveResult?.success !== false) {
                toast.success("Đã lưu file thành công!");
            }

        } catch (err: any) {
            toast.error("Lỗi: " + err.message);
        } finally {
            isSigning ? setLoadingSign(false) : setLoadingExport(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 text-slate-800">

            {/* ================= HEADER ================= */}
            <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">

                    <div className="flex items-center justify-between gap-4">

                        {/* Logo / Title */}
                        <div className="flex items-center gap-4 min-w-0">

                            <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3F8A3E] to-[#2f6f2f] shadow-lg shadow-emerald-900/10">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="white"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <path d="M8 13h8" />
                                    <path d="M8 17h5" />
                                </svg>
                            </div>

                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 truncate">
                                        Chuyển File Excel sang XML
                                    </h1>

                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-[#3F8A3E]">
                                        <span className="h-1.5 w-1.5 rounded-full bg-[#3F8A3E] animate-pulse" />
                                        BHXH
                                    </span>

                                    <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                                        Ký số Token
                                    </span>
                                </div>

                                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                                    Tạo mẫu Excel · Chuyển đổi XML · Ký số bằng chứng thư/token
                                </p>
                            </div>
                        </div>

                        {/* Status */}
                        <div className="hidden md:flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="15"
                                    height="15"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="#3F8A3E"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M20 6 9 17l-5-5" />
                                </svg>
                            </div>

                            <div>
                                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                                    Trạng thái
                                </p>
                                <p className="text-xs font-bold text-emerald-700">
                                    Sẵn sàng xử lý
                                </p>
                            </div>
                        </div>

                    </div>
                </div>
            </header>


            {/* ================= MAIN ================= */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">


                {/* ================= STEP 1-2 ================= */}
                <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

                    {/* Section header */}
                    <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-white px-5 sm:px-6 py-5">

                        <div className="flex items-start gap-3">

                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-[#3F8A3E]">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="19"
                                    height="19"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M12 3v12" />
                                    <path d="m8 11 4 4 4-4" />
                                    <path d="M5 21h14" />
                                </svg>
                            </div>

                            <div>
                                <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                                    Chọn mẫu & nhập file Excel
                                </h2>

                                <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
                                    Chọn đúng loại hồ sơ trước khi chuyển đổi dữ liệu.
                                </p>
                            </div>

                        </div>
                    </div>


                    {/* Content */}
                    <div className="p-5 sm:p-6">

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* ================= LEFT ================= */}
                            <div className="lg:col-span-2 space-y-5">

                                {/* XML TYPE */}
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">

                                    <div className="flex items-center justify-between mb-3">
                                        <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-slate-200 text-[#3F8A3E]">
                                                01
                                            </span>
                                            Loại mẫu XML
                                        </label>

                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            Bắt buộc
                                        </span>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-3">

                                        <div className="relative flex-1">

                                            <select
                                                value={selectedKey}
                                                onChange={(e) => {
                                                    setSelectedKey(e.target.value);
                                                    setData([]);
                                                    setXmlPreview("");
                                                }}
                                                className="
                                                w-full appearance-none
                                                rounded-xl
                                                border border-slate-200
                                                bg-white
                                                px-4 py-3 pr-10
                                                text-sm font-semibold
                                                text-slate-700
                                                shadow-sm
                                                outline-none
                                                transition-all
                                                hover:border-slate-300
                                                focus:border-[#3F8A3E]
                                                focus:ring-4
                                                focus:ring-emerald-100
                                            "
                                            >
                                                {Object.keys(XML_CONFIGS).map(key => (
                                                    <option key={key} value={key}>
                                                        {XML_CONFIGS[key].label}
                                                    </option>
                                                ))}
                                            </select>

                                            <svg
                                                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="17"
                                                height="17"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="m6 9 6 6 6-6" />
                                            </svg>

                                        </div>


                                        {/* DOWNLOAD TEMPLATE */}
                                        <button
                                            onClick={() => {
                                                const cols = [
                                                    ...currentConfig.columns,
                                                    ...(currentConfig.nested
                                                        ? currentConfig.nested.columns.map(
                                                            (c: string) =>
                                                                currentConfig.nested.prefix + c
                                                        )
                                                        : [])
                                                ];

                                                (window as any).electronAPI.exportTemplateExcel(
                                                    cols,
                                                    currentConfig.fileName
                                                );
                                            }}
                                            className="
                                            inline-flex
                                            items-center
                                            justify-center
                                            gap-2
                                            rounded-xl
                                            border border-slate-200
                                            bg-white
                                            px-4 py-3
                                            text-sm
                                            font-bold
                                            text-slate-700
                                            shadow-sm
                                            transition-all
                                            hover:border-emerald-200
                                            hover:bg-emerald-50
                                            hover:text-[#3F8A3E]
                                            active:scale-[0.98]
                                        "
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="17"
                                                height="17"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M12 3v12" />
                                                <path d="m8 11 4 4 4-4" />
                                                <path d="M5 21h14" />
                                            </svg>

                                            Tải mẫu Excel
                                        </button>

                                    </div>
                                </div>


                                {/* FILE UPLOAD */}
                                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 transition-all hover:border-[#3F8A3E] hover:bg-emerald-50/20">

                                    <div className="flex items-center gap-3">

                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#3F8A3E]">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="21"
                                                height="21"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                <polyline points="17 8 12 3 7 8" />
                                                <line x1="12" y1="3" x2="12" y2="15" />
                                            </svg>
                                        </div>

                                        <div className="flex-1 min-w-0">

                                            <label className="block text-sm font-bold text-slate-800 mb-1">
                                                File Excel
                                            </label>

                                            <p className="text-xs text-slate-400 mb-3">
                                                Chọn file Excel chứa dữ liệu cần chuyển đổi
                                            </p>

                                            <input
                                                type="file"
                                                accept=".xlsx,.xls"
                                                onChange={handleFileUpload}
                                                ref={fileInputRef}
                                                className="
                                                block
                                                w-full
                                                text-xs
                                                text-slate-500
                                                file:mr-3
                                                file:rounded-lg
                                                file:border-0
                                                file:bg-emerald-50
                                                file:px-3
                                                file:py-2
                                                file:text-xs
                                                file:font-bold
                                                file:text-[#3F8A3E]
                                                hover:file:bg-emerald-100
                                                cursor-pointer
                                            "
                                            />

                                        </div>

                                    </div>
                                </div>


                                {/* INFO */}
                                <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3.5">

                                    <svg
                                        className="mt-0.5 shrink-0 text-blue-600"
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="17"
                                        height="17"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="16" x2="12" y2="12" />
                                        <line x1="12" y1="8" x2="12.01" y2="8" />
                                    </svg>

                                    <div>
                                        <p className="text-xs font-bold text-blue-800">
                                            Lưu ý
                                        </p>

                                        <p className="mt-0.5 text-[11px] leading-relaxed text-blue-700">
                                            Nên sử dụng đúng mẫu Excel được cung cấp để hạn chế
                                            lỗi khi chuyển đổi dữ liệu sang XML.
                                        </p>
                                    </div>

                                </div>

                            </div>


                            {/* ================= RIGHT ACTION ================= */}
                            <div className="lg:border-l lg:border-slate-200 lg:pl-6">

                                <div className="flex h-full flex-col justify-center">

                                    <div className="mb-4">
                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                            Thao tác
                                        </p>

                                        <h3 className="mt-1 text-base font-extrabold text-slate-900">
                                            Chuyển đổi hồ sơ
                                        </h3>

                                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                                            Chọn phương thức xử lý phù hợp với hồ sơ của bạn.
                                        </p>
                                    </div>


                                    {/* CONVERT */}
                                    <button
                                        onClick={() => handleProcess(false)}
                                        disabled={loadingExport}
                                        className="
                                        group
                                        relative
                                        mb-3
                                        w-full
                                        overflow-hidden
                                        rounded-2xl
                                        bg-gradient-to-r
                                        from-blue-600
                                        to-blue-700
                                        px-4
                                        py-3.5
                                        text-left
                                        text-white
                                        shadow-lg
                                        shadow-blue-600/15
                                        transition-all
                                        hover:-translate-y-0.5
                                        hover:shadow-xl
                                        hover:shadow-blue-600/20
                                        active:scale-[0.98]
                                        disabled:cursor-not-allowed
                                        disabled:opacity-50
                                    "
                                    >

                                        <div className="relative flex items-center gap-3">

                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                                                {loadingExport ? (
                                                    <svg
                                                        className="animate-spin"
                                                        width="19"
                                                        height="19"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                    >
                                                        <circle
                                                            cx="12"
                                                            cy="12"
                                                            r="9"
                                                            strokeOpacity=".3"
                                                        />
                                                        <path d="M21 12a9 9 0 0 1-9 9" />
                                                    </svg>
                                                ) : (
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        width="19"
                                                        height="19"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                        <polyline points="14 2 14 8 20 8" />
                                                        <path d="M8 13h8" />
                                                        <path d="M8 17h6" />
                                                    </svg>
                                                )}
                                            </div>

                                            <div className="min-w-0">
                                                <p className="text-sm font-extrabold">
                                                    {loadingExport
                                                        ? "Đang xử lý..."
                                                        : "Chuyển XML"}
                                                </p>

                                                <p className="mt-0.5 text-[10px] text-blue-100">
                                                    Tạo file XML từ dữ liệu Excel
                                                </p>
                                            </div>

                                            {!loadingExport && (
                                                <svg
                                                    className="ml-auto transition-transform group-hover:translate-x-1"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="18"
                                                    height="18"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="m9 18 6-6-6-6" />
                                                </svg>
                                            )}

                                        </div>
                                    </button>


                                    {/* CONVERT + SIGN */}
                                    <button
                                        onClick={() => handleProcess(true)}
                                        disabled={loadingSign}
                                        className="
                                        group
                                        relative
                                        w-full
                                        overflow-hidden
                                        rounded-2xl
                                        bg-gradient-to-r
                                        from-[#3F8A3E]
                                        to-[#347433]
                                        px-4
                                        py-3.5
                                        text-left
                                        text-white
                                        shadow-lg
                                        shadow-emerald-700/15
                                        transition-all
                                        hover:-translate-y-0.5
                                        hover:shadow-xl
                                        hover:shadow-emerald-700/20
                                        active:scale-[0.98]
                                        disabled:cursor-not-allowed
                                        disabled:opacity-50
                                    "
                                    >

                                        <div className="relative flex items-center gap-3">

                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">

                                                {loadingSign ? (
                                                    <svg
                                                        className="animate-spin"
                                                        width="19"
                                                        height="19"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                    >
                                                        <circle
                                                            cx="12"
                                                            cy="12"
                                                            r="9"
                                                            strokeOpacity=".3"
                                                        />
                                                        <path d="M21 12a9 9 0 0 1-9 9" />
                                                    </svg>
                                                ) : (
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        width="19"
                                                        height="19"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <rect
                                                            width="18"
                                                            height="11"
                                                            x="3"
                                                            y="11"
                                                            rx="2"
                                                        />
                                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                        <path d="M12 15v3" />
                                                    </svg>
                                                )}

                                            </div>

                                            <div className="min-w-0">
                                                <p className="text-sm font-extrabold">
                                                    {loadingSign
                                                        ? "Đang ký số..."
                                                        : "Chuyển XML + Ký số"}
                                                </p>

                                                <p className="mt-0.5 text-[10px] text-emerald-100">
                                                    Tạo XML và ký bằng Token
                                                </p>
                                            </div>

                                            {!loadingSign && (
                                                <svg
                                                    className="ml-auto transition-transform group-hover:translate-x-1"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="18"
                                                    height="18"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="m9 18 6-6-6-6" />
                                                </svg>
                                            )}

                                        </div>
                                    </button>


                                    {/* TOKEN STATUS */}
                                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">

                                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="#3F8A3E"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M20 13c0 5-3.5 7.5-8 8-4.5-.5-8-3-8-8V5l8-3 8 3v8Z" />
                                                <path d="m9 12 2 2 4-4" />
                                            </svg>
                                        </div>

                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">
                                                Bảo mật
                                            </p>

                                            <p className="text-[11px] font-semibold text-slate-700">
                                                Hỗ trợ ký số bằng Token
                                            </p>
                                        </div>

                                    </div>

                                </div>
                            </div>

                        </div>
                    </div>
                </section>


                {/* ================= XML PREVIEW ================= */}
                <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 sm:px-6 py-4">

                        <div className="flex items-center gap-3">

                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <polyline points="16 18 22 12 16 6" />
                                    <polyline points="8 6 2 12 8 18" />
                                </svg>
                            </div>

                            <div>
                                <h2 className="text-base font-extrabold text-slate-900">
                                    Kết quả XML
                                </h2>

                                <p className="text-xs text-slate-400">
                                    Xem trước nội dung XML sau khi chuyển đổi
                                </p>
                            </div>

                        </div>


                        {/* Status */}
                        <div
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold ${xmlPreview
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-slate-50 text-slate-400 border border-slate-200"
                                }`}
                        >
                            <span
                                className={`h-1.5 w-1.5 rounded-full ${xmlPreview
                                        ? "bg-emerald-500"
                                        : "bg-slate-300"
                                    }`}
                            />

                            {xmlPreview ? "Đã tạo XML" : "Chưa có dữ liệu"}
                        </div>

                    </div>


                    {/* Code editor */}
                    <div className="bg-[#0f172a] p-1">

                        <div className="flex items-center gap-1.5 border-b border-white/10 bg-[#111827] px-4 py-2.5">

                            <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
                            <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />

                            <span className="ml-3 text-[10px] font-mono text-slate-500">
                                preview.xml
                            </span>

                        </div>

                        <textarea
                            readOnly
                            value={xmlPreview}
                            placeholder="Kết quả XML sẽ hiển thị tại đây..."
                            className="
                            w-full
                            h-[420px]
                            resize-none
                            bg-[#0f172a]
                            p-4
                            font-mono
                            text-[12px]
                            leading-relaxed
                            text-emerald-300
                            outline-none
                            placeholder:text-slate-600
                            scrollbar-thin
                            scrollbar-thumb-slate-700
                            scrollbar-track-transparent
                        "
                        />

                    </div>

                    {/* Bottom info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3">

                        <div className="flex items-center gap-2 text-[11px] text-slate-500">

                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>

                            <span>
                                Nội dung chỉ dùng để xem trước, không thể chỉnh sửa trực tiếp.
                            </span>

                        </div>

                        <span className="font-mono text-[10px] text-slate-400">
                            XML Preview
                        </span>

                    </div>

                </section>


                {/* ================= FOOTER ================= */}
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

            </main>
        </div>
    );
};

export default ImportData;