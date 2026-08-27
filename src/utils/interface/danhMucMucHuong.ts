import { useEffect, useState } from 'react';
import axios from 'axios';

export interface MucHuong {
  MA_THE: string;
  DIEN_GIAI: string;
  TY_LE: number;
}

export const useMucHuong = () => {
  const [facilities, setFacilities] = useState<MucHuong[]>([]);

  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}DanhMucMucHuong.json`;
    axios
      .get<MucHuong[]>(url)
      .then((res) => setFacilities(res.data))
      .catch((err) => {
        console.error('❌ Lỗi khi đọc file DanhMucMucHuong.json:', err);
        console.error('👉 Dữ liệu trả về:', err?.response?.data);
      });
  }, []);

  return facilities;
};
