import { Sidebar } from 'flowbite-react';
import React from 'react';
import SimpleBar from 'simplebar-react';
import FullLogo from '../shared/logo/FullLogo';
import NavItems from './NavItems';
import SidebarContent from './Sidebaritems';
import { useAuth } from 'src/views/trangChu/AuthContext';

const SidebarLayout = () => {
  const { permissions } = useAuth();
  return (
    <>
      <div className="xl:block hidden">
        <Sidebar
          className="fixed menu-sidebar bg-white dark:bg-darkgray rtl:pe-4 rtl:ps-0 "
          aria-label="Sidebar with multi-level dropdown example"
        >
          <div className="px-6 py-4 flex items-center sidebarlogo">
            <FullLogo />
          </div>
          <SimpleBar className="h-[calc(100vh_-_230px)]">
            <Sidebar.Items className="px-5 mt-2">
              <Sidebar.ItemGroup className="sidebar-nav hide-menu">
                {SidebarContent &&
                  SidebarContent.map((item, index) => {
                    // 1. Lọc danh sách con dựa trên quyền hạn (permissions)
                    // Nếu không có permissionKey thì mặc định là cho phép hiển thị
                    const allowedChildren = item.children?.filter((child) => {
                      if (!child.permissionKey) return true;
                      return !!(permissions as any)[child.permissionKey];
                    });

                    // 2. Nếu sau khi lọc mà không còn mục con nào, ẩn luôn cả Heading này
                    if (!allowedChildren || allowedChildren.length === 0) {
                      return null;
                    }

                    return (
                      <div className="caption" key={item.heading || index}>
                        <React.Fragment>
                          {/* Hiển thị tiêu đề nhóm */}
                          <h5 className="text-link dark:text-white/70 caption font-semibold leading-6 tracking-widest text-xs pb-2 uppercase mt-4">
                            {item.heading}
                          </h5>

                          {/* Render danh sách các mục con đã được lọc quyền */}
                          {allowedChildren.map((child, childIndex) => (
                            <React.Fragment key={child.id || childIndex}>
                              <NavItems item={child} />
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      </div>
                    );
                  })}
              </Sidebar.ItemGroup>
            </Sidebar.Items>
          </SimpleBar>
        </Sidebar>
      </div>
    </>
  );
};

export default SidebarLayout;
