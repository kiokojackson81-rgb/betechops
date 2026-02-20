import { pushInternalReceiptAlert } from "@/lib/chatraceInternalFixed";

function mockFetchSuccess() {
  return jest.spyOn(global as any, "fetch").mockImplementation(async () => {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true }),
    } as any;
  });
}

describe("chatraceInternalFixed POD internal tags", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
    process.env.NODE_ENV = "test";
    process.env.CHATRACE_INTERNAL_ENABLED = "1";
    process.env.CHATRACE_INTERNAL_BASE_URL = "https://api.chatrace.com";
    process.env.CHATRACE_INTERNAL_API_TOKEN = "internal-token";
    // Intentionally omit account id; POD should default to 1802145
    process.env.CHATRACE_INTERNAL_ACCOUNT_ID = "";
    process.env.CHATRACE_INTERNAL_ADMIN_PHONE = "254700000001";
    process.env.CHATRACE_INTERNAL_POD_ADMIN_TAG = "pod_receipt_admin_alert";
    process.env.CHATRACE_INTERNAL_POD_FOLLOWUP_TAG = "pod_followup_alert";
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  test("admin alert sets required fields then applies pod_receipt_admin_alert tag in internal account", async () => {
    const fetchMock = mockFetchSuccess();

    const res = await pushInternalReceiptAlert({
      tagName: "pod_receipt_admin_alert",
      receiptNumber: "BETECH20260220-0001",
      amount: "1000",
      formattedAmount: 1000,
      paymentMethod: "POD",
      createdBy: "Attendant",
      itemsText: "Item A x1",
      customerName: "Customer A",
      customerPhone: "+254711111111",
      podPendingCount: 3,
      podPendingTotal: 25000,
      requestId: "rid-1",
    });

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [fieldsCall, tagCall] = fetchMock.mock.calls as any[];
    const fieldsInit = fieldsCall[1];
    const tagInit = tagCall[1];

    expect(fieldsInit.headers["X-ACCESS-TOKEN"]).toBe("internal-token");
    expect(fieldsInit.headers["X-ACCOUNT-ID"]).toBe("1802145");
    expect(tagInit.headers["X-ACCOUNT-ID"]).toBe("1802145");

    const fieldsBody = JSON.parse(fieldsInit.body);
    const tagBody = JSON.parse(tagInit.body);

    expect(fieldsBody.phone).toBe("254700000001");
    expect(fieldsBody.first_name).toBe("POD Admin");
    expect(Array.isArray(fieldsBody.actions)).toBe(true);
    const fieldNames = fieldsBody.actions.map((a: any) => a.field_name);
    expect(fieldNames).toEqual(
      expect.arrayContaining([
        "customer_name",
        "customer_phone",
        "receipt_number",
        "formatted_amount",
        "created_by",
        "admin_items",
        "pod_pending_count",
        "pod_pending_total",
      ]),
    );
    expect(fieldNames).not.toEqual(expect.arrayContaining(["pod_pending_list"]));

    expect(tagBody.phone).toBe("254700000001");
    expect(tagBody.first_name).toBe("POD Admin");
    const tagActions = tagBody.actions.map((a: any) => a.action);
    expect(tagActions).toEqual(expect.arrayContaining(["add_tag"]));
    const tagNames = tagBody.actions.map((a: any) => a.tag_name);
    expect(tagNames).toEqual(expect.arrayContaining(["pod_receipt_admin_alert"]));
  });

  test("follow-up alert sets pod_pending_list then applies pod_followup_alert tag for the override phone", async () => {
    const fetchMock = mockFetchSuccess();

    const res = await pushInternalReceiptAlert({
      toPhone: "254716722601",
      tagName: "pod_followup_alert",
      receiptNumber: "BETECH20260220-0002",
      amount: "2000",
      formattedAmount: 2000,
      paymentMethod: "POD",
      createdBy: "Attendant",
      itemsText: "Item B x2",
      customerName: "Customer B",
      customerPhone: "0712345678",
      podPendingCount: 0,
      podPendingList: "None",
      requestId: "rid-2",
    });

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [fieldsCall] = fetchMock.mock.calls as any[];
    const fieldsInit = fieldsCall[1];
    const fieldsBody = JSON.parse(fieldsInit.body);

    expect(fieldsInit.headers["X-ACCOUNT-ID"]).toBe("1802145");
    expect(fieldsBody.phone).toBe("254716722601");
    expect(fieldsBody.first_name).toBe("POD Follow-up");

    const fieldNames = fieldsBody.actions.map((a: any) => a.field_name);
    expect(fieldNames).toEqual(
      expect.arrayContaining([
        "customer_name",
        "customer_phone",
        "receipt_number",
        "formatted_amount",
        "created_by",
        "admin_items",
        "pod_pending_count",
        "pod_pending_list",
      ]),
    );
    expect(fieldNames).not.toEqual(expect.arrayContaining(["pod_pending_total"]));
  });

  test("normal internal admin alert still works when CHATRACE_INTERNAL_ACCOUNT_ID is missing", async () => {
    const fetchMock = mockFetchSuccess();

    const res = await pushInternalReceiptAlert({
      // no tagName => default receipt_admin_alert
      receiptNumber: "BETECH20260220-0003",
      amount: "10",
      paymentMethod: "MPESA",
      createdBy: "Jeniffer",
      itemsText: "Item C x1",
      customerName: "Customer C",
      customerPhone: "0705663175",
      requestId: "rid-3",
    });

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [fieldsCall] = fetchMock.mock.calls as any[];
    const fieldsInit = fieldsCall[1];
    // Fallback internal account id
    expect(fieldsInit.headers["X-ACCOUNT-ID"]).toBe("1802145");
  });
});
