import { Button, Dropdown, Label, Modal, TextInput } from "flowbite-react";
import { Icon } from "@iconify/react";
import user1 from "/src/assets/images/profile/user-1.jpg";
import { useEffect, useState } from "react";

interface User {
  name: string;
  cskcb: string;
}

const FILE_NAME = "CSKCB"; // Tên file theo yêu cầu

const Profile = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState<User>({ name: "", cskcb: "" });

  useEffect(() => {
    const loadUser = async () => {
      setLoading(true);
      try {
        const jsonData = await window.electronAPI.readJsonFile(`${FILE_NAME}.json`);
        if (jsonData?.name && jsonData?.cskcb) {
          setUser({ name: jsonData.name, cskcb: jsonData.cskcb });
        } else setUser(null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const handleOpenForm = () => {
    setFormData(user ?? { name: "", cskcb: "" });
    setOpenModal(true);
  };

  const handleSave = async () => {
    try {
      await window.electronAPI.saveJson(FILE_NAME, formData);
      setUser(formData);
      setOpenModal(false);

      // Optional: notification đẹp
      const notification = (window as any).notificationAPI;
      notification?.open({
        message: "Cập nhật thông tin",
        description: "Đã lưu file JSON thành công!",
        icon: <Icon icon="solar:check-circle-linear" color="#108ee9" height={24} />,
      });
    } catch (err) {
      console.error("Lỗi khi lưu JSON:", err);
    }
  };

  if (loading) return <div className="text-sm text-gray-500">Đang tải...</div>;

  return (
    <div className="relative group/menu">
      <Dropdown
        label=""
        className="rounded-sm w-56"
        dismissOnClick={false}
        renderTrigger={() => (
          <span className="h-10 w-10 hover:text-primary hover:bg-lightprimary rounded-full flex justify-center items-center cursor-pointer group-hover/menu:bg-lightprimary group-hover/menu:text-primary">
            <img
              src={user1}
              alt="avatar"
              height="35"
              width="35"
              className="rounded-full"
            />
          </span>
        )}
      >
        {user ? (
          <>
            <Dropdown.Item className="px-3 py-3 flex items-center gap-3 text-dark">
              <Icon icon="solar:user-circle-outline" height={20} />
              {user.name}
            </Dropdown.Item>

            <Dropdown.Item className="px-3 py-3 flex items-center gap-3 text-dark">
              <Icon icon="solar:hospital-outline" height={20} />
              Mã CSKCB: {user.cskcb}
            </Dropdown.Item>
            <Dropdown.Item onClick={handleOpenForm} className="px-3 py-3 flex items-center gap-3 text-dark">
              <Button color="primary">
                <Icon icon="mdi:pencil-outline" height={20} />
                Thay đổi thông tin
              </Button>
            </Dropdown.Item>
          </>
        ) : (
          <>
            <Dropdown.Item onClick={handleOpenForm} className="px-3 py-3 flex items-center gap-3 text-dark">
              <Icon icon="mdi:account-plus-outline" height={20} />
              Thêm thông tin
            </Dropdown.Item>
          </>
        )}

      </Dropdown>
      {/* Modal form */}
      <Modal show={openModal} size="md" popup onClose={() => setOpenModal(false)}>
        <Modal.Header />
        <Modal.Body>
          <form>
            <div className="mb-4">
              <div className="mb-2 block">
                <Label htmlFor="name" value="Họ và Tên" />
              </div>
              <TextInput
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="mb-4">
              <div className="mb-2 block">
                <Label htmlFor="cskcb" value="Mã CSKCB" />
              </div>
              <TextInput
                value={formData.cskcb}
                onChange={(e) => setFormData({ ...formData, cskcb: e.target.value })}
              />
            </div>

            <Button
              type="submit"
              color={"primary"}
              className="w-full bg-primary text-white rounded-xl"
              onClick={handleSave}
            >
              Lưu thông tin
            </Button>
          </form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Profile;
