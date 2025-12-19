import { jest } from '@jest/globals';

const originalFetch = global.fetch;

describe('pushReceiptToChatrace', () => {
  beforeEach(async () => {
    jest.resetModules();
    process.env.CHATRACE_BASE_URL = 'https://chatrace.com';
    process.env.CHATRACE_API_TOKEN = 'test-token';
    process.env.CHATRACE_ACCOUNT_ID = '1705099';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('updates an existing contact and applies receipt_created tag', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    const successResponse = (payload: unknown) =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      });

    fetchMock
      .mockResolvedValueOnce(successResponse({ data: [{ id: 'c111' }] }))
      .mockResolvedValueOnce(successResponse({}))
      .mockResolvedValueOnce(successResponse({}));

    const { pushReceiptToChatrace } = await import('@/lib/integrations/chatrace');
    await pushReceiptToChatrace({
      phoneE164: '+254700000000',
      customerName: 'Test Customer',
      receiptNumber: 'R-42',
      amount: '12000',
      currency: 'KES',
      pdfUrl: 'https://files.betech.co.ke/r.pdf',
    });

    // should call search then apply actions on the found contact, then send_text
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const searchCall = fetchMock.mock.calls[0];
    expect(String(searchCall[0])).toContain('/contacts/find?field_id=phone');
    const actionsCall = fetchMock.mock.calls[1];
    expect(String(actionsCall[0])).toContain('/contacts/');
    expect(actionsCall[1]?.method).toBe('POST');
    const sendTextCall = fetchMock.mock.calls[2];
    expect(String(sendTextCall[0])).toContain('/send_text');
  });

  it('creates a contact when none exists before updating', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    const createResponse = (payload: unknown) =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      });

    fetchMock
      .mockResolvedValueOnce(createResponse({ data: [] }))
      .mockResolvedValueOnce(createResponse({ id: 'c222' }))
      .mockResolvedValueOnce(createResponse({}))
      .mockResolvedValueOnce(createResponse({}));

    const { pushReceiptToChatrace } = await import('@/lib/integrations/chatrace');
    await pushReceiptToChatrace({
      phoneE164: '+254700000001',
      customerName: 'New Customer',
      receiptNumber: 'R-99',
      amount: '5550',
      currency: 'KES',
      pdfUrl: 'https://files.betech.co.ke/r99.pdf',
    });

    // should call search, create, then apply actions, then send_text -> 4 calls
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const createCall = fetchMock.mock.calls[1];
    expect(createCall[1]?.method).toBe('POST');
    expect(String(createCall[0])).toContain('/contacts');
    const actionsCall = fetchMock.mock.calls[2];
    expect(String(actionsCall[0])).toContain('/contacts/');
    expect(actionsCall[1]?.method).toBe('POST');
    const sendTextCall = fetchMock.mock.calls[3];
    expect(String(sendTextCall[0])).toContain('/send_text');
  });
});
