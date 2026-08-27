import { Routes, Route, Navigate } from "react-router-dom";
import { lazy } from "react";
import Loadable from "src/layouts/full/shared/loadable/Loadable";
import { KeepAlive } from "react-activation";

/* Layouts */
const FullLayout = Loadable(lazy(() => import("../layouts/full/FullLayout")));
const BlankLayout = Loadable(lazy(() => import("../layouts/blank/BlankLayout")));

/* Pages */
const Dashboard = Loadable(lazy(() => import("../views/trangChu/TrangChu")));
const DanhMucNhanVien = Loadable(lazy(() => import("../views/danhMuc/DanhMucNhanVien")));
const DanhMucDVKT = Loadable(lazy(() => import("../views/danhMuc/DanhMucDVKT")));
const DanhMucThuoc = Loadable(lazy(() => import("../views/danhMuc/DanhMucThuoc")));
const DanhMucTrangThietBi = Loadable(lazy(() => import("../views/danhMuc/DanhMucTrangThietBi")));
const ChongChiDinhThuoc = Loadable(lazy(() => import("../views/danhMuc/DanhMucChongChiDinhThuoc")));
const DanhMucKhoaPhongGiuong = Loadable(lazy(() => import("../views/danhMuc/DanhMucKhoaPhongGiuong")));
const ThoiGianThucHienDVKT = Loadable(lazy(() => import("../views/danhMuc/DanhMucThoiGianThucHienDVKT")));
const DanhMucGioHanhChinh = Loadable(lazy(() => import("../views/danhMuc/DanhMucGioHanhChinh")));
const DanhMucBoCheckMaMay = Loadable(lazy(() => import("../views/danhMuc/DanhMucBoCheckMaMay")));
const DanhMucNguoiThucHienDVKT = Loadable(lazy(() => import("../views/danhMuc/DanhMucCauHinhDVKT")));
const XuatXML = Loadable(lazy(() => import("../views/TT12/XuatXML_Kyso_BHXH_TT12")));
const DoiChieu = Loadable(lazy(() => import("../views/TT12/DoiChieu01BH")));
const DieuChinh09BH = Loadable(lazy(() => import("../views/TT12/DieuChinh09BH")));
const TraCuuTheBHYT = Loadable(lazy(() => import("../views/trangChu/TraCuuTheBHYT")));
const ErrorPage = Loadable(lazy(() => import("../views/auth/error/Error")));

const AppRoutes = () => {
  return (
    <Routes>
      {/* Main Layout */}
      <Route path="/" element={<FullLayout />}>

        <Route
          index
          element={
            <KeepAlive name="dashboard" cacheKey="dashboard">
              <Dashboard />
            </KeepAlive>
          }
        />

        <Route path="danhmucnv" element={<KeepAlive name="nv" cacheKey="nv"><DanhMucNhanVien /></KeepAlive>} />
        <Route path="danhmucdvkt" element={<KeepAlive name="dvkt" cacheKey="dvkt"><DanhMucDVKT /></KeepAlive>} />
        <Route path="danhmucthuoc" element={<KeepAlive name="thuoc" cacheKey="thuoc"><DanhMucThuoc /></KeepAlive>} />
        <Route path="trangtbyt" element={<KeepAlive name="tbyt" cacheKey="tbyt"><DanhMucTrangThietBi /></KeepAlive>} />
        <Route path="chongchidinhthuoc" element={<KeepAlive name="ccd" cacheKey="ccd"><ChongChiDinhThuoc /></KeepAlive>} />
        <Route path="danhmuckhoaphonggiuong" element={<KeepAlive name="khoa" cacheKey="khoa"><DanhMucKhoaPhongGiuong /></KeepAlive>} />
        <Route path="thoigiandvkt" element={<KeepAlive name="tg" cacheKey="tg"><ThoiGianThucHienDVKT /></KeepAlive>} />
        <Route path="danhmucgiohc" element={<KeepAlive name="giohc" cacheKey="giohc"><DanhMucGioHanhChinh /></KeepAlive>} />
        <Route path="danhmucbocheckmamay" element={<KeepAlive name="may" cacheKey="may"><DanhMucBoCheckMaMay /></KeepAlive>} />
        <Route path="cauhinhdvkt" element={<KeepAlive name="cauhinh" cacheKey="cauhinh"><DanhMucNguoiThucHienDVKT /></KeepAlive>} />
        <Route path="testtt12" element={<KeepAlive name="xml" cacheKey="xml"><XuatXML /></KeepAlive>} />
        <Route path="doichieu" element={<KeepAlive name="doichieu" cacheKey="doichieu"><DoiChieu /></KeepAlive>} />
        <Route path="dieuchinh09bh" element={<KeepAlive name="dieuchinh09bh" cacheKey="dieuchinh09bh"><DieuChinh09BH /></KeepAlive>} />
        <Route path="tracuuthembhyt" element={<KeepAlive name="tracuuthembhyt" cacheKey="tracuuthembhyt"><TraCuuTheBHYT /></KeepAlive>} />

        <Route path="*" element={<Navigate to="/auth/404" />} />
      </Route>

      {/* Blank Layout */}
      <Route path="/auth" element={<BlankLayout />}>
        <Route path="404" element={<ErrorPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/auth/404" />} />
    </Routes>
  );
};

export default AppRoutes;