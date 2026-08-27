import { useEffect, useState } from 'react';
import axios from 'axios';

export interface TuongTacThuoc {
  ma_hoat_chat_1: string;
  ma_thuoc_1: number;
  ma_hoat_chat_2: string;
  ma_thuoc_2: number;
}

export const useChongTuongTacThuoc = () => {
  const [facilities, setFacilities] = useState<TuongTacThuoc[]>([]);

  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}DanhMucTuongTacThuoc.json`;
    axios
      .get<TuongTacThuoc[]>(url)
      .then((res) => setFacilities(res.data))
      .catch((err) => {
        console.error('❌ Lỗi khi đọc file ChongTuongTacThuoc.json:', err);
        console.error('👉 Dữ liệu trả về:', err?.response?.data);
      });
  }, []);
  return facilities;
};
