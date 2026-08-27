const XML_CONFIGS = {
  MAU01: {
    label: "Mẫu 01 - DM Bộ phận chuyên môn",
    rootTag: "DANHSACH_DMBOPHANCHUYENMON",
    itemTag: "DMBOPHANCHUYENMON",
    fileName: "MAU01_DMBOPHANCHUYENMON.xml",
    columns: ["MA_KHOA", "TEN_KHOA", "BAN_KHAM", "GIUONG_PD", "GIUONG_TK", "GIUONG_HSTC", "GIUONG_HSCC", "TU_NGAY", "DEN_NGAY", "MA_CSKCB"]
  },
  MAU02: {
    label: "Mẫu 02 - DM Vật tư y tế", // Ví dụ mẫu khác
    rootTag: "DANHSACH_DMVATTYTE",
    itemTag: "DMVATTYTE",
    fileName: "MAU02_VATTYTE.xml",
    columns: ["MA_VAT_TU", "TEN_VAT_TU", "DON_VI_TINH", "MA_CSKCB"]
  },
  // Thêm các mẫu khác tại đây...
};

type ConfigKey = keyof typeof XML_CONFIGS;