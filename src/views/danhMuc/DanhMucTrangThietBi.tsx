import { useEffect, useMemo, useState } from "react";
import { Button, FileInput } from "flowbite-react";
import { ColumnDef } from "@tanstack/react-table";
import * as XLSX from "xlsx";
import { DataTableNoCheckbox } from "../trangChu/BangHienThiKhongCheckbox";
import { notification } from "antd";
import { Icon } from "@iconify/react/dist/iconify.js";

export interface DanhMucTrangThietBi {
  STT: number;
  TEN_TB: string;
  KY_HIEU: string;
  CONGTY_SX: string;
  NUOC_SX: string;
  NAM_SX: number;
  NAM_SD: number;
  MA_MAY: string;
  SO_LUU_HANH: string;
  HD_TU: string;
  HD_DEN: string;
  TU_NGAY: string;
  DEN_NGAY: string;
  ID: string;
}

const UploadEquipment = () => {
    const [file, setFile] = useState<File | null>(null);
    const [data, setData] = useState<Record<string, string>[]>([]);
    const [api, contextHolder] = notification.useNotification();

    const FILE_NAME = "FileTrangThietBi";
    const EXCEL_FILE_NAME = `${FILE_NAME}.xlsx`;

    const REQUIRED_COLUMNS = [
        "STT", "TEN_TB", "KY_HIEU", "CONGTY_SX", "NUOC_SX", "NAM_SX", "NAM_SD",
        "MA_MAY", "SO_LUU_HANH", "HD_TU", "HD_DEN", "TU_NGAY", "DEN_NGAY", "ID"
    ];

    useEffect(() => {
        loadJson();

        const successHandler = () => {
            api.open({
                message: 'Cập nhật Trang Thiết Bị',
                description: `Cập nhật File Trang Thiết Bị thành công!`,
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
                api.open({
                    message: 'Thiếu cột bắt buộc',
                    description: `File Excel thiếu cột: ${missingColumns.join(", ")}`,
                    icon: <Icon icon="mdi:alert-circle-outline" color="#ff4d4f" height={24} />,
                });
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
                <h2 className="text-lg font-bold mb-4">Danh Mục Trang Thiết Bị</h2>

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

export default UploadEquipment;
