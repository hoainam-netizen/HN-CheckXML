import { useEffect, useState } from 'react';
import axios from 'axios';

export interface Facility {
  STT: number;
  MA_CSKCB: string;
  TEN_BV: string;
  TUYEN: number;
  HANG: string;
  DIA_CHI: string;
}

export const useFacilities = () => {
  const [facilities, setFacilities] = useState<Facility[]>([]);

  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}DanhMucCSKCB.json`;
    axios
      .get<Facility[]>(url)
      .then((res) => setFacilities(res.data))
      .catch((err) => {
        console.error('❌ Lỗi khi đọc file DM_CSKCB.json:', err);
        console.error('👉 Dữ liệu trả về:', err?.response?.data);
      });
  }, []);

  return facilities;
};
