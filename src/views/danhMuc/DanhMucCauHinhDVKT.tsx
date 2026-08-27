import { useEffect, useState } from "react";
import { Label, TextInput, Button, Radio } from "flowbite-react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTableNoCheckbox } from "../trangChu/BangHienThiKhongCheckbox";
import { AlertTriangle, CheckCircle2, Layers, ShieldCheck, Users, Clock3, Wrench, UploadCloud, DownloadCloud, RefreshCcw, PlusCircle, Save } from "lucide-react";
import * as XLSX from "xlsx";
import ImportResultModal from "../../components/dashboard/ImportResultModal";

const FILE_NAME = "CauHinhDichVu";

export interface CauHinhDichVu {
    id: number;
    maDvkt: string;
    tenDvkt: string;
    chongChiDinhMaBenh: string;
    buocChiDinhMaBenh: string;
    chongChiDinhDVKT: string;
    checkMaMay: number;
    checkTrungEkip: number; // 👈 thêm
    soPhutGoiGio: number; // 👈 thêm
    gioiTinh: string; // 👈 thêm
    tuoiMax: number; // 👈 thêm
    tuoiMin: number; // 👈 thêm
    soLuotThucHien: number,
    chucDanh: string;
    pvcm: string;
}
export default function CauHinhDichVuForm() {
    const [formData, setFormData] = useState<CauHinhDichVu>({
        id: 0,
        maDvkt: "",
        tenDvkt: "",
        chongChiDinhMaBenh: "",
        buocChiDinhMaBenh: "",
        chongChiDinhDVKT: "",
        checkMaMay: 0,
        checkTrungEkip: 0,
        soPhutGoiGio: 0,
        gioiTinh: "Tất cả",
        tuoiMax: 100,
        tuoiMin: 0,
        soLuotThucHien: 0,
        chucDanh: "",
        pvcm: "",
    });

    const [data, setData] = useState<CauHinhDichVu[]>([]);
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
                icon: <CheckCircle2 color="#108ee9" size={24} />,
            });
            loadJson();
        };

        const errorHandler = (err: string) => {
            api?.open({
                message: "Lỗi khi lưu file",
                description: `${err}`,
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
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleEdit = (item: CauHinhDichVu) => {
        setFormData(item);
        setSelectedId(item.id);
    };

    const handleSubmit = () => {
        if (!formData.maDvkt.trim()) {
            alert("Vui lòng nhập Mã DVKT!");
            return;
        }

        const payload: CauHinhDichVu = {
            ...formData,
            id: selectedId ?? new Date().getTime(),
            checkMaMay: Number(formData.checkMaMay),
            chucDanh: formData.chucDanh,
        };

        const newData = selectedId
            ? data.map((d) => (d.id === selectedId ? payload : d))
            : [...data, payload];

        setData(newData);
        window.electronAPI.saveJson(FILE_NAME, newData);
        resetForm();
    };

    const handleDelete = (id: number) => {
        if (!window.confirm("Bạn có chắc muốn xóa mục này?")) return;
        const newData = data.filter((d) => d.id !== id);
        setData(newData);
        window.electronAPI.saveJson(FILE_NAME, newData);
        resetForm();
    };

    const resetForm = () => {
        setFormData({
            id: 0,
            maDvkt: "",
            tenDvkt: "",
            chongChiDinhMaBenh: "",
            buocChiDinhMaBenh: "",
            chongChiDinhDVKT: "",
            checkMaMay: 0,
            soPhutGoiGio: 0,
            chucDanh: "",
            gioiTinh: "Tất cả",
            tuoiMax: 100,
            tuoiMin: 0,
            soLuotThucHien: 0,
            checkTrungEkip: 0,
            pvcm: "",
        });
        setSelectedId(null);
    };

    const REQUIRED_COLUMNS = [
        "ID",
        "Mã DVKT",
        "Tên DVKT",
        "Chống chỉ định Mã bệnh",
        "Buộc chỉ định Mã bệnh",
        "Chống chỉ định DVKT",
        "Kiểm tra trùng ekip",
        "Kiểm tra máy làm",
        "Số phút gối giờ",
        "Số lượt thực hiện",
        "Giới tính",
        "Tuổi tối thiểu",
        "Tuổi tối đa",
        "Chức danh",
        "PVCM",
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
                    maDvkt: row["Mã DVKT"]?.toString().trim() || "",
                    tenDvkt: row["Tên DVKT"] || "",
                    chongChiDinhMaBenh: row["Chống chỉ định Mã bệnh"] || "",
                    buocChiDinhMaBenh: row["Buộc chỉ định Mã bệnh"] || "",
                    chongChiDinhDVKT: row["Chống chỉ định DVKT"] || "",
                    checkMaMay: Number(row["Kiểm tra máy làm"]) || 0,
                    checkTrungEkip: Number(row["Kiểm tra trùng ekip"]) || 0,
                    soPhutGoiGio: Number(row["Số phút gối giờ"]) || 0,
                    soLuotThucHien: Number(row["Số lượt thực hiện"]) || 0,
                    gioiTinh: row["Giới tính"]?.toString() || "Tất cả",
                    tuoiMin: Number(row["Tuổi tối thiểu"]) || 0,
                    tuoiMax: Number(row["Tuổi tối đa"]) || 100,
                    chucDanh: row["Chức danh"]?.toString() || "",
                    pvcm: row["PVCM"] || "",
                }))
                // 🔥 bỏ dòng không có mã DVKT
                .filter((item) => item.maDvkt !== "");

            const existingMaDvkt = new Set(data.map((d) => d.maDvkt.trim()));
            const fileMaDvkt = new Set<string>();

            const duplicateList: string[] = [];
            const newList: any[] = [];

            mappedData.forEach((item) => {
                if (existingMaDvkt.has(item.maDvkt) || fileMaDvkt.has(item.maDvkt)) {
                    duplicateList.push(item.maDvkt);
                } else {
                    fileMaDvkt.add(item.maDvkt);
                    newList.push(item);
                }
            });

            // chỉ lưu khi có dữ liệu mới
            if (newList.length > 0) {
                const finalData = [...data, ...newList];
                setData(finalData);
                window.electronAPI.saveJson(FILE_NAME, finalData);
            }

            // luôn hiển thị kết quả
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

    const handleExportCurrent = async () => {
        if (!data || data.length === 0) {
            alert('Không có dữ liệu để xuất.');
            return;
        }

        try {
            await window.electronAPI.exportExcel({
                [FILE_NAME]: data,
            }, FILE_NAME);
        } catch (err) {
            console.error('Lỗi xuất danh mục hiện có:', err);
        }
    };

    const chucDanhOptions = [
        { value: 0, label: "Không chọn" },
        { value: 1, label: "Bác sĩ" },
        { value: 2, label: "Y sĩ" },
        { value: 3, label: "Điều dưỡng" },
        { value: 4, label: "Hộ sinh" },
        { value: 5, label: "Kỹ thuật viên" },
        { value: 6, label: "Cử nhân X-quang" },
        { value: 7, label: "Dược sĩ đại học" },
        { value: 8, label: "Dược sĩ trung cấp" },
        { value: 9, label: "Lương y" },
        { value: 10, label: "Cử nhân xét nghiệm" },
    ];

    const columns: ColumnDef<CauHinhDichVu>[] = [
        { header: "Mã DVKT", accessorKey: "maDvkt" },
        { header: "Tên DVKT", accessorKey: "tenDvkt" },
        { header: "Chống chỉ định (mã bệnh)", accessorKey: "chongChiDinhMaBenh" },
        { header: "Buộc chỉ định (mã bệnh)", accessorKey: "buocChiDinhMaBenh" },
        { header: "Chống chỉ định (DVKT)", accessorKey: "chongChiDinhDVKT" },
        { header: "Check máy", accessorKey: "checkMaMay" },
        { header: "Check trùng ekip", accessorKey: "checkTrungEkip" },
        { header: "Số phút gối giờ", accessorKey: "soPhutGoiGio" },
        { header: "Số lượt thực hiện", accessorKey: "soLuotThucHien" },
        { header: "Giới tính", accessorKey: "gioiTinh" },
        { header: "Tuổi tối thiểu", accessorKey: "tuoiMin" },
        { header: "Tuổi tối đa", accessorKey: "tuoiMax" },
        { header: "Chức danh", accessorKey: "chucDanh" },
        { header: "PVCM", accessorKey: "pvcm" },
        {
            header: "Hành động",
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="flex gap-2">
                        <Button size="xs" color="warning" onClick={() => handleEdit(item)}>
                            Sửa
                        </Button>
                        <Button size="xs" color="failure" onClick={() => handleDelete(item.id)}>
                            Xóa
                        </Button>
                    </div>
                );
            },
        },
    ];

    return (
        <>
            <div className="rounded-xl shadow-md bg-white dark:bg-darkgray p-6 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                    <div>
                        <div className="inline-flex items-center gap-2 text-slate-900 font-semibold text-lg">
                            <Layers size={20} />
                            Cấu hình Dịch vụ – Thông tin chi tiết
                        </div>
                        <p className="text-sm text-slate-500 mt-2">Thiết lập điều kiện áp dụng dịch vụ kỹ thuật theo bệnh, tuổi, giới tính và ekip.</p>
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-6">
                    {/* Cột trái */}
                    <div className="col-span-12 lg:col-span-6 space-y-6 bg-slate-50 border border-slate-200 p-5 rounded-3xl shadow-sm">

                        {/* Mã + Tên DVKT */}
                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-12 md:col-span-5">
                                <Label className="mb-2 block" htmlFor="maDvkt" value="Mã DVKT (bắt buộc)" />
                                <TextInput
                                    id="maDvkt"
                                    name="maDvkt"
                                    required
                                    value={formData.maDvkt}
                                    onChange={handleChange}
                                    className="form-control form-rounded-xl"
                                />
                            </div>

                            <div className="col-span-12 md:col-span-7">
                                <Label className="mb-2 block" htmlFor="tenDvkt" value="Tên DVKT" />
                                <TextInput
                                    id="tenDvkt"
                                    name="tenDvkt"
                                    value={formData.tenDvkt}
                                    onChange={handleChange}
                                    className="form-control form-rounded-xl"
                                />
                            </div>
                        </div>

                        <div>
                            <Label
                                className="mb-2 block"
                                htmlFor="chongChiDinhMaBenh"
                                value="Chống chỉ định mã bệnh (ngăn cách bằng ;)"
                            />
                            <TextInput
                                id="chongChiDinhMaBenh"
                                name="chongChiDinhMaBenh"
                                value={formData.chongChiDinhMaBenh}
                                onChange={handleChange}
                                className="form-control form-rounded-xl"
                            />
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-2 text-slate-700 font-semibold">
                                <ShieldCheck size={16} />
                                <span>Điều kiện mã bệnh</span>
                            </div>
                            <Label
                                className="mb-2 block"
                                htmlFor="buocChiDinhMaBenh"
                                value="Buộc chỉ định mã bệnh (ngăn cách bằng ;)"
                            />
                            <TextInput
                                id="buocChiDinhMaBenh"
                                name="buocChiDinhMaBenh"
                                value={formData.buocChiDinhMaBenh}
                                onChange={handleChange}
                                className="form-control form-rounded-xl"
                            />
                        </div>
                        <div>
                            <Label
                                className="mb-2 block"
                                htmlFor="chongChiDinhDVKT"
                                value="Chống chỉ định DVKT (ngăn cách bằng ;)"
                            />
                            <TextInput
                                id="chongChiDinhDVKT"
                                name="chongChiDinhDVKT"
                                value={formData.chongChiDinhDVKT}
                                onChange={handleChange}
                                className="form-control form-rounded-xl"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {/* Tuổi tối thiểu */}
                            <div>
                                <Label className="mb-2 block" htmlFor="tuoiMin" value="Tuổi tối thiểu" />
                                <TextInput
                                    type="number"
                                    id="tuoiMin"
                                    name="tuoiMin"
                                    value={formData.tuoiMin ?? ""}
                                    onChange={handleChange}
                                    placeholder="0"
                                    className="form-control form-rounded-xl w-full"
                                />
                            </div>

                            {/* Tuổi tối đa */}
                            <div>
                                <Label className="mb-2 block" htmlFor="tuoiMax" value="Tuổi tối đa" />
                                <TextInput
                                    type="number"
                                    id="tuoiMax"
                                    name="tuoiMax"
                                    value={formData.tuoiMax ?? ""}
                                    onChange={handleChange}
                                    placeholder="150"
                                    className="form-control form-rounded-xl w-full"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-2 text-slate-700 font-semibold">
                                <Clock3 size={16} />
                                <span>Số phút gối giờ</span>
                            </div>
                            <TextInput
                                id="soPhutGoiGio"
                                name="soPhutGoiGio"
                                value={formData.soPhutGoiGio}
                                onChange={handleChange}
                                className="form-control form-rounded-xl"
                            />
                        </div>
                    </div>

                    {/* Cột phải */}
                    <div className="col-span-12 lg:col-span-6 space-y-6 bg-slate-50 border border-slate-200 p-5 rounded-3xl shadow-sm">

                        {/* Kiểm tra mã máy */}
                        <div>
                            <div className="flex items-center gap-2 mb-3 text-slate-700 font-semibold">
                                <Wrench size={16} />
                                <span>Quy tắc kiểm tra</span>
                            </div>
                            <Label className="mb-3 block" value="Kiểm tra Mã máy" />
                            <div className="flex flex-wrap gap-6">
                                <label className="flex items-center gap-2 text-dark">
                                    <Radio
                                        name="checkMaMay"
                                        value="1"
                                        checked={formData.checkMaMay === 1}
                                        onChange={() => setFormData({ ...formData, checkMaMay: 1 })}
                                    />
                                    Có kiểm tra mã máy
                                </label>

                                <label className="flex items-center gap-2 text-dark">
                                    <Radio
                                        name="checkMaMay"
                                        value="0"
                                        checked={formData.checkMaMay === 0}
                                        onChange={() => setFormData({ ...formData, checkMaMay: 0 })}
                                    />
                                    Không kiểm tra mã máy
                                </label>
                            </div>
                        </div>

                        <div>
                            <Label className="mb-3 block" value="Kiểm tra trùng ekip" />
                            <div className="flex flex-wrap gap-6">
                                <label className="flex items-center gap-2 text-dark">
                                    <Radio
                                        name="checkTrungEkip"
                                        value="1"
                                        checked={formData.checkTrungEkip === 1}
                                        onChange={() => setFormData({ ...formData, checkTrungEkip: 1 })}
                                    />
                                    Có kiểm tra trùng ekip
                                </label>

                                <label className="flex items-center gap-2 text-dark">
                                    <Radio
                                        name="checkTrungEkip"
                                        value="0"
                                        checked={formData.checkTrungEkip === 0}
                                        onChange={() => setFormData({ ...formData, checkTrungEkip: 0 })}
                                    />
                                    Không kiểm tra
                                </label>
                            </div>
                        </div>
                        <div>
                            <Label className="mb-3 block" value="Số lượt thực hiện" />
                            <div className="flex flex-wrap gap-6">
                                <label className="flex items-center gap-2 text-dark cursor-pointer">
                                    <Radio
                                        name="soLuotThucHien"
                                        value="1"
                                        checked={formData.soLuotThucHien === 1}
                                        onChange={() => setFormData({ ...formData, soLuotThucHien: 1 })}
                                    />
                                    Không quá 1 lượt/Ngày
                                </label>

                                <label className="flex items-center gap-2 text-dark cursor-pointer">
                                    <Radio
                                        name="soLuotThucHien"
                                        value="0"
                                        checked={formData.soLuotThucHien === 0}
                                        onChange={() => setFormData({ ...formData, soLuotThucHien: 0 })}
                                    />
                                    Kê thoải mái
                                </label>
                            </div>
                        </div>
                        <div className="col-span-12">
                            <div className="flex items-center gap-2 mb-3 text-slate-700 font-semibold">
                                <Users size={16} />
                                <span>Tiêu chí áp dụng</span>
                            </div>
                            <Label className="mb-3 block" value="Giới tính áp dụng" />
                            <div className="flex flex-wrap gap-6">
                                {["Tất cả", "Nam", "Nữ"].map((gioiTinh) => (
                                    <label key={gioiTinh} className="flex items-center gap-2 text-dark cursor-pointer">
                                        <Radio
                                            name="gioiTinh"
                                            value={gioiTinh}
                                            checked={formData.gioiTinh === gioiTinh}
                                            onChange={() => setFormData({ ...formData, gioiTinh })}
                                        />
                                        {gioiTinh}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Chức danh */}
                        <div>
                            <Label className="mb-2 block" value="Chức danh nghề nghiệp" />

                            <div className="grid grid-cols-2 gap-2">
                                {chucDanhOptions
                                    .filter(opt => opt.value > 0) // bỏ "Không chọn"
                                    .map(opt => {
                                        const selectedValues = formData.chucDanh
                                            ? formData.chucDanh.split(";")
                                            : [];

                                        return (
                                            <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-dark">
                                                <input
                                                    type="checkbox"
                                                    value={opt.value}
                                                    checked={selectedValues.includes(String(opt.value))}
                                                    onChange={(e) => {
                                                        let newValues = [...selectedValues];

                                                        if (e.target.checked) {
                                                            newValues.push(String(opt.value));
                                                        } else {
                                                            newValues = newValues.filter(v => v !== String(opt.value));
                                                        }

                                                        setFormData(prev => ({
                                                            ...prev,
                                                            chucDanh: newValues.join(";")
                                                        }));
                                                    }}
                                                />
                                                {opt.label}
                                            </label>
                                        );
                                    })}
                            </div>
                        </div>

                        {/* PVCM */}
                        <div>
                            <Label
                                className="mb-2 block"
                                htmlFor="pvcm"
                                value="PVCM được phép thực hiện (ngăn cách bằng ;)"
                            />
                            <TextInput
                                id="pvcm"
                                name="pvcm"
                                value={formData.pvcm}
                                onChange={handleChange}
                                className="form-control form-rounded-xl"
                            />
                        </div>

                        {/* Kiểm tra trùng ekip */}


                    </div>
                </div>

                {/* Hàng nút bấm */}
                <div className="col-span-12 flex flex-wrap justify-between items-center mt-6">
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
                            onClick={resetForm}
                        >
                            <RefreshCcw size={16} className="mr-2" />
                            {selectedId ? "Hủy chỉnh sửa" : "Xóa Form"}
                        </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline"
                            onClick={handleExportTemplate}
                        >
                            <DownloadCloud size={16} />
                            Lấy file Excel mẫu
                        </button>
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 text-green-600 hover:text-green-800 hover:underline"
                            onClick={handleExportCurrent}
                        >
                            <DownloadCloud size={16} />
                            Xuất danh mục hiện có
                        </button>
                    </div>
                </div>
            </div>

            <div className="pt-8">
                <h2 className="text-xl font-semibold mb-4">Danh sách cấu hình dịch vụ</h2>
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
