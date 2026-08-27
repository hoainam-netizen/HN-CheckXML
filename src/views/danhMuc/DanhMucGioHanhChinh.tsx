export interface KhungGio {
    sang: { start: string; end: string };
    chieu: { start: string; end: string };
    toi?: { start: string; end: string }; // optional
}

import { useEffect, useState } from "react";
import { TimePicker } from "antd";
import dayjs from "dayjs";
import { notification } from "antd";
import { Button } from "flowbite-react";
import { CheckCircle2, Layers, Moon, Sun, Sunrise, Save } from "lucide-react";

export interface KhungGio {
    sang: { start: string; end: string };
    chieu: { start: string; end: string };
    toi?: { start: string; end: string };
}

const FILE_NAME = "KhungGioKCB";

const KhungGioForm = () => {
    const [khungGio, setKhungGio] = useState<KhungGio>({
        sang: { start: "07:00", end: "11:30" },
        chieu: { start: "13:00", end: "17:00" },
        toi: { start: "", end: "" },
    });

    const [api, contextHolder] = notification.useNotification();

    useEffect(() => {
        loadJson();
    }, []);

    const loadJson = async () => {
        const data = await window.electronAPI.readJsonFile(`${FILE_NAME}.json`);
        if (data) setKhungGio(data);
    };

    const handleSave = () => {
        const toSave = { ...khungGio };
        if (!toSave.toi?.start && !toSave.toi?.end) {
            delete toSave.toi; // xóa buổi tối nếu rỗng
        }
        window.electronAPI.saveJson(FILE_NAME, toSave);
        api.open({
            message: "Lưu khung giờ KCB",
            description: "Đã lưu cấu hình giờ hoạt động thành công!",
            icon: <CheckCircle2 color="#108ee9" size={24} />,
            showProgress: true,
            pauseOnHover: true,
        });
    };


    const renderRangePicker = (
        label: string,
        field: keyof KhungGio,
        defaultStart: string,
        defaultEnd: string
    ) => {
        const range = khungGio[field] || { start: defaultStart, end: defaultEnd };

        const icon = field === "sang" ? <Sun size={18} /> : field === "chieu" ? <Sunrise size={18} /> : <Moon size={18} />;

        return (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3 text-slate-700 font-semibold">
                    {icon}
                    <h3 className="text-base">{label}</h3>
                </div>
                <TimePicker.RangePicker
                    format="HH:mm"
                    value={[
                        dayjs(range.start, "HH:mm"),
                        dayjs(range.end, "HH:mm"),
                    ]}
                    onChange={(values) => {
                        if (!values) return;
                        setKhungGio({
                            ...khungGio,
                            [field]: {
                                start: values[0]?.format("HH:mm") || "",
                                end: values[1]?.format("HH:mm") || "",
                            },
                        });
                    }}
                    className="w-full"
                />
            </div>
        );
    };

    return (
        <div className="p-4">
            {contextHolder}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <Layers size={24} className="text-slate-700" />
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Cấu hình khung giờ KCB</h2>
                            <p className="text-sm text-slate-500">Thiết lập khung giờ khám chữa bệnh cho buổi sáng, chiều và tối.</p>
                        </div>
                    </div>
                    <Button color="primary" onClick={handleSave} className="inline-flex items-center gap-2">
                        <Save size={16} />
                        Lưu cấu hình
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {renderRangePicker("Buổi sáng", "sang", "07:00", "11:30")}
                    {renderRangePicker("Buổi chiều", "chieu", "13:00", "17:00")}
                    {renderRangePicker("Buổi tối", "toi", "", "")}
                </div>
            </div>
        </div>
    );
};

export default KhungGioForm;

