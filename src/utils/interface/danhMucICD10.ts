import { useEffect, useState } from 'react';
import axios from 'axios';

export interface ICD10 {
  STT: string;
  Ma_Benh: string;
  Ten_Benh: string;
  Nhom_Benh: string;
}

export const useICD10 = () => {
  const [benhList, setBenhList] = useState<ICD10[]>([]);

  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}DanhMucICD10.json`; // tên file JSON bạn đổi theo đúng tên
    axios
      .get<ICD10[]>(url)
      .then((res) => setBenhList(res.data))
      .catch((err) => {
        console.error('❌ Lỗi khi đọc file ICD10.json:', err);
        console.error('👉 Dữ liệu trả về:', err?.response?.data);
      });
  }, []);

  return benhList;
};
