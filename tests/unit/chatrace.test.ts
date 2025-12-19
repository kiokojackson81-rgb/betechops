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

    // single POST /contacts should be performed
    fetchMock.mockResolvedValueOnce(successResponse({ id: 'c111' }));

    const { pushReceiptToChatrace } = await import('@/lib/integrations/chatrace');
    await pushReceiptToChatrace({
      phoneE164: '+254700000000',
      customerName: 'Test Customer',
      receiptNumber: 'R-42',
      amount: '12000',
      currency: 'KES',
      receiptLink: 'https://ops.betech.co.ke/receipts/R-42',
      pdfUrl: 'https://files.betech.co.ke/r.pdf',
      tagName: 'receipt_created_pdf',
    });

    // should call single POST /contacts to upsert + apply actions
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const createCall = fetchMock.mock.calls[0];
    expect(createCall[1]?.method).toBe('POST');
    expect(String(createCall[0])).toContain('/contacts');
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

    // single POST /contacts should be performed to create+actions
    fetchMock.mockResolvedValueOnce(createResponse({ id: 'c222' }));

    const { pushReceiptToChatrace } = await import('@/lib/integrations/chatrace');
    await pushReceiptToChatrace({
      phoneE164: '+254700000001',
      customerName: 'New Customer',
      receiptNumber: 'R-99',
      amount: '5550',
      currency: 'KES',
      receiptLink: 'https://ops.betech.co.ke/receipts/R-99',
      pdfUrl: 'https://files.betech.co.ke/r99.pdf',
      tagName: 'receipt_created_pdf',
    });

    // should call single POST /contacts to create + apply actions
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const createCall = fetchMock.mock.calls[0];
    expect(createCall[1]?.method).toBe('POST');
    expect(String(createCall[0])).toContain('/contacts');
  });
});
