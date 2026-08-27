import { useEffect, useState } from "react";
import { Label, TextInput, Button } from "flowbite-react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTableNoCheckbox } from "../trangChu/BangHienThiKhongCheckbox";
import { AlertTriangle, CheckCircle2, Layers, UploadCloud, DownloadCloud, RefreshCcw, Save, PlusCircle, Clock3, Users } from "lucide-react";
import * as XLSX from "xlsx";
import ImportResultModal from "../../components/dashboard/ImportResultModal";

const FILE_NAME = "ThoiGianThucHienDVKT";

export interface DanhMucThoiGianThucHienDVKT {
    id: number; // ID bản ghi
    maByt: string; // Mã BYT
    tenDvkt: string; // Tên DVKT
    thoiGianThucHienMin: number | null; // Thời gian thực hiện tối thiểu
    thoiGianThucHienMax: number | null; // Thời gian thực hiện tối đa
    hoanThanhTruocDvkt: string; // Mã DVKT phải hoàn thành trước
}

export default function ThoiGianThucHienDVKTForm() {
    const [formData, setFormData] = useState({
        maByt: "",
        tenDvkt: "",
        thoiGianThucHienMin: "",
        thoiGianThucHienMax: "",
        hoanThanhTruocDvkt: "",
    });

    const [data, setData] = useState<DanhMucThoiGianThucHienDVKT[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [api, setApi] = useState<any>(null);
    const [importResult, setImportResult] = useState<{
        success: number;
        duplicates: string[];
    } | null>(null);
    useEffect(() => {
        const notification = (window as any).notificationAPI;
        setApi(notification);

        loadJson();

        const successHandler = () => {
            api?.open({
                message: "Cập nhật dữ liệu",
                description: `Lưu file JSON thành công!`,
                showProgress: true,
                pauseOnHover: true,
                icon: <CheckCircle2 color="#108ee9" size={24} />,
            });
            loadJson();
        };

        const errorHandler = (err: string) => {
            api?.open({
                message: "Lỗi khi lưu file",
                description: `${err}`,
                showProgress: true,
                pauseOnHover: true,
                icon: <AlertTriangle color="#ff4d4f" size={24} />,
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
        setLoading(true);
        const jsonFile = await window.electronAPI.readJsonFile(`${FILE_NAME}.json`);
        if (jsonFile) setData(jsonFile);
        setLoading(false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleEdit = (item: DanhMucThoiGianThucHienDVKT) => {
        setFormData({
            maByt: item.maByt,
            tenDvkt: item.tenDvkt,
            thoiGianThucHienMin: item.thoiGianThucHienMin?.toString() || "",
            thoiGianThucHienMax: item.thoiGianThucHienMax?.toString() || "",
            hoanThanhTruocDvkt: item.hoanThanhTruocDvkt,
        });
        setSelectedId(item.id);
    };

    const handleSubmit = () => {
        if (!formData.maByt || formData.maByt.trim() === "") {
            alert("Vui lòng nhập Mã BYT!");
            return;
        }

        const payload: DanhMucThoiGianThucHienDVKT = {
            ...formData,
            thoiGianThucHienMin: formData.thoiGianThucHienMin
                ? parseInt(formData.thoiGianThucHienMin)
                : null,
            thoiGianThucHienMax: formData.thoiGianThucHienMax
                ? parseInt(formData.thoiGianThucHienMax)
                : null,
            id: selectedId ?? new Date().getTime(),
        };

        let newData: DanhMucThoiGianThucHienDVKT[];
        if (selectedId) {
            newData = data.map(d => d.id === selectedId ? payload : d);
        } else {
            newData = [...data, payload];
        }

        setData(newData);
        window.electronAPI.saveJson(FILE_NAME, newData);

        setFormData({
            maByt: "",
            tenDvkt: "",
            thoiGianThucHienMin: "",
            thoiGianThucHienMax: "",
            hoanThanhTruocDvkt: "",
        });
        setSelectedId(null);
    };

    const handleDelete = (id: number) => {
        if (!window.confirm("Bạn có chắc muốn xóa mục này?")) return;

        const newData = data.filter(d => d.id !== id);
        setData(newData);
        window.electronAPI.saveJson(FILE_NAME, newData);
        // Reset form để input có thể nhập lại
        setFormData({
            maByt: "",
            tenDvkt: "",
            thoiGianThucHienMin: "",
            thoiGianThucHienMax: "",
            hoanThanhTruocDvkt: "",
        });
        setSelectedId(null);
    };

    const REQUIRED_COLUMNS = [
        "ID",
        "Mã BYT",
        "Tên DVKT",
        "Thời gian thực hiện min",
        "Thời gian thực hiện max",
        "Hoàn thành trước DVKT",
    ];

    const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

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

            const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

            const mappedData = jsonData
                .map((row, idx) => ({
                    id: row["ID"] || Date.now() + idx,
                    maByt: row["Mã BYT"]?.toString().trim() || "",
                    tenDvkt: row["Tên DVKT"] || "",
                    thoiGianThucHienMin: row["Thời gian thực hiện min"]
                        ? Number(row["Thời gian thực hiện min"])
                        : null,
                    thoiGianThucHienMax: row["Thời gian thực hiện max"]
                        ? Number(row["Thời gian thực hiện max"])
                        : null,
                    hoanThanhTruocDvkt: row["Hoàn thành trước DVKT"] || "",
                }))
                // 🔥 bỏ dòng không có mã BYT
                .filter((item) => item.maByt !== "");

            const existingMaByt = new Set(data.map((d) => d.maByt.trim()));

            const duplicateList: string[] = [];
            const newList: any[] = [];

            mappedData.forEach((item) => {
                if (existingMaByt.has(item.maByt)) {
                    duplicateList.push(item.maByt);
                } else {
                    newList.push(item);
                }
            });

            // chỉ lưu khi có dữ liệu mới
            if (newList.length > 0) {
                const finalData = [...data, ...newList];
                setData(finalData);
                window.electronAPI.saveJson(FILE_NAME, finalData);
            }

            // 🔥 luôn hiển thị kết quả
            setImportResult({
                success: newList.length,
                duplicates: duplicateList,
            });
        };

        reader.readAsArrayBuffer(file);
        e.target.value = "";
    };

    const handleExportTemplate = async () => {
        const columns = REQUIRED_COLUMNS;

        await window.electronAPI.exportTemplateExcel(
            columns,
            FILE_NAME
        );
    };

    const columns: ColumnDef<DanhMucThoiGianThucHienDVKT>[] = [
        { header: "Mã BHYT", accessorKey: "maByt" },
        { header: "Tên DVKT", accessorKey: "tenDvkt" },
        { header: "Thời gian tối thiểu (Phút)", accessorKey: "thoiGianThucHienMin" },
        { header: "Thời gian tối đa (Phút)", accessorKey: "thoiGianThucHienMax" },
        { header: "Hoàn thành trước DVKT", accessorKey: "hoanThanhTruocDvkt" },
        {
            header: "Hành động",
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="flex gap-2">
                        <Button size="xs" color="warning" onClick={() => handleEdit(item)}>Sửa</Button>
                        <Button size="xs" color="failure" onClick={() => handleDelete(item.id)}>Xóa</Button>
                    </div>
                );
            },
        },
    ];


    return (
        <>
            <div className="rounded-3xl shadow-sm border border-slate-200 bg-white p-6 relative w-full break-words">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <Layers size={22} className="text-slate-700" />
                        <div>
                            <h5 className="font-semibold text-xl text-slate-900">Danh mục Thời gian thực hiện DVKT</h5>
                            <p className="text-sm text-slate-500">Thiết lập khoảng thời gian thực hiện dịch vụ kỹ thuật và điều kiện hoàn thành trước.</p>
                        </div>
                    </div>
                </div>
                <div className="mt-2">
                    <div className="grid grid-cols-12 gap-6">
                        {/* Left Column */}
                        <div className="lg:col-span-6 col-span-12">
                            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col gap-4">
                                <div className="inline-flex items-center gap-2 text-slate-700 font-semibold">
                                    <Clock3 size={16} />
                                    <span>Thông tin chính</span>
                                </div>
                                <div>
                                    <Label htmlFor="maByt" value="Mã DVKT (Bắt buộc)" className="mb-2 block" />
                                    <TextInput
                                        id="maByt"
                                        name="maByt"
                                        type="text"
                                        placeholder="Mã DVKT"
                                        required
                                        value={formData.maByt}
                                        onChange={handleChange}
                                        className="form-control form-rounded-xl"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="thoiGianThucHienMin" value="Thời gian thực hiện tối thiểu (Phút)" className="mb-2 block" />
                                    <TextInput
                                        id="thoiGianThucHienMin"
                                        name="thoiGianThucHienMin"
                                        type="number"
                                        placeholder="Bao nhiêu phút"
                                        value={formData.thoiGianThucHienMin}
                                        onChange={handleChange}
                                        className="form-control form-rounded-xl"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="hoanThanhTruocDvkt" value="Hoàn thành trước DVKT" className="mb-2 block" />
                                    <TextInput
                                        id="hoanThanhTruocDvkt"
                                        name="hoanThanhTruocDvkt"
                                        type="text"
                                        placeholder="Mã DVKT cách nhau bằng dấu (;)"
                                        required
                                        value={formData.hoanThanhTruocDvkt}
                                        onChange={handleChange}
                                        className="form-control form-rounded-xl"
                                    />
                                </div>

                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="lg:col-span-6 col-span-12">
                            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col gap-4">
                                <div className="inline-flex items-center gap-2 text-slate-700 font-semibold">
                                    <Users size={16} />
                                    <span>Thời gian & hoàn thành</span>
                                </div>
                                <div>
                                    <Label htmlFor="tenDvkt" value="Tên DVKT" className="mb-2 block" />
                                    <TextInput
                                        id="tenDvkt"
                                        name="tenDvkt"
                                        type="text"
                                        placeholder="VD: VD-12345-21"
                                        value={formData.tenDvkt}
                                        onChange={handleChange}
                                        className="form-control form-rounded-xl"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="thoiGianThucHienMax" value="Thời gian thực hiện tối đa (Phút)" className="mb-2 block" />
                                    <TextInput
                                        id="thoiGianThucHienMax"
                                        name="thoiGianThucHienMax"
                                        type="number"
                                        placeholder="Bao nhiêu phút"
                                        value={formData.thoiGianThucHienMax}
                                        onChange={handleChange}
                                        className="form-control form-rounded-xl"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Submit Buttons */}
                        <div className="col-span-12 flex flex-col lg:flex-row justify-between items-center mt-4 gap-3">
                            {/* Nhóm nút bên trái */}
                            <div className="flex flex-wrap gap-3">
                                {selectedId ? (
                                    <Button color="primary" onClick={handleSubmit}>
                                        <Save size={16} className="mr-2" />
                                        Lưu
                                    </Button>
                                ) : (
                                    <Button color="primary" onClick={handleSubmit}>
                                        <PlusCircle size={16} className="mr-2" />
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
                                        <UploadCloud size={16} className="mr-2" />
                                        Import Excel
                                    </Button>
                                </label>
                                <Button
                                    color="gray"
                                    onClick={() => {
                                        setFormData({
                                            maByt: "",
                                            tenDvkt: "",
                                            thoiGianThucHienMax: "",
                                            thoiGianThucHienMin: "",
                                            hoanThanhTruocDvkt: "",
                                        });
                                        setSelectedId(null); // Reset ID để thoát chế độ sửa
                                    }}
                                >
                                    <RefreshCcw size={16} className="mr-2" />
                                    {selectedId ? "Hủy chỉnh sửa" : "Xóa Form"}
                                </Button>
                            </div>

                            {/* Dòng chữ bên phải */}
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline"
                                onClick={handleExportTemplate}
                            >
                                <DownloadCloud size={16} />
                                Lấy file Excel mẫu
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="pt-5">
                <h2 className="text-xl font-semibold mb-4">Thời gian thực hiện DVKT</h2>
                {loading ? (
                    <div>Đang tải dữ liệu...</div>
                ) : (
                    <DataTableNoCheckbox columns={columns} data={data} />
                )}
            </div>
            {importResult && (
                <ImportResultModal
                    success={importResult.success}
                    duplicates={importResult.duplicates}
                    onClose={() => setImportResult(null)}
                />
            )}
        </>
    );
}
