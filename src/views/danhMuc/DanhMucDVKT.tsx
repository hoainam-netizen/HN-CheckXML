import { useEffect, useMemo, useState } from "react";
import { Button, FileInput } from "flowbite-react";
import { ColumnDef } from "@tanstack/react-table";
import * as XLSX from "xlsx";
import { DataTableNoCheckbox } from "../trangChu/BangHienThiKhongCheckbox";
import { notification } from "antd";
import { Icon } from "@iconify/react/dist/iconify.js";

export interface DanhMucDVKT {
  STT: number;
  MA_TUONG_DUONG: string;
  TEN_DVKT_PHEDUYET: string;
  TEN_DVKT_GIA: string;
  PHAN_LOAI_PTTT: string;
  DON_GIA: number;
  GHICHU: string;
  QUYET_DINH: string;
  TUNGAY: string;
  DENNGAY: string;
  ID: string;
}

const UploadProcedures = () => {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [api, contextHolder] = notification.useNotification();

  const FILE_NAME = "FileDichVuBV";
  const EXCEL_FILE_NAME = `${FILE_NAME}.xlsx`;

  useEffect(() => {
    // Load dữ liệu 1 lần khi mount
    loadJson();

    // Chỉ đăng ký 1 listener duy nhất
    const successHandler = () => {
      api.open({
        message: 'Cập nhật Danh Mục DVKT',
        description: `Cập nhật Danh Mục DVKT thành công!`,
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

    // Cleanup khi component unmount
    return () => {
      window.electronAPI.removeSaveJsonSuccess(successHandler);
      window.electronAPI.removeSaveJsonError(errorHandler);
    };
  }, []);



  const loadJson = async () => {
    const jsonFile = await window.electronAPI.readJsonFile(`${FILE_NAME}.json`);
    if (jsonFile) setData(jsonFile);
  };

  const REQUIRED_COLUMNS = [
    "STT",
    "MA_TUONG_DUONG",
    "TEN_DVKT_PHEDUYET",
    "TEN_DVKT_GIA",
    "PHAN_LOAI_PTTT",
    "DON_GIA",
    "GHICHU",
    "QUYET_DINH",
    "TUNGAY",
    "DENNGAY",
    "ID",
  ];

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

      // Lấy tên các cột
      const headers: string[] = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[];

      // Kiểm tra các cột bắt buộc
      const missingColumns = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
      if (missingColumns.length > 0) {
        alert(`File Excel thiếu cột bắt buộc:\n${missingColumns.join(", ")}`);
        return;
      }

      // Chuyển dữ liệu sang JSON
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      // Lưu JSON qua Electron API
      window.electronAPI.saveJson("FileDichVuBV", jsonData);
    };

    reader.readAsArrayBuffer(file);
  };


  const columns: ColumnDef<Record<string, string>>[] = useMemo(() => {
    if (data.length === 0) return [];
    return Object.keys(data[0])
      .map((key) => ({
        accessorKey: key,
        header: key.toUpperCase(),
        cell: (info) => String(info.getValue() || ""),
      }));
  }, [data]);

  return (
    <>
      {contextHolder}
      <div className="p-4">
        <h2 className="text-lg font-bold mb-4">Danh Mục DVKT tại CSKCB</h2>

        <div className="flex items-center gap-4 mb-4 w-full">
          <div className="flex-1">
            <FileInput
              className="w-full"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setFile(f);
              }}
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

export default UploadProcedures;
