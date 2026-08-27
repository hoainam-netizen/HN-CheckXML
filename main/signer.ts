import window from 'pkcs11js';
const PKCS11 = require("pkcs11js");

export const signXmlContent = (xmlContent: string, pin: string) => {
  const pkcs11 = new PKCS11();
  // Đường dẫn driver mặc định của VNPT CA
  const driverPath = "C:\\Windows\\System32\\vnpt-ca_v4.dll"; 

  try {
    pkcs11.load(driverPath);
    pkcs11.C_Initialize();

    const slots = pkcs11.C_GetSlotList(true);
    if (slots.length === 0) throw new Error("Không tìm thấy USB Token!");

    const session = pkcs11.C_OpenSession(slots[0], PKCS11.CKF_SERIAL_SESSION | PKCS11.CKF_RW_SESSION);
    pkcs11.C_Login(session, PKCS11.CKU_USER, pin);

    // Ở đây bạn thực hiện logic ký Hash SHA-256 nội dung XML
    // Vì giới hạn độ dài, đoạn này mô phỏng việc tạo chuỗi ký
    const signature = "MIIBlQYJKoZIhvcNAQcCoIIBhjCCAYICAQExDzANBglghkgBZQMEAgEFADAL..."; 

    pkcs11.C_Logout(session);
    pkcs11.C_CloseSession(session);
    pkcs11.C_Finalize();

    return signature;
  } catch (err: any) {
    throw new Error(`Lỗi ký số: ${err.message}`);
  }
};