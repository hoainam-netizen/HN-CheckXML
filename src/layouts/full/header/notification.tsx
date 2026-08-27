import { Badge, Dropdown } from "flowbite-react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import user1 from "/src/assets/images/profile/user-1.jpg";
import user2 from "/src/assets/images/profile/user-2.jpg";
import user3 from "/src/assets/images/profile/user-3.jpg";

const Notifications = [
    {
        id: 1,
        title: "Xuất Excel theo mẫu 01/BH - TT12",
        user: user1
    },
    {
        id: 2,
        title: "Đối chiếu HS 01/BH - TT12",
        user: user2
    },
    {
        id: 3,
        title: "Cập nhật giao diện mới - Tạo Danh mục TT12",
        user: user1
    },
    {
        id: 4,
        title: "Cập nhật một số tính năng kiểm lỗi mới",
        user: user2
    },
    {
        id: 5,
        title: "Cập nhật kiểm lỗi HS 4750 -> 3176",
        user: user3
    },
]

const Notification = () => {
    return (
        <div className="relative group/menu">
            <Dropdown label="" className="rounded-sm w-[300px] notification" dismissOnClick={false} renderTrigger={() => (
                <span
                    className="h-10 w-10 text-slate-700 hover:text-primary group-hover/menu:bg-slate-100 group-hover/menu:text-primary hover:bg-slate-100 rounded-full flex justify-center items-center cursor-pointer relative transition-colors"
                    aria-label="Notifications"
                >
                    <Bell size={20} />
                    <Badge className="h-2 w-2 rounded-full absolute end-2 top-1 bg-primary p-0" />
                </span>
            )}
            >
                {
                    Notifications.map((item) => (
                        <Dropdown.Item
                            as={Link}
                            key={item.id}
                            to="#"
                            className="px-3 py-3 flex items-start gap-3 w-full text-dark hover:bg-gray-100"
                        >
                            {/* Avatar */}
                            <img
                                src={item.user}
                                alt="user"
                                width={40}
                                height={40}
                                className="rounded-full shrink-0"
                            />

                            {/* Text */}
                            <p className="text-dark opacity-80 text-[13px] font-semibold flex-1 whitespace-normal break-words">
                                {item.title}
                            </p>
                        </Dropdown.Item>
                    ))
                }
            </Dropdown>
        </div>
    );
};

export default Notification;
