import { useEffect, useMemo, useState } from "react";
import { Button, FileInput } from "flowbite-react";
import { ColumnDef } from "@tanstack/react-table";
import * as XLSX from "xlsx";
import { DataTableNoCheckbox } from "../trangChu/BangHienThiKhongCheckbox";
import { notification } from "antd";
import { Icon } from "@iconify/react/dist/iconify.js";

export interface DanhMucThuoc {
    STT: number;
    MA_THUOC: string;
    TEN_HOAT_CHAT: string;
    TEN_THUOC: string;
    DON_VI_TINH: string;
    HAM_LUONG: string;
    DUONG_DUNG: string;
    MA_DUONG_DUNG: string;
    DANG_BAO_CHE: string;
    SO_DANG_KY: string;
    SO_LUONG: number;
    DON_GIA: number;
    DON_GIA_BH: number;
    QUY_CACH: string;
    NHA_SX: string;
    NUOC_SX: string;
    NHA_THAU: string;
    TT_THAU: string;
    TU_NGAY: string;
    DEN_NGAY: string;
    MA_CSKCB: string;
    LOAI_THUOC: string;
    LOAI_THAU: string;
    HT_THAU: string;
    MA_DVKT: string;
    TCCL: string;
    BO_PHAN_VT: string;
    TEN_KHOA_HOC: string;
    NGUON_GOC: string;
    PP_CHEBIEN: string;
    MA_DL_NHAP: string;
    MA_DL_CB: string;
    TLHH_CB: number;
    TLHH_BQ: number;
    DENNGAY: string;
    ID: string;
}

const UploadDrugs = () => {
    const [file, setFile] = useState<File | null>(null);
    const [data, setData] = useState<Record<string, string>[]>([]);
    const [api, contextHolder] = notification.useNotification();

    const FILE_NAME = "FileDanhMucThuoc";
    const EXCEL_FILE_NAME = `${FILE_NAME}.xlsx`;

    const REQUIRED_COLUMNS = [
        "STT", "MA_THUOC", "TEN_HOAT_CHAT", "TEN_THUOC", "DON_VI_TINH", "HAM_LUONG", "DUONG_DUNG",
        "MA_DUONG_DUNG", "DANG_BAO_CHE", "SO_DANG_KY", "SO_LUONG", "DON_GIA", "DON_GIA_BH", "QUY_CACH",
        "NHA_SX", "NUOC_SX", "NHA_THAU", "TT_THAU", "TU_NGAY", "DEN_NGAY", "MA_CSKCB", "LOAI_THUOC",
        "LOAI_THAU", "HT_THAU", "MA_DVKT", "TCCL", "BO_PHAN_VT", "TEN_KHOA_HOC", "NGUON_GOC", "PP_CHEBIEN",
        "MA_DL_NHAP", "MA_DL_CB", "TLHH_CB", "TLHH_BQ", "DENNGAY", "ID"
    ];

    useEffect(() => {
        loadJson();

        const successHandler = () => {
            api.open({
                message: 'Cập nhật Danh Mục Thuốc',
                description: `Cập nhật Danh Mục Thuốc thành công!`,
                showProgress: true,
                pauseOnHover: true,
                icon: <Icon icon="solar:check-circle-linear" color="#108ee9" height={24} />,
            });
            loadJson();
        };

        const errorHandler = (err: string) => {
            api.open({
                message: 'Lỗi khi lưu file',
                description: `${err}`,
                showProgress: true,
                pauseOnHover: true,
                icon: <Icon icon="mdi:alert-circle-outline" color="#ff4d4f" height={24} />,
            });
        };

        window.electronAPI.onSaveJsonSuccess(successHandler);
        window.electronAPI.onSaveJsonError(errorHandler);

        return () => {
            window.electronAPI.removeSaveJsonSuccess(successHandler);
            window.electronAPI.removeSaveJsonError(errorHandler);
        };
    }, []);

    const loadJson = async () => {
        const jsonFile = await window.electronAPI.readJsonFile(`${FILE_NAME}.json`);
        if (jsonFile) setData(jsonFile);
    };

    const handleUpload = () => {
        if (!file) {
            api.open({
                message: 'Chưa chọn file',
                description: 'Vui lòng chọn file Excel trước khi cập nhật.',
                icon: <Icon icon="mdi:alert-circle-outline" color="#ff4d4f" height={24} />,
            });
            return;
        }

        if (file.name !== EXCEL_FILE_NAME) {
            api.open({
                message: 'Sai tên file',
                description: `Vui lòng chọn file: ${EXCEL_FILE_NAME}`,
                icon: <Icon icon="mdi:alert-circle-outline" color="#ff4d4f" height={24} />,
            });
            return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            const dataArray = evt.target?.result;
            if (!dataArray) return;

            const workbook = XLSX.read(new Uint8Array(dataArray as ArrayBuffer), { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            const headers: string[] = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[];
            const missingColumns = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
            if (missingColumns.length > 0) {
                alert(`File Excel thiếu cột bắt buộc:\n${missingColumns.join(", ")}`);
                return;
            }

            const jsonData = XLSX.utils.sheet_to_json(sheet);
            window.electronAPI.saveJson(FILE_NAME, jsonData);
        };

        reader.readAsArrayBuffer(file);
    };

    const columns: ColumnDef<Record<string, string>>[] = useMemo(() => {
        if (data.length === 0) return [];
        return Object.keys(data[0]).map((key) => ({
            accessorKey: key,
            header: key.toUpperCase(),
            cell: (info) => String(info.getValue() || ""),
        }));
    }, [data]);

    return (
        <>
            {contextHolder}
            <div className="p-4">
                <h2 className="text-lg font-bold mb-4">Danh Mục Thuốc tại CSKCB</h2>

                <div className="flex items-center gap-4 mb-4 w-full">
                    <div className="flex-1">
                        <FileInput
                            className="w-full"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />
                    </div>

                    <Button className="w-full max-w-[150px]" color="primary" onClick={handleUpload}>
                        Cập nhật
                    </Button>
                </div>

                {data.length === 0 ? (
                    <div className="text-center p-4 text-gray-500">Không có dữ liệu</div>
                ) : (
                    <DataTableNoCheckbox columns={columns} data={data} />
                )}
            </div>
        </>
    );
};

export default UploadDrugs;
