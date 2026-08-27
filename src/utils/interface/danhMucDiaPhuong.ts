import { useEffect, useState } from 'react';
import axios from 'axios';

export interface DanhMucDiaPhuong {
  ma_xa: string;
  ten_xa: string;
  ma_tinh: string;
  ten_tinh: string;
}


export const useDanhMucDiaPhuong = () => {
  const [benhList, setBenhList] = useState<DanhMucDiaPhuong[]>([]);

  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}DanhMucDiaPhuong2Cap.json`;
    axios
      .get<DanhMucDiaPhuong[]>(url)
      .then((res) => setBenhList(res.data))
      .catch((err) => {
        console.error('❌ Lỗi khi đọc file DanhMucDiaPhuong2Cap.json:', err);
        console.error('👉 Dữ liệu trả về:', err?.response?.data);
      });
  }, []);

  return benhList;
};
