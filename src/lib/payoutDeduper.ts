export type Candidate = {
  id: string | null;
  statementNumber: string | null;
  amount: number;
  createdAt: Date;
  rawPayload?: any;
  isPaid?: boolean;
};

// Choose authoritative candidate per rules:
// - Prefer non-zero `amount` candidates
// - If multiple non-zero, pick earliest `createdAt`
// - If none non-zero, pick earliest `createdAt`
export function chooseAuthoritativeCandidate(candidates: Candidate[]): Candidate {
  if (!candidates || candidates.length === 0) throw new Error('no candidates');
  const nonZero = candidates.filter((c) => c.amount > 0);
  if (nonZero.length > 0) {
    nonZero.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return nonZero[0];
  }
  const copy = candidates.slice();
  copy.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return copy[0];
}
