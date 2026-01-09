import { chooseAuthoritativeCandidate, Candidate } from '../src/lib/payoutDeduper';

const canonicalStart = new Date('2026-01-05T00:00:00Z');

function makeCandidate(id: string | null, payout: number, created: string): Candidate {
  return {
    id,
    statementNumber: id ? `stmt-${id}` : null,
    payoutAmount: payout,
    weekStart: canonicalStart,
    createdAt: new Date(created),
    rawPayload: null,
    isPaid: false,
  };
}

test('prefers non-zero payout over zero', () => {
  const a = makeCandidate('a', 0, '2025-01-02');
  const b = makeCandidate('b', 100, '2025-01-03');
  const chosen = chooseAuthoritativeCandidate([a, b], canonicalStart);
  expect(chosen?.id).toBe('b');
});

test('prefers most recent row when payouts tied', () => {
  const a = makeCandidate('a', 200, '2025-01-05');
  const b = makeCandidate('b', 200, '2025-01-03');
  const chosen = chooseAuthoritativeCandidate([a, b], canonicalStart);
  expect(chosen?.id).toBe('a');
});

test('prefers most recent row even when payouts zero', () => {
  const a = makeCandidate('a', 0, '2025-01-05');
  const b = makeCandidate('b', 0, '2025-01-03');
  const chosen = chooseAuthoritativeCandidate([a, b], canonicalStart);
  expect(chosen?.id).toBe('a');
});

test('sums payout/gross across multiple statements', () => {
  const first = makeCandidate('alpha', 250, '2026-01-04');
  const second = makeCandidate('beta', 370, '2026-01-05');
  const chosen = chooseAuthoritativeCandidate([first, second], canonicalStart);
  expect(chosen?.payoutAmount).toBe(620);
  expect(chosen?.amount).toBe(620);
});
