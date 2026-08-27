import { useEffect, useState } from "react";
import { Label, TextInput, Select, Button } from "flowbite-react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTableNoCheckbox } from "../trangChu/BangHienThiKhongCheckbox";
import { AlertTriangle, CheckCircle2, Layers, ShieldCheck, Users, UploadCloud, DownloadCloud, RefreshCcw, Save, PlusCircle } from "lucide-react";
import * as XLSX from "xlsx";
import ImportResultModal from "../../components/dashboard/ImportResultModal";

const FILE_NAME = "DanhMucChongChiDinhThuoc";

export interface DanhMucChongChiDinhThuoc {
  id: number;
  maThuoc: string;
  tenThuoc: string;
  soDangKy: string;
  chongChiDinhMaBenh?: string;
  buocChiDinhMaBenh?: string;
  gioiTinh?: number;
  tuoiMin?: number;
  tuoiMax?: number;
}

export default function DrugContraindicationForm() {
  const [formData, setFormData] = useState({
    maThuoc: "",
    tenThuoc: "",
    soDangKy: "",
    chongChiDinhMaBenh: "",
    buocChiDinhMaBenh: "",
    gioiTinh: "",
    tuoiMin: "",
    tuoiMax: "",
  });

  const [data, setData] = useState<DanhMucChongChiDinhThuoc[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [api, setApi] = useState<any>(null); // notification api nếu dùng
  const [loading, setLoading] = useState(true);
  const [importResult, setImportResult] = useState<{
    success: number;
    duplicates: string[];
  } | null>(null);

  useEffect(() => {
    // Nếu bạn dùng notification Ant Design
    const notification = (window as any).notificationAPI;
    setApi(notification);

    // Load JSON khi mở form
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

  const handleEdit = (drug: DanhMucChongChiDinhThuoc) => {
    setFormData({
      maThuoc: drug.maThuoc,
      tenThuoc: drug.tenThuoc,
      soDangKy: drug.soDangKy,
      chongChiDinhMaBenh: drug.chongChiDinhMaBenh || "",
      buocChiDinhMaBenh: drug.buocChiDinhMaBenh || "",
      gioiTinh: String(drug.gioiTinh ?? ""),
      tuoiMin: String(drug.tuoiMin ?? ""),
      tuoiMax: String(drug.tuoiMax ?? ""),
    });
    setSelectedId(drug.id);
  };

  const handleSubmit = async () => {
    const payload: DanhMucChongChiDinhThuoc = {
      ...formData,
      gioiTinh: formData.gioiTinh ? Number(formData.gioiTinh) : undefined,
      tuoiMin: formData.tuoiMin ? Number(formData.tuoiMin) : undefined,
      tuoiMax: formData.tuoiMax ? Number(formData.tuoiMax) : undefined,
      id: selectedId ?? new Date().getTime(), // tạo id mới nếu thêm mới
    };

    let newData: DanhMucChongChiDinhThuoc[];
    if (selectedId) {
      // Update
      newData = data.map(d => d.id === selectedId ? payload : d);
    } else {
      // Thêm mới
      newData = [...data, payload];
    }

    setData(newData);

    // Lưu JSON trực tiếp trên máy
    window.electronAPI.saveJson(FILE_NAME, newData);

    // Reset form
    setFormData({
      maThuoc: "",
      tenThuoc: "",
      soDangKy: "",
      chongChiDinhMaBenh: "",
      buocChiDinhMaBenh: "",
      gioiTinh: "",
      tuoiMin: "",
      tuoiMax: "",
    });
    setSelectedId(null);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Bạn có chắc muốn xóa mục này?")) return;

    const newData = data.filter(d => d.id !== id);
    setData(newData);

    window.electronAPI.saveJson(FILE_NAME, newData);

    // Reset form
    setFormData({
      maThuoc: "",
      tenThuoc: "",
      soDangKy: "",
      chongChiDinhMaBenh: "",
      buocChiDinhMaBenh: "",
      gioiTinh: "",
      tuoiMin: "",
      tuoiMax: "",
    });
    setSelectedId(null);
  };


  const REQUIRED_COLUMNS = [
    "ID",
    "Mã thuốc",
    "Tên thuốc",
    "Số đăng ký",
    "Chống chỉ định mã bệnh",
    "Buộc chỉ định mã bệnh",
    "Giới tính",
    "Tuổi min",
    "Tuổi max",
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
          maThuoc: row["Mã thuốc"]?.toString().trim() || "",
          tenThuoc: row["Tên thuốc"] || "",
          soDangKy: String(row["Số đăng ký"] || "").trim(),
          chongChiDinhMaBenh: row["Chống chỉ định mã bệnh"] || "",
          buocChiDinhMaBenh: row["Buộc chỉ định mã bệnh"] || "",
          gioiTinh: row["Giới tính"] ? Number(row["Giới tính"]) : undefined,
          tuoiMin: row["Tuổi min"] ? Number(row["Tuổi min"]) : undefined,
          tuoiMax: row["Tuổi max"] ? Number(row["Tuổi max"]) : undefined,
        }))
        // 🔥 bỏ dòng không có mã thuốc
        .filter((item) => item.maThuoc !== "");

      // thuốc đã có trong hệ thống
      const existingKeys = new Set(
        data.map((d) =>
          `${String(d.maThuoc || "").trim()}_${String(d.soDangKy || "").trim()}`
        )
      );

      // thuốc đã đọc trong file
      const fileKeys = new Set<string>();

      const duplicateList: string[] = [];
      const newList: any[] = [];

      mappedData.forEach((item) => {
        const key = `${String(item.maThuoc).trim()}_${String(item.soDangKy).trim()}`;

        if (existingKeys.has(key) || fileKeys.has(key)) {
          duplicateList.push(`${item.maThuoc} (${item.soDangKy})`);
        } else {
          fileKeys.add(key);
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

  const columns: ColumnDef<DanhMucChongChiDinhThuoc>[] = [
    { header: "Mã thuốc", accessorKey: "maThuoc" },
    { header: "Tên thuốc", accessorKey: "tenThuoc" },
    { header: "Số đăng ký", accessorKey: "soDangKy" },
    { header: "CCĐ mã bệnh", accessorKey: "chongChiDinhMaBenh" },
    { header: "BCĐ mã bệnh", accessorKey: "buocChiDinhMaBenh" },
    { header: "Giới tính", accessorKey: "gioiTinh" },
    { header: "Tuổi min", accessorKey: "tuoiMin" },
    { header: "Tuổi max", accessorKey: "tuoiMax" },
    {
      header: "Hành động",
      cell: ({ row }) => {
        const drug = row.original;
        return (
          <div className="flex gap-2">
            <Button size="xs" color="warning" onClick={() => handleEdit(drug)}>Sửa</Button>
            <Button size="xs" color="failure" onClick={() => handleDelete(drug.id)}>Xóa</Button>
          </div>
        );
      }
    }
  ];


  return (
    <>
      <div className="rounded-3xl shadow-sm bg-white border border-slate-200 p-6 relative w-full break-words">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Layers size={22} className="text-slate-700" />
            <div>
              <h5 className="font-semibold text-xl text-slate-900">Danh mục chống chỉ định Thuốc</h5>
              <p className="text-sm text-slate-500">Thiết lập danh mục thuốc và điều kiện chống chỉ định theo bệnh, tuổi và giới tính.</p>
            </div>
          </div>
        </div>
        <div className="mt-2">
          <div className="grid grid-cols-12 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-6 col-span-12">
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col gap-4">
                <div className="inline-flex items-center gap-2 text-slate-700 font-semibold">
                  <ShieldCheck size={16} />
                  <span>Thông tin cơ bản</span>
                </div>
                <div>
                  <Label htmlFor="maThuoc" value="Mã thuốc (Bắt buộc)" className="mb-2 block" />
                  <TextInput
                    id="maThuoc"
                    name="maThuoc"
                    type="text"
                    placeholder="Mã thuốc"
                    required
                    value={formData.maThuoc}
                    onChange={handleChange}
                    className="form-control form-rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="soDangKy" value="Số đăng ký" className="mb-2 block" />
                  <TextInput
                    id="soDangKy"
                    name="soDangKy"
                    type="text"
                    placeholder="VD: VD-12345-21"
                    value={formData.soDangKy}
                    onChange={handleChange}
                    className="form-control form-rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="chongChiDinhMaBenh" value="Chống chỉ định mã bệnh" className="mb-2 block" />
                  <TextInput
                    id="chongChiDinhMaBenh"
                    name="chongChiDinhMaBenh"
                    type="text"
                    placeholder="Cách nhau bằng dấu chấm phẩy (;) nếu có nhiều mã"
                    value={formData.chongChiDinhMaBenh}
                    onChange={handleChange}
                    className="form-control form-rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="tuoiMin" value="Tuổi tối thiểu" className="mb-2 block" />
                  <TextInput
                    id="tuoiMin"
                    name="tuoiMin"
                    type="number"
                    value={formData.tuoiMin}
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
                  <span>Tiêu chí áp dụng</span>
                </div>
                <div>
                  <Label htmlFor="tenThuoc" value="Tên thuốc" className="mb-2 block" />
                  <TextInput
                    id="tenThuoc"
                    name="tenThuoc"
                    type="text"
                    placeholder="Tên thuốc"
                    value={formData.tenThuoc}
                    onChange={handleChange}
                    className="form-control form-rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="gioiTinh" value="Giới tính" className="mb-2 block" />
                  <Select
                    id="gioiTinh"
                    name="gioiTinh"
                    required
                    value={formData.gioiTinh}
                    onChange={handleChange}
                    className="select-rounded"
                  >
                    <option value="">Chọn giới tính</option>
                    <option value="1">Nam</option>
                    <option value="2">Nữ</option>
                    <option value="0">Không xác định</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="buocChiDinhMaBenh" value="Buộc chỉ định mã bệnh" className="mb-2 block" />
                  <TextInput
                    id="buocChiDinhMaBenh"
                    name="buocChiDinhMaBenh"
                    type="text"
                     placeholder="Cách nhau bằng dấu chấm phẩy (;) nếu có nhiều mã"
                    value={formData.buocChiDinhMaBenh}
                    onChange={handleChange}
                    className="form-control form-rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="tuoiMax" value="Tuổi tối đa" className="mb-2 block" />
                  <TextInput
                    id="tuoiMax"
                    name="tuoiMax"
                    type="number"
                    value={formData.tuoiMax}
                    onChange={handleChange}
                    className="form-control form-rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="col-span-12 flex flex-col lg:flex-row justify-between items-center mt-4 gap-3">
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
                      maThuoc: "",
                      tenThuoc: "",
                      soDangKy: "",
                      chongChiDinhMaBenh: "",
                      buocChiDinhMaBenh: "",
                      gioiTinh: "",
                      tuoiMin: "",
                      tuoiMax: "",
                    });
                    setSelectedId(null);
                  }}
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
        </div>
      </div>
      <div className="pt-5">
        <h2 className="text-xl font-semibold mb-4">Danh sách thuốc chống chỉ định</h2>
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
