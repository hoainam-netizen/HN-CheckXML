import { createContext, useContext } from 'react';

// Định nghĩa kiểu dữ liệu cho Context
interface AuthContextType {
  permissions: {
    authorized: boolean;
    canExport: boolean;
    canValidate: boolean;
    canCompare: boolean;
    ma_cskcb: string;
  };
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hook để các trang con (TrangChu, DanhMuc...) gọi dữ liệu nhanh
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};