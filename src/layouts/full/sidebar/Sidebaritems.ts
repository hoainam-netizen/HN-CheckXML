import { uniqueId } from 'lodash';

// Giữ nguyên interface của bạn
export interface ChildItem {
  id?: number | string;
  name?: string;
  icon?: any;
  children?: ChildItem[];
  item?: any;
  url?: any;
  color?: string;
  permissionKey?: string;
}

export interface MenuItem {
  heading?: string;
  name?: string;
  icon?: any;
  id?: number;
  to?: string;
  items?: MenuItem[];
  children?: ChildItem[];
  url?: any;
}

const SidebarContent: MenuItem[] = [
  {
    heading: 'Kiểm lỗi',
    children: [
      {
        name: 'Kiểm lỗi XML',
        icon: 'solar:shield-check-bold-duotone', // Khiên bảo vệ/kiểm tra
        id: uniqueId(),
        url: '/',
        permissionKey: 'authorized',
      },
    ],
  },
  {
    heading: 'Cấu hình danh mục CSKCB',
    children: [
      {
        name: 'Dịch vụ kỹ thuật',
        icon: 'solar:clipboard-list-linear', // Ống nghe - đặc trưng cho DVKT
        id: uniqueId(),
        url: '/danhmucdvkt',
        permissionKey: 'canValidate',
      },
      {
        name: 'Thuốc',
        icon: 'solar:pill-bold-duotone', // Viên thuốc chuẩn
        id: uniqueId(),
        url: '/danhmucthuoc',
        permissionKey: 'canValidate',
      },
      {
        name: 'Vật tư y tế',
        icon: 'solar:syringe-bold-duotone', // Bơm tiêm - đặc trưng cho vật tư
        id: uniqueId(),
        url: '/ui/form',
        permissionKey: 'canValidate', 
      },
      {
        name: 'Nhân viên',
        icon: 'solar:users-group-rounded-bold-duotone', // Nhóm nhân sự
        id: uniqueId(),
        url: '/danhmucnv',
        permissionKey: 'canValidate',
      },
      {
        name: 'Khoa phòng - Giường',
        icon: 'solar:bed-bold-duotone', // Giường bệnh
        id: uniqueId(),
        url: '/danhmuckhoaphonggiuong',
        permissionKey: 'canValidate',
      },
      {
        name: 'Trang thiết bị Y tế',
        icon: 'solar:monitor-broken', // Máy theo dõi sinh hiệu
        id: uniqueId(),
        url: '/trangtbyt',
        permissionKey: 'canValidate',
      },
    ],
  },
  {
    heading: 'Tự thiết lập cấu hình',
    children: [
      {
        name: 'Chống CĐ DVKT',
        icon: 'solar:forbidden-circle-bold-duotone', // Biểu tượng cấm/chống chỉ định
        id: uniqueId(),
        url: '/cauhinhdvkt',
        permissionKey: 'canValidate',
      },
      {
        name: 'Chống CĐ Thuốc',
        icon: 'solar:shield-warning-bold-duotone', // Cảnh báo sử dụng thuốc
        id: uniqueId(),
        url: '/chongchidinhthuoc',
        permissionKey: 'canValidate',
      },
      {
        name: 'Thời gian làm DVKT',
        icon: 'solar:clock-circle-bold-duotone', // Đồng hồ đo thời gian
        id: uniqueId(),
        url: '/thoigiandvkt',
        permissionKey: 'canValidate',
      },
      {
        name: 'Giờ hành chính',
        icon: 'solar:calendar-date-bold-duotone', // Lịch làm việc
        id: uniqueId(),
        url: '/danhmucgiohc',
        permissionKey: 'canValidate',
      },
    ],
  },
  {
    heading: 'Danh mục TT12',
    children: [
      {
        name: 'Tạo danh mục TT12',
        icon: 'solar:document-add-bold-duotone', // Thêm mới tài liệu/thông tư
        id: uniqueId(),
        url: '/testtt12',
        permissionKey: 'authorized',
      },
      {
        name: 'Đối chiếu mẫu 01/BH',
        icon: 'solar:transfer-vertical-bold-duotone', // Đối chiếu/So sánh dữ liệu
        id: uniqueId(),
        url: '/doichieu',
        permissionKey: 'canCompare',
      },
      {
        name: 'Thay thế mẫu 09/BH',
        icon: 'solar:document-text-broken',
        id: uniqueId(),
        url: '/dieuchinh09bh',
        permissionKey: 'authorized',
      },
    ],
  },
  {
    heading: 'Tra cứu thẻ BHYT',
    children: [
      {
        name: 'Tra cứu thẻ BHYT',
        icon: 'solar:document-add-bold-duotone', // Thêm mới tài liệu/thông tư
        id: uniqueId(),
        url: '/tracuuthembhyt',
        permissionKey: 'authorized',
      },
    ],
  },
];

export default SidebarContent;
