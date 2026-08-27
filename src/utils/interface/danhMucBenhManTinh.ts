import { useEffect, useState } from 'react';
import axios from 'axios';

export interface BenhManTinh {
  STT: string;
  mabenh_icd10: string;
  tenbenh_icd10: string;
}


export const useBenhManTinh = () => {
  const [benhList, setBenhList] = useState<BenhManTinh[]>([]);

  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}DanhMucBenhManTinh.json`; // tên file JSON bạn đổi theo đúng tên
    axios
      .get<BenhManTinh[]>(url)
      .then((res) => setBenhList(res.data))
      .catch((err) => {
        console.error('❌ Lỗi khi đọc file DanhMucBenhManTinh.json:', err);
        console.error('👉 Dữ liệu trả về:', err?.response?.data);
      });
  }, []);

  return benhList;
};
