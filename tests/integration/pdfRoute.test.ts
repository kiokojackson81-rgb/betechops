import { jest } from '@jest/globals';
import { NextResponse } from 'next/server';

// Mock puppeteer so tests run without real Chromium in CI unless explicitly enabled
const mockPdfBuffer = Buffer.from('PDF_BYTES');
const fakePage = {
  setContent: jest.fn(async () => {}),
  pdf: jest.fn(async () => mockPdfBuffer),
};
const fakeBrowser = {
  newPage: jest.fn(async () => fakePage),
  close: jest.fn(async () => {}),
};

jest.unstable_mockModule('puppeteer', () => ({
  launch: jest.fn(async () => fakeBrowser),
} as any));

describe('PDF export route', () => {
  let GET: any;

  beforeAll(async () => {
    // Provide a minimal global fetch implementation used by the route
    globalThis.fetch = jest.fn(async (url: any) => {
      return {
        ok: true,
        json: async () => ({
          reports: [
            {
              id: 'r1',
              date: new Date().toISOString(),
              day: 'MONDAY',
              user: { id: 'u1', name: 'Tester' },
              tasks: { marketplaceReview: { 'Betech Store': { stockChecked: true } }, submittedBy: 'tester@example.com' },
            },
          ],
        }),
      };
    }) as any;

    // import the route after mocking puppeteer
    const mod = await import('../../src/app/api/daily-report/export/pdf/route');
    GET = mod.GET;
  });

  it('returns a PDF when puppeteer available and includeJson set', async () => {
    const req = new Request('http://localhost/api/daily-report/export/pdf?includeJson=1');
    const res = await GET(req as any);
    // NextResponse should contain headers
    // If route returned JSON error, fail the test
    // When successful we return a Response-like object with headers
    const contentType = res.headers && res.headers.get ? res.headers.get('Content-Type') || res.headers.get('content-type') : null;
    expect(contentType).toMatch(/application\/pdf/i);
    // ensure puppeteer was used to create a PDF
    expect(fakeBrowser.newPage).toHaveBeenCalled();
    expect(fakePage.setContent).toHaveBeenCalled();
  });
});
