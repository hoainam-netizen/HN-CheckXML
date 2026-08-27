import { useEffect, useState } from "react";
import { HashRouter } from "react-router-dom";
import { Flowbite, ThemeModeScript } from "flowbite-react";
import customTheme from "./utils/theme/custom-theme";
import { ToastContainer } from "react-toastify";
import { message, Button, Spin, Typography, Card, Space, Divider } from "antd";
import { AliveScope } from "react-activation";
import AppRoutes from "./routes/Router";
import { supabase } from "./lib/supabase";
// Import Lucide Icons
import { ShieldAlert, Fingerprint, RefreshCcw, Copy, ShieldCheck } from "lucide-react";
import { AuthContext } from "./views/trangChu/AuthContext";
import ZaloFloatButton from "./layouts/full/header/ZaloFloatButton";

const { Text, Title } = Typography;

function App() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [hwId, setHwId] = useState("");

  const [permissions, setPermissions] = useState({
    authorized: false,
    canExport: false,
    canValidate: false,
    canCompare: false,
    ma_cskcb: ''
  });

  const checkLicense = async () => {
    try {
      setLoading(true);
      const id = await window.electronAPI.getHwId();
      setHwId(id);

      const { data, error } = await supabase
        .from('users_access')
        .select('is_active, can_export, can_validate, can_compare, ma_cskcb') // Lấy thêm các cột quyền
        .eq('machine_id', id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data && data.is_active) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
        if (!data) {
          await supabase.from('users_access').insert([{ machine_id: id, is_active: false }]);
        }
      }
      if (data) {
        setPermissions({
          authorized: data.is_active,
          canExport: data.can_export || false,
          canValidate: data.can_validate || false,
          canCompare: data.can_compare || false,
          ma_cskcb: data.ma_cskcb || ''
        });
      } else {
        // Nếu máy mới, tạo bản ghi mặc định (tất cả là false)
        await supabase.from('users_access').insert([{
          machine_id: id,
          is_active: false,
          can_export: false,
          can_validate: false,
          can_compare: false,
          ma_cskcb: ''
        }]);
        setPermissions(prev => ({ ...prev, authorized: false }));
      }
    } catch (err) {
      console.error('License check failed', err);
      message.error('Lỗi kết nối server xác thực!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkLicense();
  }, []);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#f8fafc' }}>
        <Spin size="large" />
        <Text style={{ marginTop: 16, color: '#64748b', fontWeight: 500 }}>Đang xác thực bản quyền thiết bị...</Text>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
        padding: '20px'
      }}>
        <Card
          variant="plain"
          style={{
            maxWidth: 500,
            width: '100%',
            textAlign: 'center',
            borderRadius: '20px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}
        >
          <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
            <div style={{ padding: 20, background: '#fef2f2', borderRadius: '50%' }}>
              <ShieldAlert size={64} color="#ef4444" strokeWidth={1.5} />
            </div>
          </div>

          <Title level={3} style={{ marginBottom: 8, fontWeight: 800 }}>Truy cập bị từ chối</Title>
          <Text type="secondary" style={{ fontSize: '15px' }}>
            Thiết bị này chưa được kích hoạt bản quyền trong hệ thống.
          </Text>

          <Divider style={{ margin: '24px 0' }} />

          <div style={{
            background: '#f8fafc',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            textAlign: 'left'
          }}>
            <Space style={{ marginBottom: 12, color: '#475569' }}>
              <Fingerprint size={18} className="text-blue-500" />
              <Text strong style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Mã định danh thiết bị
              </Text>
            </Space>

            {/* Ô mã HWID với khả năng chọn văn bản nhưng không cho nhập */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              overflow: 'hidden',
              padding: '4px 4px 4px 12px',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <input
                readOnly
                value={hwId}
                style={{
                  flex: 1,
                  fontSize: '15px',
                  color: '#1e293b',
                  fontWeight: '600',
                  fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                  letterSpacing: '1px',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  cursor: 'text', // Giữ con trỏ dạng chữ I để người dùng biết có thể chọn văn bản
                  width: '100%',
                  padding: '8px 0'
                }}
                onFocus={(e) => e.target.select()} // Tự động bôi đen toàn bộ khi click vào (tiện cho user)
              />

              <div style={{ borderLeft: '1px solid #e2e8f0', marginLeft: '12px', paddingLeft: '4px' }}>
                <Text
                  copyable={{
                    text: hwId,
                    icon: [
                      <span
                        key="copy"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Copy size={18} color="#64748b" />
                      </span>,
                      <span
                        key="copied"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <ShieldCheck size={18} color="#10b981" />
                      </span>
                    ],
                    tooltips: ['Sao chép', 'Đã chép!'],
                  }}
                />
              </div>
            </div>

            <Text type="secondary" style={{ fontSize: '12px', marginTop: '12px', display: 'block', fontStyle: 'italic' }}>
              * Vui lòng gửi mã này cho Admin để kích hoạt quyền truy cập.
            </Text>
          </div>

          <Button
            type="primary"
            size="large"
            block
            icon={<RefreshCcw size={18} />}
            onClick={checkLicense}
            style={{
              marginTop: 32,
              height: '50px',
              borderRadius: '10px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              backgroundColor: '#3F8A3E'
            }}
          >
            Kiểm tra lại hệ thống
          </Button>
        </Card>
        <ZaloFloatButton />
      </div>

    );
  }

  return (
    <>
      <AuthContext.Provider value={{ permissions }}>
        <ThemeModeScript />
        <Flowbite theme={{ theme: customTheme }}>
          <AliveScope>
            <ToastContainer position="top-right" autoClose={3000} theme="colored" />
            <HashRouter>
              <AppRoutes />
              <ZaloFloatButton />
            </HashRouter>
          </AliveScope>
        </Flowbite>
      </AuthContext.Provider>
    </>
  );
}

export default App;