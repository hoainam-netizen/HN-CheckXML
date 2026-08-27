import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Alert, Button, Card, Col, Form, Input, Modal, Row, Space, Spin, Tag, Typography } from "antd";
import { Copy, Database, KeyRound, RefreshCcw, Search, ShieldCheck, ShieldAlert, CreditCard, UserRound, CalendarDays, BadgeCheck, ClipboardList, CircleDollarSign } from "lucide-react";
import { toast } from "react-toastify";


const { Title, Text } = Typography;

const STORAGE_KEY = "bhyt-tracuu-session";
const PROVIDER_STORAGE_KEY = "bhyt-tracuu-provider";
const PROVIDER_FILE_NAME = "bhyt-tracuu-provider";
const DEFAULT_USERNAME = "40594_BV";
const DEFAULT_PASSWORD = "71d173a729cba67f47e4a1b6b2db4605";
const MCCT_ENDPOINT = "https://egw.baohiemxahoi.gov.vn/api/TraCuuCCT/TraCuuTienMCCT";
const DEFAULT_PROVIDER = {
  hoTenCb: "Chu Tiến Dũng",
  cccdCb: "040073013103",
};

const COPY_FIELDS = ["maThe", "hoTen", "ngaySinh", "gioiTinh", "diaChi", "gtTheTu", "gtTheDen", "maDKBD", "tenDKBDMoi", "ngayDu5Nam"] as const;

type SessionData = {
  username: string;
  password: string;
  token: string;
  idToken: string;
};

type ProviderData = {
  hoTenCb: string;
  cccdCb: string;
};

type CardResult = Record<string, any>;
type LookupFormValues = {
  maKcb?: string;
  maThe: string;
  hoTen: string;
  ngaySinh: string;
};

const extractValueByKeys = (data: any, keys: string[]): any => {
  if (!data || typeof data !== "object") return undefined;

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined && data[key] !== null && String(data[key]).trim() !== "") {
      return data[key];
    }
  }

  for (const value of Object.values(data)) {
    const nested = extractValueByKeys(value, keys);
    if (nested !== undefined) return nested;
  }

  return undefined;
};

const getSavedSession = (): SessionData | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionData;
    if (!parsed?.token || !parsed?.idToken) return null;
    return parsed;
  } catch {
    return null;
  }
};

const getSavedProvider = (): ProviderData => {
  try {
    const raw = localStorage.getItem(PROVIDER_STORAGE_KEY);
    if (!raw) return DEFAULT_PROVIDER;
    const parsed = JSON.parse(raw) as Partial<ProviderData>;
    return {
      hoTenCb: parsed.hoTenCb || DEFAULT_PROVIDER.hoTenCb,
      cccdCb: parsed.cccdCb || DEFAULT_PROVIDER.cccdCb,
    };
  } catch {
    return DEFAULT_PROVIDER;
  }
};

const isExpiredCard = (result: CardResult) => {
  const expirationValue = result.gtTheDen || result.gtTheDenMoi;
  if (!expirationValue) return false;

  const parts = String(expirationValue).trim().split(/[/-]/).map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return false;

  const [first, second, third] = parts;
  const expirationDate = first > 31
    ? new Date(first, second - 1, third)
    : new Date(third, second - 1, first);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return expirationDate < today;
};

const normalizeBirthDate = (value: string | undefined) => {
  const text = String(value || "").trim();
  const parts = text.split(/[/-]/);
  if (parts.length !== 3) return text;

  const [day, month, year] = parts;
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) {
    return text;
  }

  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
};

const TraCuuTheBHYT = () => {
  const [username, setUsername] = useState(DEFAULT_USERNAME);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [provider, setProvider] = useState<ProviderData>(() => getSavedProvider());
  const [providerLoaded, setProviderLoaded] = useState(false);
  const [session, setSession] = useState<SessionData | null>(() => getSavedSession());
  const [loadingToken, setLoadingToken] = useState(false);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [result, setResult] = useState<CardResult | null>(null);
  const [mcctAmount, setMcctAmount] = useState<string | null>(null);
  const [currentMaKcb, setCurrentMaKcb] = useState<string | null>(null);
  const [loadingUpdateLuyke, setLoadingUpdateLuyke] = useState(false);
  const [loadingKcb, setLoadingKcb] = useState(false);
  const [resultPopupOpen, setResultPopupOpen] = useState(false);
  const [lookupForm] = Form.useForm();
  const maKcbValue = Form.useWatch("maKcb", lookupForm) || "";
  const cardLookupValues = Form.useWatch(["maThe", "hoTen", "ngaySinh"], lookupForm) || [];
  const hasCardLookupValue = cardLookupValues.some((value: string) => String(value || "").trim() !== "");

  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const loadProviderFile = async () => {
      if (!window.electronAPI?.readJsonFile) {
        if (!cancelled) setProviderLoaded(true);
        return;
      }

      try {
        const savedProvider = await window.electronAPI.readJsonFile(PROVIDER_FILE_NAME) as Partial<ProviderData> | null;
        if (!cancelled && savedProvider) {
          setProvider({
            hoTenCb: savedProvider.hoTenCb || DEFAULT_PROVIDER.hoTenCb,
            cccdCb: savedProvider.cccdCb || DEFAULT_PROVIDER.cccdCb,
          });
        }
      } catch {
        // Keep localStorage/default provider when the JSON file is not available.
      } finally {
        if (!cancelled) setProviderLoaded(true);
      }
    };

    loadProviderFile();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!providerLoaded) return;

    localStorage.setItem(PROVIDER_STORAGE_KEY, JSON.stringify(provider));
    window.electronAPI?.saveJson(PROVIDER_FILE_NAME, provider);
  }, [provider, providerLoaded]);

  const fetchFreshSession = async (): Promise<SessionData> => {
    setLoadingToken(true);

    try {
      const response = await axios.post(
        "https://egw.baohiemxahoi.gov.vn/api/token/take",
        { username, password },
        { headers: { "Content-Type": "application/json" } }
      );

      const token = extractValueByKeys(response.data, ["token", "access_token", "jwt", "authToken"]);
      const idToken = extractValueByKeys(response.data, ["id_token", "idToken", "tokenId"]);

      if (!token || !idToken) {
        throw new Error("Phản hồi từ hệ thống không chứa token hoặc id_token hợp lệ.");
      }

      const nextSession: SessionData = {
        username,
        password,
        token: String(token),
        idToken: String(idToken),
      };

      setSession(nextSession);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
      toast.success("Đã lấy lại phiên làm việc thành công.");
      return nextSession;
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || "Không lấy được phiên làm việc.";
      toast.error(`Lỗi lấy phiên làm việc: ${message}`);
      throw error;
    } finally {
      setLoadingToken(false);
    }
  };

  const handleRefreshSession = async () => {
    await fetchFreshSession();
  };

  const buildLookupUrl = (activeSession: SessionData) => {
    const params = new URLSearchParams({
      username: activeSession.username,
      password: activeSession.password,
      token: activeSession.token,
      id_token: activeSession.idToken,
    });

    return `https://egw.baohiemxahoi.gov.vn/api/egw/KQNhanLichSuKCB2024?${params.toString()}`;
  };

  const handleLookup = async (values: LookupFormValues) => {
    try {
      setCurrentMaKcb(values.maKcb?.trim() || null);
      let activeSession = session;

      if (!activeSession?.token || !activeSession?.idToken) {
        activeSession = await fetchFreshSession();
      }

      setLoadingLookup(true);
      setMcctAmount(null);

      const normalizedBirthDate = normalizeBirthDate(values.ngaySinh);
      if (normalizedBirthDate !== values.ngaySinh) {
        lookupForm.setFieldsValue({ ngaySinh: normalizedBirthDate });
      }

      const payload = {
        maThe: values.maThe?.trim() || "",
        hoTen: values.hoTen?.trim() || "",
        ngaySinh: normalizedBirthDate,
        hoTenCb: provider.hoTenCb.trim(),
        cccdCb: provider.cccdCb.trim(),
      };

      const response = await axios.post(buildLookupUrl(activeSession), payload, {
        headers: { "Content-Type": "application/json" },
      });

      const apiData = response?.data && typeof response.data === "object" ? response.data : {};
      const normalized = Array.isArray(apiData) ? apiData[0] || {} : apiData;

      const lookupCode = extractValueByKeys(normalized, ["maKetQua", "MaKetQua", "code", "Code"]);
      const lookupNote = extractValueByKeys(normalized, ["ghiChu", "GhiChu", "message", "Message"]);
      const hasValidCardMessage = String(lookupNote || "").toLowerCase().includes("thẻ còn giá trị sử dụng");
      const lookupSucceeded = ["000", "200"].includes(String(lookupCode)) || hasValidCardMessage;

      if (!lookupSucceeded) {
        setResult(null);
        setMcctAmount(null);
        setResultPopupOpen(false);
        toast.warning(String(lookupNote || "Không tìm thấy thông tin thẻ."));
        return;
      }

      setResult(normalized || {});

      try {
        const mcctPayload = {
          username: activeSession.username,
          maThe: values.maThe?.trim() || "",
          hoTen: values.hoTen?.trim() || "",
          ngaySinh: normalizedBirthDate,
        };
        const mcctHeaders = {
          "Content-Type": "application/json",
          accessToken: activeSession.token,
          tokenId: activeSession.idToken,
          passwordHash: activeSession.password,
        };
        const mcctResponse = window.electronAPI?.lookupMcct
          ? await window.electronAPI.lookupMcct({ payload: mcctPayload, headers: mcctHeaders })
          : (await axios.post(MCCT_ENDPOINT, mcctPayload, { headers: mcctHeaders })).data;

        const mcctData = mcctResponse;
        const firstCctRecord = Array.isArray(mcctData?.DataCCT) ? mcctData.DataCCT[0] : null;
        const amount = firstCctRecord?.tBNCCTLuyKe;
        if (amount !== undefined && amount !== null && String(amount).trim() !== "") {
          setMcctAmount(String(amount));
        }
      } catch (error: any) {
        const message = error?.response?.data?.GhiChu || error?.response?.data?.message || error?.message;
        console.error("Lỗi tra cứu tiền MCCT:", error);
        toast.warning(message ? `Không lấy được thông tin tiền MCCT: ${message}` : "Không lấy được thông tin tiền MCCT.");
      }

      setResultPopupOpen(true);
      toast.success("Tra cứu thẻ thành công.");
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || "Lỗi khi tra cứu thẻ.";
      toast.error(`Lỗi tra cứu thẻ: Kiểm tra lại phiên làm việc/Hoặc thông tin người tra cứu`);
    } finally {
      setLoadingLookup(false);
    }
  };

  const handleKcbLookup = async ({ maKcb }: LookupFormValues) => {
    const inputMaKcb = maKcb?.trim() || "";
    const normalizedMaKcb = inputMaKcb.length === 5
      ? `26000${inputMaKcb}`
      : inputMaKcb.length === 4
        ? `260000${inputMaKcb}`
        : inputMaKcb;
    if (!normalizedMaKcb) {
      toast.warning("Vui lòng nhập Mã KCB.");
      return;
    }

    if (normalizedMaKcb !== inputMaKcb) {
      lookupForm.setFieldsValue({ maKcb: normalizedMaKcb });
    }

    setLoadingKcb(true);
    try {
      if (!window.electronAPI?.queryPatientByMaKcb) {
        throw new Error("Chức năng này chỉ hỗ trợ trên ứng dụng Electron.");
      }
      const records = await window.electronAPI.queryPatientByMaKcb(normalizedMaKcb);
      if (records.length === 0) {
        toast.warning(`Không tìm thấy bệnh nhân trong CSDL với Mã KCB: ${normalizedMaKcb}.`);
      } else {
        const firstRecord = records[0];
        const lookupValues = {
          maThe: firstRecord.socmnd || "",
          hoTen: firstRecord.hoten || "",
          ngaySinh: normalizeBirthDate(firstRecord.ngaysinhTEXT),
        };

        lookupForm.setFieldsValue(lookupValues);
        await handleLookup({ ...lookupValues, maKcb: normalizedMaKcb });
      }
    } catch (error: any) {
      toast.error(`Lỗi tìm Mã KCB: ${error?.message || "Không thể kết nối cơ sở dữ liệu."}`);
    } finally {
      setLoadingKcb(false);
    }
  };

  const handleUpdateLuyke = async () => {
    if (!currentMaKcb || !mcctAmount || !window.electronAPI?.updatePatientLuyke) return;

    setLoadingUpdateLuyke(true);
    try {
      const updateResult = await window.electronAPI.updatePatientLuyke({
        maKcb: currentMaKcb,
        luyke: mcctAmount.replace(/,/g, ""),
      });
      if (updateResult.affectedRows > 0) {
        toast.success(`Đã cập nhật lũy kế MCCT vào CSDL cho Mã KCB ${currentMaKcb}.`);
      } else {
        toast.warning(`Không tìm thấy bản ghi CSDL với Mã KCB ${currentMaKcb}.`);
      }
    } catch (error: any) {
      toast.error(`Không thể cập nhật lũy kế MCCT vào CSDL: ${error?.message || "Lỗi kết nối CSDL."}`);
    } finally {
      setLoadingUpdateLuyke(false);
    }
  };

  const copyValue = async (label: string, value: any) => {
    if (value === undefined || value === null || String(value).trim() === "") {
      toast.warning(`Không có dữ liệu để sao chép cho ${label}.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(String(value));
      toast.success(`${label} đã được sao chép.`);
    } catch {
      toast.error(`Không thể sao chép ${label}.`);
    }
  };

  const resultFields = useMemo(() => {
    if (!result) return [];

    const fields: Array<{ key: string; label: string; value: any }> = [];

    const pushField = (key: string, label: string) => {
      const value = result[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        fields.push({ key, label, value });
      }
    };

    pushField("maThe", "Mã thẻ");
    pushField("hoTen", "Họ tên");
    pushField("ngaySinh", "Ngày sinh");
    pushField("gioiTinh", "Giới tính");

    const gtTu = result.gtTheTu || result.gtTheTuMoi;
    const gtDen = result.gtTheDen || result.gtTheDenMoi;
    if (gtTu) pushField("gtTheTu", "Từ ngày");
    if (gtDen) pushField("gtTheDen", "Đến ngày");
    pushField("ngayDu5Nam", "Ngày đủ 5 năm");
    pushField("diaChi", "Địa chỉ");
    pushField("maDKBD", "Mã nơi KCBBĐ");
    pushField("tenDKBDMoi", "Tên ĐKBĐ");

    return fields;
  }, [result]);

  const cardExpired = result ? isExpiredCard(result) : false;

  return (
    <div
      style={{
        minHeight: "100vh",
        // background:
        //   "radial-gradient(circle at 10% 0%, rgba(34,197,94,0.10), transparent 28%), radial-gradient(circle at 90% 10%, rgba(16,185,129,0.08), transparent 25%), #f6f9f7",
        padding: "28px 20px 50px",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>

        {/* ================= HEADER ================= */}
        <div
          style={{
            marginBottom: 28,
            padding: "26px 30px",
            borderRadius: 24,
            background:
              "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)",
            border: "1px solid #dcefe4",
            boxShadow: "0 14px 40px rgba(15, 23, 42, 0.06)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative circle */}
          <div
            style={{
              position: "absolute",
              width: 180,
              height: 180,
              borderRadius: "50%",
              background: "rgba(34,197,94,0.07)",
              right: -60,
              top: -80,
            }}
          />

          <div
            style={{
              position: "absolute",
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: "rgba(16,185,129,0.06)",
              right: 100,
              bottom: -70,
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <Space align="center" size={12}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background:
                    "linear-gradient(135deg, #16a34a 0%, #059669 100%)",
                  color: "#fff",
                  boxShadow: "0 8px 18px rgba(22,163,74,0.25)",
                }}
              >
                <Search size={22} />
              </div>

              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#16a34a",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 4,
                  }}
                >
                  Hệ thống BHYT
                </div>

                <Title
                  level={2}
                  style={{
                    margin: 0,
                    color: "#123c2e",
                    fontSize: 28,
                    fontWeight: 800,
                  }}
                >
                  Tra cứu thẻ BHYT (Áp dụng tại Phòng khám Đa khoa Đông Hiếu)
                </Title>
              </div>
            </Space>

            <Text
              style={{
                display: "block",
                marginTop: 14,
                maxWidth: 760,
                color: "#64748b",
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              Lấy phiên làm việc từ hệ thống BHXH, tra cứu thông tin thẻ
              và sao chép nhanh các trường thông tin cần thiết.
            </Text>
          </div>
        </div>

        {/* ================= INPUT AREA ================= */}
        <Row
          gutter={[24, 24]}
          align="stretch"
          style={{
            position: "relative",
          }}
        >
          {/* =========================================================
      SESSION CARD
  ========================================================= */}
          <Col xs={24} lg={9} style={{ display: "flex" }}>
            <Card
              bordered={false}
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 24,
                overflow: "hidden",
                background: "#ffffff",
                border: "1px solid #e3eee8",
                boxShadow: "0 12px 40px rgba(15, 23, 42, 0.06)",
                position: "relative",
              }}
              styles={{
                header: {
                  padding: 0,
                  borderBottom: "1px solid #edf3ef",
                },
                body: {
                  padding: 0,
                },
              }}
            >
              {/* Decorative background */}
              <div
                style={{
                  position: "absolute",
                  top: -70,
                  right: -70,
                  width: 180,
                  height: 180,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(22,163,74,0.10) 0%, rgba(22,163,74,0) 70%)",
                  pointerEvents: "none",
                }}
              />

              <div
                style={{
                  position: "absolute",
                  bottom: -80,
                  left: -80,
                  width: 220,
                  height: 220,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(5,150,105,0.08) 0%, rgba(5,150,105,0) 70%)",
                  pointerEvents: "none",
                }}
              />

              {/* Header */}
              <div
                style={{
                  padding: "22px 24px",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      minWidth: 48,
                      borderRadius: 15,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background:
                        "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
                      color: "#059669",
                      border: "1px solid #bbf7d0",
                      boxShadow: "0 6px 16px rgba(5,150,105,0.10)",
                    }}
                  >
                    <KeyRound size={21} strokeWidth={2.2} />
                  </div>

                  <div>
                    <div
                      style={{
                        color: "#123b2e",
                        fontSize: 17,
                        fontWeight: 800,
                        lineHeight: 1.25,
                        letterSpacing: "-0.2px",
                      }}
                    >
                      Phiên làm việc
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        color: "#94a3b8",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      Xác thực hệ thống BHXH
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div
                style={{
                  padding: "22px 24px 24px",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <Form
                  layout="vertical"
                  initialValues={{
                    username: DEFAULT_USERNAME,
                    password: DEFAULT_PASSWORD,
                  }}
                >
                  {/* USERNAME */}
                  {/* <Form.Item
                    label={
                      <span
                        style={{
                          color: "#334e43",
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        Tên đăng nhập
                      </span>
                    }
                    style={{ marginBottom: 18 }}
                  >
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      prefix={
                        <span
                          style={{
                            color: "#94a3b8",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <User size={16} />
                        </span>
                      }
                      placeholder="Nhập tên đăng nhập"
                      style={{
                        height: 46,
                        borderRadius: 13,
                        borderColor: "#d8e7df",
                        background: "#fbfefc",
                        fontSize: 13,
                      }}
                    />
                  </Form.Item> */}

                  {/* PASSWORD */}
                  {/* <Form.Item
                    label={
                      <span
                        style={{
                          color: "#334e43",
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        Mật khẩu
                      </span>
                    }
                    style={{ marginBottom: 20 }}
                  >
                    <Input.Password
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      prefix={
                        <span
                          style={{
                            color: "#94a3b8",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <LockKeyhole size={16} />
                        </span>
                      }
                      placeholder="Nhập mật khẩu"
                      style={{
                        height: 46,
                        borderRadius: 13,
                        borderColor: "#d8e7df",
                        background: "#fbfefc",
                        fontSize: 13,
                      }}
                    />
                  </Form.Item> */}

                  {/* LOOKUP STAFF */}
                  <Form.Item
                    label={
                      <span
                        style={{
                          color: "#334e43",
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        Họ tên người dùng tra cứu
                      </span>
                    }
                    style={{ marginBottom: 18 }}
                  >
                    <Input
                      value={provider.hoTenCb}
                      onChange={(event) => setProvider((current) => ({ ...current, hoTenCb: event.target.value }))}
                      prefix={<UserRound size={16} color="#94a3b8" />}
                      placeholder="Nhập họ tên cán bộ"
                      style={{
                        height: 46,
                        borderRadius: 13,
                        borderColor: "#d8e7df",
                        background: "#fbfefc",
                        fontSize: 13,
                      }}
                    />
                  </Form.Item>

                  <Form.Item
                    label={
                      <span
                        style={{
                          color: "#334e43",
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        CCCD người dùng tra cứu
                      </span>
                    }
                    style={{ marginBottom: 20 }}
                  >
                    <Input
                      value={provider.cccdCb}
                      onChange={(event) => setProvider((current) => ({ ...current, cccdCb: event.target.value }))}
                      prefix={<CreditCard size={16} color="#94a3b8" />}
                      placeholder="Nhập CCCD cán bộ"
                      style={{
                        height: 46,
                        borderRadius: 13,
                        borderColor: "#d8e7df",
                        background: "#fbfefc",
                        fontSize: 13,
                      }}
                    />
                  </Form.Item>

                  {/* REFRESH SESSION */}
                  <Button
                    block
                    type="primary"
                    icon={<RefreshCcw size={16} />}
                    onClick={handleRefreshSession}
                    loading={loadingToken}
                    style={{
                      height: 46,
                      border: 0,
                      borderRadius: 13,
                      fontWeight: 700,
                      fontSize: 13,
                      background:
                        "linear-gradient(135deg, #16a34a 0%, #059669 55%, #0d9488 100%)",
                      boxShadow: "0 8px 22px rgba(5,150,105,0.20)",
                    }}
                  >
                    Lấy lại phiên làm việc
                  </Button>

                  {/* SESSION STATUS */}
                  <div
                    style={{
                      marginTop: 20,
                      padding: "15px 16px",
                      borderRadius: 15,
                      background: session
                        ? "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)"
                        : "linear-gradient(135deg, #fffbeb 0%, #fefce8 100%)",
                      border: session
                        ? "1px solid #bbf7d0"
                        : "1px solid #fde68a",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          minWidth: 34,
                          borderRadius: 10,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: session ? "#dcfce7" : "#fef3c7",
                        }}
                      >
                        {session ? (
                          <ShieldCheck size={18} color="#16a34a" />
                        ) : (
                          <ShieldAlert size={18} color="#d97706" />
                        )}
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: session ? "#15803d" : "#a16207",
                          }}
                        >
                          {session
                            ? "Phiên làm việc còn hiệu lực"
                            : "Chưa có phiên làm việc"}
                        </div>

                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 11,
                            lineHeight: 1.5,
                            color: session ? "#4d7c5b" : "#92722a",
                          }}
                        >
                          {session
                            ? "Có thể thực hiện tra cứu thông tin BHYT."
                            : "Vui lòng lấy phiên trước khi thực hiện tra cứu."}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECURITY INFO */}
                  <div
                    style={{
                      marginTop: 18,
                      paddingTop: 16,
                      borderTop: "1px dashed #dce9e2",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#94a3b8",
                      fontSize: 11,
                    }}
                  >
                    <ShieldCheck size={14} color="#16a34a" />
                    <span>
                      Kết nối được xác thực trước khi gửi yêu cầu BHXH
                    </span>
                  </div>
                </Form>
              </div>

              {/* Bottom decoration */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 8,
                  background:
                    "linear-gradient(90deg, #16a34a 0%, #059669 50%, #0d9488 100%)",
                }}
              />
            </Card>
          </Col>

          {/* =========================================================
      LOOKUP CARD
  ========================================================= */}
          <Col xs={24} lg={15} style={{ display: "flex" }}>
            <Card
              bordered={false}
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 24,
                overflow: "hidden",
                background: "#ffffff",
                border: "1px solid #e3eee8",
                boxShadow: "0 12px 40px rgba(15, 23, 42, 0.06)",
                position: "relative",
              }}
              styles={{
                header: {
                  padding: 0,
                  borderBottom: "1px solid #edf3ef",
                },
                body: {
                  padding: 0,
                },
              }}
            >
              {/* Decorative background */}
              <div
                style={{
                  position: "absolute",
                  top: -90,
                  right: -80,
                  width: 220,
                  height: 220,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0) 70%)",
                  pointerEvents: "none",
                }}
              />

              {/* HEADER */}
              <div
                style={{
                  padding: "22px 24px",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      minWidth: 48,
                      borderRadius: 15,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background:
                        "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
                      color: "#2563eb",
                      border: "1px solid #bfdbfe",
                      boxShadow: "0 6px 16px rgba(37,99,235,0.10)",
                    }}
                  >
                    <Search size={22} strokeWidth={2.2} />
                  </div>

                  <div>
                    <div
                      style={{
                        color: "#173b30",
                        fontSize: 17,
                        fontWeight: 800,
                        lineHeight: 1.25,
                      }}
                    >
                      Tra cứu thông tin BHYT
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        color: "#94a3b8",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      Tra cứu nhanh theo Mã KCB hoặc thông tin thẻ
                    </div>
                  </div>
                </div>
              </div>

              {/* BODY */}
              <div
                style={{
                  padding: "22px 24px 24px",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <Form
                  form={lookupForm}
                  layout="vertical"
                  onFinish={(values: LookupFormValues) =>
                    values.maKcb?.trim()
                      ? handleKcbLookup(values)
                      : handleLookup(values)
                  }
                  initialValues={{
                    maKcb: "",
                    maThe: "",
                    hoTen: "",
                    ngaySinh: "",
                  }}
                >
                  {/* =====================================================
              KCB SEARCH
          ===================================================== */}
                  <div
                    style={{
                      borderRadius: 17,
                      border: "1px solid #dbeafe",
                      background:
                        "linear-gradient(135deg, #f8fbff 0%, #eff6ff 100%)",
                      padding: "18px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 14,
                        gap: 12,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: "#1d4ed8",
                          }}
                        >
                          Tra cứu theo Mã KCB
                        </div>

                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 11,
                            color: "#64748b",
                          }}
                        >
                          Nhập mã KCB để tự động lấy thông tin thẻ
                        </div>
                      </div>

                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 11,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#ffffff",
                          border: "1px solid #bfdbfe",
                          color: "#2563eb",
                        }}
                      >
                        <Search size={17} />
                      </div>
                    </div>

                    <Form.Item
                      label={
                        <span
                          style={{
                            color: "#334e43",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          Mã KCB
                        </span>
                      }
                      name="maKcb"
                      style={{ marginBottom: 0 }}
                    >
                      <Input
                        placeholder="Nhập Mã KCB"
                        disabled={hasCardLookupValue}
                        prefix={
                          <span
                            style={{
                              color: "#94a3b8",
                              display: "flex",
                            }}
                          >
                            <Search size={17} />
                          </span>
                        }
                        allowClear
                        style={{
                          height: 46,
                          borderRadius: 13,
                          borderColor: "#bfdbfe",
                          background: "#ffffff",
                          fontSize: 13,
                        }}
                      />
                    </Form.Item>
                  </div>

                  {/* =====================================================
              DIVIDER
          ===================================================== */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      margin: "20px 0",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background:
                          "linear-gradient(90deg, transparent, #dbe7e0)",
                      }}
                    />

                    <div
                      style={{
                        padding: "5px 13px",
                        borderRadius: 999,
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        color: "#16a34a",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: 0.5,
                      }}
                    >
                      HOẶC
                    </div>

                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background:
                          "linear-gradient(90deg, #dbe7e0, transparent)",
                      }}
                    />
                  </div>

                  {/* =====================================================
              CARD INFORMATION SEARCH
          ===================================================== */}
                  <div
                    style={{
                      borderRadius: 17,
                      border: "1px solid #d9eee2",
                      background:
                        "linear-gradient(135deg, #fbfffc 0%, #f0fdf4 100%)",
                      padding: "18px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 16,
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#dcfce7",
                          color: "#16a34a",
                        }}
                      >
                        <CreditCard size={17} />
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: "#15803d",
                          }}
                        >
                          Tra cứu theo thông tin thẻ
                        </div>

                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 11,
                            color: "#64748b",
                          }}
                        >
                          Sử dụng khi không có Mã KCB
                        </div>
                      </div>
                    </div>

                    <Row gutter={[14, 0]}>
                      {/* MÃ THẺ */}
                      <Col xs={24} md={8}>
                        <Form.Item
                          label={
                            <span
                              style={{
                                color: "#334e43",
                                fontWeight: 700,
                                fontSize: 12,
                              }}
                            >
                              Số CCCD/BHXH
                            </span>
                          }
                          name="maThe"
                          style={{ marginBottom: 0 }}
                        >
                          <Input
                            placeholder="Nhập mã thẻ"
                            disabled={String(maKcbValue).trim() !== ""}
                            prefix={
                              <span
                                style={{
                                  color: "#94a3b8",
                                  display: "flex",
                                }}
                              >
                                <CreditCard size={16} />
                              </span>
                            }
                            allowClear
                            style={{
                              height: 46,
                              borderRadius: 13,
                              borderColor: "#d8e7df",
                              background: "#ffffff",
                              fontSize: 13,
                            }}
                          />
                        </Form.Item>
                      </Col>

                      {/* HỌ TÊN */}
                      <Col xs={24} md={8}>
                        <Form.Item
                          label={
                            <span
                              style={{
                                color: "#334e43",
                                fontWeight: 700,
                                fontSize: 12,
                              }}
                            >
                              Họ tên
                            </span>
                          }
                          name="hoTen"
                          style={{ marginBottom: 0 }}
                        >
                          <Input
                            placeholder="Nhập họ và tên"
                            disabled={String(maKcbValue).trim() !== ""}
                            prefix={
                              <span
                                style={{
                                  color: "#94a3b8",
                                  display: "flex",
                                }}
                              >
                                <UserRound size={16} />
                              </span>
                            }
                            allowClear
                            style={{
                              height: 46,
                              borderRadius: 13,
                              borderColor: "#d8e7df",
                              background: "#ffffff",
                              fontSize: 13,
                            }}
                          />
                        </Form.Item>
                      </Col>

                      {/* NGÀY SINH */}
                      <Col xs={24} md={8}>
                        <Form.Item
                          label={
                            <span
                              style={{
                                color: "#334e43",
                                fontWeight: 700,
                                fontSize: 12,
                              }}
                            >
                              Ngày sinh
                            </span>
                          }
                          name="ngaySinh"
                          style={{ marginBottom: 0 }}
                        >
                          <Input
                            placeholder="dd/mm/yyyy"
                            disabled={String(maKcbValue).trim() !== ""}
                            prefix={
                              <span
                                style={{
                                  color: "#94a3b8",
                                  display: "flex",
                                }}
                              >
                                <CalendarDays size={16} />
                              </span>
                            }
                            allowClear
                            style={{
                              height: 46,
                              borderRadius: 13,
                              borderColor: "#d8e7df",
                              background: "#ffffff",
                              fontSize: 13,
                            }}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>

                  {/* =====================================================
              ACTION AREA
          ===================================================== */}
                  <div
                    style={{
                      marginTop: 20,
                      padding: "18px",
                      borderRadius: 17,
                      background:
                        "linear-gradient(135deg, #f8fffa 0%, #f0fdf4 100%)",
                      border: "1px solid #ccebd8",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <Button
                        type="primary"
                        htmlType="submit"
                        icon={<Search size={17} />}
                        loading={loadingLookup || loadingKcb}
                        disabled={!session}
                        style={{
                          width: "min(100%, 360px)",
                          height: 48,
                          border: 0,
                          borderRadius: 13,
                          fontWeight: 800,
                          fontSize: 13,
                          background:
                            "linear-gradient(135deg, #16a34a 0%, #059669 55%, #0d9488 100%)",
                          boxShadow:
                            "0 10px 24px rgba(5,150,105,0.22)",
                        }}
                      >
                        Tra cứu thẻ
                      </Button>

                      {result && (
                        <Button
                          type="default"
                          icon={<BadgeCheck size={16} />}
                          onClick={() => setResultPopupOpen(true)}
                          style={{
                            width: "min(100%, 360px)",
                            height: 42,
                            borderRadius: 13,
                            borderColor: "#86efac",
                            color: "#15803d",
                            fontWeight: 700,
                          }}
                        >
                          Mở lại popup kết quả
                        </Button>
                      )}

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          color: session ? "#64748b" : "#d97706",
                          fontSize: 11,
                        }}
                      >
                        <ShieldCheck
                          size={13}
                          color={session ? "#16a34a" : "#d97706"}
                        />

                        {session
                          ? "Thông tin được gửi qua phiên BHXH đã xác thực"
                          : "Vui lòng lấy phiên làm việc trước khi tra cứu"}
                      </div>
                    </div>
                  </div>
                </Form>
              </div>
            </Card>
          </Col>
        </Row>

        {/* ================= LOADING ================= */}
        {loadingLookup && (
          <Card
            bordered={false}
            style={{
              borderRadius: 20,
              textAlign: "center",
              padding: "45px 0",
              boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                margin: "0 auto",
                borderRadius: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#ecfdf5",
              }}
            >
              <Spin size="large" />
            </div>

            <div style={{ marginTop: 18 }}>
              <Text
                style={{
                  color: "#334155",
                  fontWeight: 600,
                }}
              >
                Đang tra cứu thông tin thẻ...
              </Text>
            </div>

            <Text
              type="secondary"
              style={{
                display: "block",
                marginTop: 5,
                fontSize: 12,
              }}
            >
              Vui lòng chờ trong giây lát
            </Text>
          </Card>
        )}

        {/* ================= RESULT ================= */}
        {false && !loadingLookup && result && (
          <Card
            bordered={false}
            style={{
              borderRadius: 20,
              boxShadow: "0 12px 35px rgba(15,23,42,0.07)",
              border: "1px solid #e5eee9",
              overflow: "hidden",
            }}
            styles={{
              body: {
                padding: 20,
              },
            }}
          >
            {/* Result top */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
                paddingBottom: 16,
                borderBottom: "1px solid #edf2ef",
              }}
            >
              <Space>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#ecfdf5",
                    color: "#16a34a",
                  }}
                >
                  <BadgeCheck size={20} />
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#173b30",
                    }}
                  >
                    Thông tin thẻ
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: "#94a3b8",
                      marginTop: 2,
                    }}
                  >
                    Dữ liệu trả về từ hệ thống BHXH
                  </div>
                </div>
              </Space>

              <Space size={8}>
                <Button
                  size="small"
                  type={resultPopupOpen ? "primary" : "default"}
                  onClick={() => setResultPopupOpen((open) => !open)}
                >
                  {resultPopupOpen ? "Tắt popup" : "Bật popup"}
                </Button>
                <Tag
                  color="success"
                  style={{
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontWeight: 600,
                  }}
                >
                  Đã tra cứu
                </Tag>
              </Space>
            </div>

            {/* Note */}
            {mcctAmount && (
              <Alert
                style={{
                  marginBottom: 20,
                  borderRadius: 18,
                  border: "1px solid #bae6fd",
                  background:
                    "linear-gradient(135deg, #f0f9ff 0%, #ecfeff 55%, #f0fdf4 100%)",
                  boxShadow: "0 6px 20px rgba(14, 165, 233, 0.08)",
                  padding: "14px 18px",
                }}
                type="info"
                showIcon
                icon={
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "linear-gradient(135deg, #0284c7, #0891b2)",
                      boxShadow: "0 5px 12px rgba(2, 132, 199, 0.22)",
                      color: "#fff",
                    }}
                  >
                    <Database size={19} strokeWidth={2.2} />
                  </div>
                }
                message={
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      width: "100%",
                    }}
                  >
                    {/* Thông tin tiền MCCT */}
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#64748b",
                          marginBottom: 3,
                          textTransform: "uppercase",
                          letterSpacing: "0.35px",
                        }}
                      >
                        Tiền MCCT lũy kế
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 20,
                            lineHeight: 1.2,
                            fontWeight: 800,
                            color: "#075985",
                            letterSpacing: "-0.3px",
                          }}
                        >
                          {mcctAmount}
                        </span>

                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#64748b",
                          }}
                        >
                          VNĐ
                        </span>
                      </div>
                    </div>

                    {/* Các nút thao tác */}
                    <Space
                      size={6}
                      style={{
                        flexShrink: 0,
                      }}
                    >
                      <Button
                        size="small"
                        icon={<Copy size={14} strokeWidth={2} />}
                        onClick={() =>
                          copyValue(
                            "Tiền MCCT lũy kế",
                            mcctAmount!.replace(/,/g, "")
                          )
                        }
                        title="Sao chép tiền MCCT lũy kế"
                        style={{
                          height: 34,
                          padding: "0 12px",
                          borderRadius: 9,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#0369a1",
                          background: "#ffffff",
                          border: "1px solid #bae6fd",
                          boxShadow: "0 2px 5px rgba(15, 23, 42, 0.04)",
                        }}
                      >
                        Sao chép
                      </Button>

                      {currentMaKcb && (
                        <Button
                          size="small"
                          icon={<Database size={14} strokeWidth={2} />}
                          loading={loadingUpdateLuyke}
                          onClick={handleUpdateLuyke}
                          title="Nhập MCCT vào CSDL"
                          style={{
                            height: 34,
                            padding: "0 12px",
                            borderRadius: 9,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#047857",
                            background: "#f0fdf4",
                            border: "1px solid #bbf7d0",
                            boxShadow: "0 2px 5px rgba(15, 23, 42, 0.04)",
                          }}
                        >
                          Nhập vào CSDL
                        </Button>
                      )}
                    </Space>
                  </div>
                }
              />
            )}

            {result!.ghiChu && (
              <Alert
                style={{
                  marginBottom: 20,
                  borderRadius: 14,
                  background: cardExpired
                    ? "linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)"
                    : "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
                  border: cardExpired ? "1px solid #fecaca" : "1px solid #bbf7d0",
                }}
                type={cardExpired ? "error" : "success"}
                showIcon
                message={
                  <span
                    style={{
                      fontWeight: 800,
                      color: cardExpired ? "#b91c1c" : "#166534",
                    }}
                  >
                    {cardExpired ? "Thẻ BHYT đã hết hạn" : "Thông báo"}
                  </span>
                }
                description={
                  <span
                    style={{
                      color: cardExpired ? "#dc2626" : "#15803d",
                      fontWeight: 600,
                      fontSize: 14,
                      lineHeight: 1.7,
                    }}
                  >
                    {result!.ghiChu}
                  </span>
                }
              />
            )}

            {/* Fields */}
            <Row gutter={[14, 14]}>
              {resultFields.map((field) => {
                const isCopyable = COPY_FIELDS.includes(
                  field.key as (typeof COPY_FIELDS)[number]
                );

                return (
                  <Col xs={24} sm={12} lg={8} xl={6} key={field.key}>
                    <div
                      style={{
                        height: "100%",
                        minHeight: 96,
                        padding: "13px 14px",
                        borderRadius: 14,
                        background:
                          "linear-gradient(180deg, #ffffff 0%, #f8fbf9 100%)",
                        border: "1px solid #e2ebe6",
                        boxShadow: "0 5px 15px rgba(15,23,42,0.025)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 9,
                        }}
                      >
                        <Text
                          strong
                          style={{
                            color: "#64748b",
                            fontSize: 10,
                            textTransform: "uppercase",
                            letterSpacing: 0.6,
                          }}
                        >
                          {field.label}
                        </Text>

                        {isCopyable && (
                          <Button
                            size="small"
                            type="text"
                            icon={<Copy size={14} />}
                            onClick={() =>
                              copyValue(field.label, field.value)
                            }
                            style={{
                              width: 28,
                              height: 28,
                              padding: 0,
                              borderRadius: 8,
                              color: "#2563eb",
                              background: "#eff6ff",
                            }}
                          />
                        )}
                      </div>

                      <div
                        style={{
                          color: "#0f172a",
                          fontSize: 14,
                          fontWeight: 650,
                          lineHeight: 1.55,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {String(field.value)}
                      </div>
                    </div>
                  </Col>
                );
              })}
            </Row>
          </Card>
        )}

        <Modal
          open={resultPopupOpen && Boolean(result)}
          onCancel={() => setResultPopupOpen(false)}
          footer={null}
          width={900}
          centered
          destroyOnClose
          styles={{
            content: {
              padding: 0,
              overflow: "hidden",
              borderRadius: 20,
              boxShadow: "0 20px 60px rgba(15, 23, 42, 0.18)",
            },
            body: {
              padding: 0,
            },
          }}
        >
          {result && (
            <div
              style={{
                background: "#f8fbf9",
                maxHeight: "calc(100vh - 70px)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* =====================================================
          HEADER
      ===================================================== */}
              <div
                style={{
                  position: "relative",
                  overflow: "hidden",
                  padding: "16px 22px",
                  background:
                    "linear-gradient(135deg, #064e3b 0%, #047857 48%, #059669 100%)",
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {/* Decorative circles */}
                <div
                  style={{
                    position: "absolute",
                    width: 140,
                    height: 140,
                    borderRadius: "50%",
                    right: -55,
                    top: -75,
                    background: "rgba(255,255,255,0.08)",
                  }}
                />

                <div
                  style={{
                    position: "absolute",
                    width: 90,
                    height: 90,
                    borderRadius: "50%",
                    right: 90,
                    bottom: -65,
                    background: "rgba(255,255,255,0.06)",
                  }}
                />

                <div
                  style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 15,
                  }}
                >
                  {/* LEFT */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        minWidth: 44,
                        borderRadius: 13,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(255,255,255,0.15)",
                        border: "1px solid rgba(255,255,255,0.22)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      <CreditCard size={21} strokeWidth={2.2} />
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 800,
                          lineHeight: 1.25,
                          letterSpacing: "-0.25px",
                        }}
                      >
                        Thông tin thẻ BHYT
                      </div>

                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 11,
                          color: "rgba(255,255,255,0.72)",
                        }}
                      >
                        Kết quả tra cứu từ hệ thống BHXH
                      </div>
                    </div>
                  </div>

                  {/* STATUS */}
                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: cardExpired
                        ? "rgba(239,68,68,0.18)"
                        : "rgba(255,255,255,0.14)",
                      border: cardExpired
                        ? "1px solid rgba(254,202,202,0.35)"
                        : "1px solid rgba(255,255,255,0.2)",
                      fontSize: 10,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: cardExpired ? "#fca5a5" : "#86efac",
                      }}
                    />

                    {cardExpired ? "THẺ HẾT HẠN" : "ĐÃ TRA CỨU"}
                  </div>
                </div>
              </div>

              {/* =====================================================
          SCROLL CONTENT
      ===================================================== */}
              <div
                style={{
                  padding: "16px 20px 14px",
                  overflowY: "auto",
                  flex: 1,
                }}
              >
                {/* ===================================================
            MCCT
        =================================================== */}
                {mcctAmount && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: "11px 14px",
                      borderRadius: 14,
                      background:
                        "linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)",
                      border: "1px solid #bfdbfe",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    {/* Thông tin MCCT */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          minWidth: 34,
                          borderRadius: 10,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#dbeafe",
                          color: "#2563eb",
                        }}
                      >
                        <CircleDollarSign size={17} />
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#64748b",
                            fontWeight: 700,
                            marginBottom: 1,
                            letterSpacing: "0.3px",
                          }}
                        >
                          TIỀN MCCT LŨY KẾ
                        </div>

                        <div
                          style={{
                            fontSize: 16,
                            color: "#1d4ed8",
                            fontWeight: 800,
                            lineHeight: 1.3,
                          }}
                        >
                          {mcctAmount} VNĐ
                        </div>
                      </div>
                    </div>

                    {/* Các nút thao tác */}
                    <Space
                      size={6}
                      style={{
                        flexShrink: 0,
                      }}
                    >
                      <Button
                        size="small"
                        icon={<Copy size={14} />}
                        onClick={() =>
                          copyValue(
                            "Tiền MCCT lũy kế",
                            mcctAmount.replace(/,/g, "")
                          )
                        }
                        style={{
                          height: 32,
                          padding: "0 11px",
                          borderRadius: 9,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          color: "#2563eb",
                          background: "#ffffff",
                          border: "1px solid #bfdbfe",
                          fontSize: 12,
                          fontWeight: 600,
                          boxShadow: "0 1px 3px rgba(37, 99, 235, 0.06)",
                        }}
                      >
                        Sao chép
                      </Button>

                      {currentMaKcb && (
                        <Button
                          size="small"
                          icon={<Database size={14} />}
                          loading={loadingUpdateLuyke}
                          onClick={handleUpdateLuyke}
                          style={{
                            height: 32,
                            padding: "0 11px",
                            borderRadius: 9,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            color: "#047857",
                            background: "#ffffff",
                            border: "1px solid #bbf7d0",
                            fontSize: 12,
                            fontWeight: 600,
                            boxShadow: "0 1px 3px rgba(5, 150, 105, 0.06)",
                          }}
                        >
                          Nhập vào CSDL
                        </Button>
                      )}
                    </Space>
                  </div>
                )}

                {/* ===================================================
            NOTICE
        =================================================== */}
                {result.ghiChu && (
                  <div
                    style={{
                      marginBottom: 14,
                      borderRadius: 15,
                      overflow: "hidden",
                      border: cardExpired
                        ? "1px solid #fecaca"
                        : "1px solid #bbf7d0",
                      background: cardExpired
                        ? "linear-gradient(135deg, #fff7f7 0%, #fff1f2 100%)"
                        : "linear-gradient(135deg, #f6fff9 0%, #ecfdf5 100%)",
                      boxShadow: cardExpired
                        ? "0 5px 18px rgba(239,68,68,0.06)"
                        : "0 5px 18px rgba(22,163,74,0.06)",
                    }}
                  >
                    <div
                      style={{
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      {/* ICON */}
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          minWidth: 40,
                          borderRadius: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: cardExpired ? "#fee2e2" : "#dcfce7",
                          color: cardExpired ? "#dc2626" : "#16a34a",
                          border: cardExpired
                            ? "1px solid #fecaca"
                            : "1px solid #bbf7d0",
                        }}
                      >
                        {cardExpired ? (
                          <ShieldAlert size={21} strokeWidth={2.2} />
                        ) : (
                          <ShieldCheck size={21} strokeWidth={2.2} />
                        )}
                      </div>

                      {/* CONTENT */}
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            marginBottom: 2,
                          }}
                        >
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: cardExpired
                                ? "#dc2626"
                                : "#16a34a",
                              flexShrink: 0,
                            }}
                          />

                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 800,
                              color: cardExpired
                                ? "#b91c1c"
                                : "#15803d",
                            }}
                          >
                            {cardExpired
                              ? "THẺ BHYT ĐÃ HẾT HẠN"
                              : "THẺ BHYT CÒN GIÁ TRỊ SỬ DỤNG"}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            lineHeight: 1.45,
                            fontWeight: 600,
                            color: cardExpired
                              ? "#7f1d1d"
                              : "#166534",
                            wordBreak: "break-word",
                          }}
                        >
                          {String(result.ghiChu)}
                        </div>
                      </div>

                      {/* BADGE */}
                      <div
                        style={{
                          flexShrink: 0,
                          padding: "5px 9px",
                          borderRadius: 999,
                          background: cardExpired ? "#fee2e2" : "#dcfce7",
                          border: cardExpired
                            ? "1px solid #fecaca"
                            : "1px solid #bbf7d0",
                          color: cardExpired
                            ? "#b91c1c"
                            : "#15803d",
                          fontSize: 9,
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cardExpired ? "HẾT HẠN" : "CÒN HẠN"}
                      </div>
                    </div>

                    <div
                      style={{
                        height: 3,
                        background: cardExpired
                          ? "linear-gradient(90deg, #ef4444, #f87171)"
                          : "linear-gradient(90deg, #16a34a, #34d399)",
                      }}
                    />
                  </div>
                )}

                {/* ===================================================
            SECTION TITLE
        =================================================== */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 9,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#ecfdf5",
                        color: "#059669",
                      }}
                    >
                      <ClipboardList size={15} />
                    </div>

                    <div>
                      <div
                        style={{
                          color: "#173b30",
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        Chi tiết thông tin thẻ
                      </div>

                      <div
                        style={{
                          color: "#94a3b8",
                          fontSize: 10,
                          marginTop: 1,
                        }}
                      >
                        Thông tin từ hệ thống BHXH
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "4px 9px",
                      borderRadius: 999,
                      background: "#f1f5f9",
                      color: "#64748b",
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    {resultFields.length} trường
                  </div>
                </div>

                {/* ===================================================
            RESULT FIELDS
        =================================================== */}
                <Row gutter={[10, 10]}>
                  {resultFields.map((field) => (
                    <Col
                      xs={24}
                      sm={12}
                      lg={8}
                      key={field.key}
                    >
                      <div
                        style={{
                          height: "100%",
                          minHeight: 72,
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: "#ffffff",
                          border: "1px solid #e2ebe6",
                          boxShadow:
                            "0 2px 8px rgba(15,23,42,0.025)",
                          position: "relative",
                        }}
                      >
                        {/* LABEL */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 6,
                            marginBottom: 4,
                          }}
                        >
                          <Text
                            strong
                            style={{
                              color: "#64748b",
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: 0.15,
                              lineHeight: 1.25,
                            }}
                          >
                            {field.label}
                          </Text>

                          <Button
                            size="small"
                            type="text"
                            icon={<Copy size={12} />}
                            onClick={() =>
                              copyValue(
                                field.label,
                                field.value
                              )
                            }
                            style={{
                              width: 24,
                              height: 24,
                              padding: 0,
                              borderRadius: 7,
                              color: "#64748b",
                              background: "#f8fafc",
                              flexShrink: 0,
                            }}
                          />
                        </div>

                        {/* VALUE */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            minHeight: 24,
                          }}
                        >
                          <Text
                            style={{
                              color: "#173b30",
                              fontSize: 12,
                              fontWeight: 600,
                              lineHeight: 1.4,
                              wordBreak: "break-word",
                            }}
                          >
                            {String(field.value ?? "—")}
                          </Text>
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </div>

              {/* =====================================================
          FOOTER
      ===================================================== */}
              <div
                style={{
                  padding: "10px 20px",
                  borderTop: "1px solid #e5eee9",
                  background: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: "#94a3b8",
                    fontSize: 10,
                  }}
                >
                  <ShieldCheck
                    size={13}
                    color="#16a34a"
                  />

                  Dữ liệu được tra cứu từ hệ thống BHXH
                </div>

                <Button
                  onClick={() => setResultPopupOpen(false)}
                  style={{
                    height: 32,
                    padding: "0 15px",
                    borderRadius: 9,
                    fontWeight: 700,
                    fontSize: 11,
                    borderColor: "#d8e7df",
                    color: "#334e43",
                  }}
                >
                  Đóng
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
      <footer className="border-t border-slate-200 py-8 mt-12 bg-white/50 backdrop-blur-sm rounded-t-3xl">
        <div className="flex flex-col items-center gap-4">
          <p className="text-center text-slate-500 text-[11px] font-bold uppercase tracking-[0.2em] max-w-2xl leading-relaxed">
            Bản quyền thuộc về <span className="text-blue-600">Nguyễn Quang Hoài Nam (IT - HCTH)</span>
            <br />Phòng khám Đa khoa Đông Hiếu © 2026
          </p>
        </div>
      </footer>
    </div>

  );
};

export default TraCuuTheBHYT;
