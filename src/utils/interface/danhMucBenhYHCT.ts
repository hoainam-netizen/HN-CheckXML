import { useEffect, useState } from 'react';
import axios from 'axios';

export interface BenhYHCT {
  STT: string;
  Ma_YHCT: string;
  Ten_YHCT: string;
  Ma_ICD: string;
  Ten_ICD: string;
  Ten_Hien_Dai: string;
  Ten: string;
  HL: string;
}


export const useBenhYHCT = () => {
  const [benhList, setBenhList] = useState<BenhYHCT[]>([]);

  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}DanhMucBenhYHCT.json`; // tên file JSON bạn đổi theo đúng tên
    axios
      .get<BenhYHCT[]>(url)
      .then((res) => setBenhList(res.data))
      .catch((err) => {
        console.error('❌ Lỗi khi đọc file DM_BenhYHCT.json:', err);
        console.error('👉 Dữ liệu trả về:', err?.response?.data);
      });
  }, []);

  return benhList;
};
