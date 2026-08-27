import React from "react";

type Props = {
  success: number;
  duplicates: string[];
  title?: string;
  onClose: () => void;
};

const ImportResultModal: React.FC<Props> = ({
  success,
  duplicates,
  title = "Kết quả Import Excel",
  onClose,
}) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 text-dark">
      <div className="bg-white rounded-lg shadow-lg w-[500px] max-h-[80vh] flex flex-col">

        {/* header */}
        <div className="p-4 border-b font-semibold text-lg">
          {title}
        </div>

        {/* body */}
        <div className="p-4 space-y-3 overflow-hidden">

          <div className="text-green-600">
            ✔ Import thành công: <b>{success}</b> dòng
          </div>

          <div className="text-red-600">
            ⚠ Trùng dữ liệu: <b>{duplicates.length}</b> dòng
          </div>

          {duplicates.length > 0 && (
            <div>
              <div className="font-medium mb-1">
                Danh sách mã trùng:
              </div>

              <div className="border rounded p-2 max-h-40 overflow-y-auto text-sm bg-gray-50">
                {duplicates.map((item, i) => (
                  <div key={i}>{item}</div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* footer */}
        <div className="p-3 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};

export default ImportResultModal;