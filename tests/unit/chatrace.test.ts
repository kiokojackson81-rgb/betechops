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
      .mockResolvedValueOnce(successResponse({ contacts: [{ id: 'c111' }] }))
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

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const searchCall = fetchMock.mock.calls[0];
    expect(String(searchCall[0])).toContain('/v1/contacts?');
    const updateCall = fetchMock.mock.calls[1];
    expect(String(updateCall[0])).toContain('/v1/contacts/c111');
    expect(updateCall[1]?.method).toBe('PATCH');
    expect(updateCall[1]?.body).toContain('customer_name');
    const tagCall = fetchMock.mock.calls[2];
    expect(String(tagCall[0])).toContain('/v1/contacts/c111/tags');
    expect(tagCall[1]?.method).toBe('POST');
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
      .mockResolvedValueOnce(createResponse({ contacts: [] }))
      .mockResolvedValueOnce(createResponse({ contact: { id: 'c222' } }))
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

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const createCall = fetchMock.mock.calls[1];
    expect(createCall[1]?.method).toBe('POST');
    expect(String(createCall[0])).toContain('/v1/contacts');
    const updateCall = fetchMock.mock.calls[2];
    expect(String(updateCall[0])).toContain('/v1/contacts/c222');
  });
});
