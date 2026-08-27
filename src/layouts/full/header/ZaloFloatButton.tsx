import { useState } from "react";
import { Modal, Button } from "flowbite-react";
import { Icon } from "@iconify/react";

const ZaloFloatButton = () => {
  const [openModal, setOpenModal] = useState(false);

  return (
    <>
      {/* Nút tròn nổi phía bên phải */}
      <div className="fixed bottom-6 right-6 z-[9999] group">
        {/* Label hiện ra khi hover (tùy chọn) */}
        <span className="absolute right-16 top-1/2 -translate-y-1/2 bg-white px-3 py-1.5 rounded-lg shadow-md text-sm font-bold text-[#0068ff] opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap pointer-events-none border border-[#0068ff]">
          Liên hệ Admin
        </span>

        <button
          onClick={() => setOpenModal(true)}
          className="flex items-center justify-center w-14 h-14 bg-[#0068ff] text-white rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all animate-bounce hover:animate-none"
          title="Liên hệ Zalo"
        >
          <Icon icon="simple-icons:zalo" width={32} height={32} />
        </button>
      </div>

      {/* Modal hiện QR Code */}
      <Modal show={openModal} size="md" onClose={() => setOpenModal(false)} popup>
        <Modal.Header />
        <Modal.Body>
          <div className="text-center p-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-3xl mb-4 inline-block shadow-inner">
              {/* THAY QR CỦA BẠN VÀO ĐÂY */}
              <img 
                src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://zalo.me/0382396122" 
                alt="Zalo QR"
                className="w-44 h-44 mx-auto rounded-xl border-4 border-white shadow-sm"
              />
            </div>
            
            <h3 className="text-2xl font-black text-gray-800 dark:text-white mb-2">
              Hỗ Trợ Kỹ Thuật
            </h3>
            <p className="text-gray-500 mb-6 font-medium">
              Quét mã QR để nhắn tin Zalo <br/> hoặc bấm nút bên dưới để mở ứng dụng
            </p>

            <div className="flex flex-col gap-3">
              <Button 
                size="lg"
                className="bg-[#0068ff] hover:!bg-[#0056d2] border-none"
                onClick={() => window.open('https://zalo.me/0382396122', '_blank')}
              >
                <Icon icon="solar:phone-calling-bold" className="mr-2" width={20} />
                Nhắn tin Zalo ngay
              </Button>
              <button 
                onClick={() => setOpenModal(false)}
                className="text-sm text-gray-400 hover:text-gray-600 font-medium underline"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default ZaloFloatButton;