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

    // first POST sets fields, second POST applies tag
    fetchMock.mockResolvedValueOnce(successResponse({ success: true, data: { id: 'c111' }, contact_created: false }));
    fetchMock.mockResolvedValueOnce(successResponse({ success: true }));

    const { pushReceiptToChatrace } = await import('@/lib/integrations/chatrace');
    await pushReceiptToChatrace({
      phoneE164: '+254700000000',
      customerName: 'Test Customer',
      receiptNumber: 'R-42',
      amount: '12000',
      currency: 'KES',
      receiptLink: 'https://ops.betech.co.ke/receipts/R-42',
      pdfUrl: 'https://files.betech.co.ke/r.pdf',
      tagName: 'receipt_created',
    });

    // should call two POST /contacts: fields then tags
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstCall = fetchMock.mock.calls[0];
    const secondCall = fetchMock.mock.calls[1];
    expect(firstCall[1]?.method).toBe('POST');
    expect(String(firstCall[0])).toContain('/contacts');
    expect(secondCall[1]?.method).toBe('POST');
    expect(String(secondCall[0])).toContain('/contacts');
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

    // first POST creates + sets fields; second POST applies tag
    fetchMock.mockResolvedValueOnce(createResponse({ success: true, data: { id: 'c222' }, contact_created: true }));
    fetchMock.mockResolvedValueOnce(createResponse({ success: true }));

    const { pushReceiptToChatrace } = await import('@/lib/integrations/chatrace');
    await pushReceiptToChatrace({
      phoneE164: '+254700000001',
      customerName: 'New Customer',
      receiptNumber: 'R-99',
      amount: '5550',
      currency: 'KES',
      receiptLink: 'https://ops.betech.co.ke/receipts/R-99',
      pdfUrl: 'https://files.betech.co.ke/r99.pdf',
      tagName: 'receipt_created',
    });

    // should call two POST /contacts: create/fields then tags
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstCall = fetchMock.mock.calls[0];
    const secondCall = fetchMock.mock.calls[1];
    expect(firstCall[1]?.method).toBe('POST');
    expect(String(firstCall[0])).toContain('/contacts');
    expect(secondCall[1]?.method).toBe('POST');
    expect(String(secondCall[0])).toContain('/contacts');
  });
});
