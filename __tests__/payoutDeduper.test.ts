import { chooseAuthoritativeCandidate, Candidate } from '../src/lib/payoutDeduper';

function make(id: string | null, amount: number, created: string): Candidate {
  return { id, statementNumber: id ? `stmt-${id}` : null, amount, createdAt: new Date(created), rawPayload: null, isPaid: false };
}

test('prefers non-zero amount over zero', () => {
  const a = make('a', 0, '2025-01-02');
  const b = make('b', 100, '2025-01-03');
  const chosen = chooseAuthoritativeCandidate([a, b]);
  expect(chosen.id).toBe('b');
});

test('earliest created when both non-zero', () => {
  const a = make('a', 200, '2025-01-05');
  const b = make('b', 200, '2025-01-03');
  const chosen = chooseAuthoritativeCandidate([a, b]);
  expect(chosen.id).toBe('b');
});

test('earliest created when all zero', () => {
  const a = make('a', 0, '2025-01-05');
  const b = make('b', 0, '2025-01-03');
  const chosen = chooseAuthoritativeCandidate([a, b]);
  expect(chosen.id).toBe('b');
});
