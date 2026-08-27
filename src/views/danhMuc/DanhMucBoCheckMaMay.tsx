import { useEffect, useState } from "react";
import { Button, Label, TextInput } from "flowbite-react";
import { DataTableNoCheckbox } from "../trangChu/BangHienThiKhongCheckbox";
import { DanhMucDVKT } from "./DanhMucDVKT";
import * as XLSX from "xlsx";

interface MaMayRow {
    id: string;
    maMay: string;
    tenDvkt?: string; // thêm field tên
}

const FILE_NAME = "DanhMucBoCheckMaMay";
const FILE_DVKT = "FileDichVuBV";

const UploadMaMayBoCheck = () => {
    const [data, setData] = useState<MaMayRow[]>([]);
    const [formValue, setFormValue] = useState<string>("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [dvktMap, setDvktMap] = useState<Record<string, string>>({}); // ma -> tên

    useEffect(() => {
        const init = async () => {
            setLoading(true);

            // 1. Load DVKT trước
            const jsonDvkt = await window.electronAPI.readJsonFile(`${FILE_DVKT}.json`);
            const map: Record<string, string> = {};
            if (jsonDvkt && Array.isArray(jsonDvkt)) {
                (jsonDvkt as DanhMucDVKT[]).forEach((item) => {
                    map[item.MA_TUONG_DUONG] =
                        item.TEN_DVKT_PHEDUYET || item.TEN_DVKT_GIA || "";
                });
            }
            setDvktMap(map);

            // 2. Sau đó load danh sách bỏ check
            const jsonFile = await window.electronAPI.readJsonFile(`${FILE_NAME}.json`);
            if (jsonFile && jsonFile.list) {
                setData(
                    jsonFile.list.map((m: string, idx: number) => ({
                        id: String(idx),
                        maMay: m,
                        tenDvkt: map[m] || "Không tìm thấy",
                    }))
                );
            }

            setLoading(false);
        };

        init();
    }, []);

    const handleSubmit = () => {
        if (!formValue.trim()) return;

        const maMays = formValue
            .split(";")
            .map((s) => s.trim())
            .filter((s) => s);

        let newData: MaMayRow[] = [...data];

        if (selectedId) {
            // Sửa 1 dòng
            newData = newData.map((row) =>
                row.id === selectedId
                    ? {
                        ...row,
                        maMay: maMays[0] || row.maMay,
                        tenDvkt: dvktMap[maMays[0]] || row.tenDvkt,
                    }
                    : row
            );
        } else {
            // Thêm mới nhiều mã
            const added = maMays.map((m) => ({
                id: Date.now() + "-" + m,
                maMay: m,
                tenDvkt: dvktMap[m] || "",
            }));
            newData = [...newData, ...added];
        }

        setData(newData);
        saveJson(newData);
        setFormValue("");
        setSelectedId(null);
    };

    const handleEdit = (row: MaMayRow) => {
        setFormValue(row.maMay);
        setSelectedId(row.id);
    };

    const handleDelete = (row: MaMayRow) => {
        const newData = data.filter((d) => d.id !== row.id);
        setData(newData);
        saveJson(newData);
    };

    // --- Import Excel ---
    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            if (!bstr) return;

            const wb = XLSX.read(bstr, { type: "binary" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

            // Lấy cột đầu tiên (mã DVKT)
            const maMays: string[] = rows
                .map((r) => r[0])
                .filter((v) => typeof v === "string" && v.trim() !== "");

            const newData: MaMayRow[] = maMays.map((m, idx) => ({
                id: Date.now() + "-" + idx,
                maMay: m,
                tenDvkt: dvktMap[m] || "Không tìm thấy",
            }));

            setData(newData);
            saveJson(newData);
        };
        reader.readAsBinaryString(file);
    };

    const saveJson = (rows: MaMayRow[]) => {
        window.electronAPI.saveJson(FILE_NAME, { list: rows.map((r) => r.maMay) });
    };

    const handleExportTemplate = () => {
        const worksheet = XLSX.utils.aoa_to_sheet([["MA_MAY", "Tên DVKT (Không bắt buộc)"]]);

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Template");

        XLSX.writeFile(workbook, `${FILE_NAME}.xlsx`);
    };

    const columns = [
        {
            accessorKey: "maMay",
            header: "Mã DVKT",
            cell: (info: any) => info.getValue(),
        },
        {
            accessorKey: "tenDvkt",
            header: "Tên DVKT",
            cell: (info: any) => info.getValue() || "Không tìm thấy",
        },
        {
            accessorKey: "actions",
            header: "Hành động",
            cell: ({ row }: any) => {
                const record = row.original as MaMayRow;
                return (
                    <div className="flex gap-2">
                        <Button color="info" size="xs" onClick={() => handleEdit(record)}>
                            Sửa
                        </Button>
                        <Button color="failure" size="xs" onClick={() => handleDelete(record)}>
                            Xóa
                        </Button>
                    </div>
                );
            },
        },
    ];

    return (
        <>
            <div className="rounded-xl shadow-md bg-white dark:bg-darkgray p-6 relative w-full">
                <h5 className="font-semibold text-lg">Danh mục DVKT bỏ kiểm tra MA_MAY</h5>
                <div className="mt-6 grid grid-cols-12 gap-6">
                    <div className="col-span-12">
                        <Label htmlFor="maMay" value="Mã DVKT (cách nhau ;)" className="mb-2 block" />
                        <div className="flex gap-2">
                            <TextInput
                                id="maMay"
                                type="text"
                                placeholder="Ví dụ: 02.1899; 10.9005.0219"
                                value={formValue}
                                onChange={(e) => setFormValue(e.target.value)}
                                className="flex-1"
                            />
                            {selectedId ? (
                                <Button color="primary" onClick={handleSubmit}>
                                    Lưu
                                </Button>
                            ) : (
                                <Button color="primary" onClick={handleSubmit}>
                                    Thêm mới
                                </Button>
                            )}
                            <label className="cursor-pointer">
                                <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    className="hidden"
                                    onChange={handleImportExcel}
                                />
                                <Button color="primary" as="span">
                                    Import Excel
                                </Button>
                            </label>
                            <Button
                                color="gray"
                                onClick={() => {
                                    setFormValue("");
                                    setSelectedId(null);
                                }}
                            >
                                {selectedId ? "Hủy chỉnh sửa" : "Xóa form"}
                            </Button>
                        </div>

                    </div>
                    <div
                        className="text-blue-600 cursor-pointer hover:underline"
                        onClick={handleExportTemplate}
                    >
                        Lấy file Excel mẫu
                    </div>
                </div>
            </div>

            <div className="pt-5">
                {loading ? (
                    <div>Đang tải dữ liệu...</div>
                ) : (
                    <DataTableNoCheckbox columns={columns} data={data} />
                )}
            </div>
        </>
    );
};

export default UploadMaMayBoCheck;

