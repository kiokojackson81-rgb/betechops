import { computeRowStatus } from '../src/lib/dailyReportHelpers';

describe('computeRowStatus', () => {
  test('returns missing when no shops', () => {
    const r = { id: '1', date: '2025-01-01', day: 'MONDAY', tasks: {} } as any;
    expect(computeRowStatus(r)).toBe('missing');
  });

  test('returns complete when all shops fully checked', () => {
    const r = { id: '2', date: '2025-01-02', day: 'TUESDAY', tasks: { marketplaceReview: { A: { stockChecked: true, pricingConfirmed: true, competitorsReviewed: true, oosReviewed: true }, B: { stockChecked: true, pricingConfirmed: true, competitorsReviewed: true, oosReviewed: true } } } } as any;
    expect(computeRowStatus(r)).toBe('complete');
  });

  test('returns partial when some checks present', () => {
    const r = { id: '3', date: '2025-01-03', day: 'WEDNESDAY', tasks: { marketplaceReview: { A: { stockChecked: true, pricingConfirmed: false, competitorsReviewed: false, oosReviewed: false }, B: {} } } } as any;
    expect(computeRowStatus(r)).toBe('partial');
  });
});
