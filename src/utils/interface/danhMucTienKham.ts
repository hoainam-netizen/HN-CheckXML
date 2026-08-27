import { useEffect, useState } from 'react';
import axios from 'axios';

export interface TienKham {
  CONG_KHAM: string;
  TEN_CONG_KHAM: string;
  PVCM: string;
  BAN_KHAM: string;
}

export const useTienKham = () => {
  const [TienKham, setTienKham] = useState<TienKham[]>([]);

  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}DanhMucCongKham.json`;
    axios
      .get<TienKham[]>(url)
      .then((res) => setTienKham(res.data))
      .catch((err) => {
        console.error('❌ Lỗi khi đọc file DMTienKham.json:', err);
        console.error('👉 Dữ liệu trả về:', err?.response?.data);
      });
  }, []);

  return TienKham;
};
