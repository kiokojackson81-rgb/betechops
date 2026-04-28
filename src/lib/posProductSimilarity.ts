export type PosSimilarityMatch<T = { name: string }> = {
  item: T;
  score: number;
};

function normalizeProductText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTokens(value: string) {
  return normalizeProductText(value).split(" ").filter(Boolean);
}

function isNumericToken(token: string) {
  return /\d/.test(token);
}

function getTokenScore(a: string, b: string) {
  const aTokens = new Set(getTokens(a));
  const bTokens = new Set(getTokens(b));
  if (!aTokens.size || !bTokens.size) return 0;

  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }

  return (2 * overlap) / (aTokens.size + bTokens.size);
}

function getCoverageScore(query: string, candidate: string) {
  const queryTokens = getTokens(query);
  const candidateTokens = new Set(getTokens(candidate));
  if (!queryTokens.length || !candidateTokens.size) return 0;

  let overlap = 0;
  for (const token of queryTokens) {
    if (candidateTokens.has(token)) overlap += 1;
  }

  return overlap / queryTokens.length;
}

function getNumericTokenScore(query: string, candidate: string) {
  const queryNumeric = Array.from(new Set(getTokens(query).filter(isNumericToken)));
  if (!queryNumeric.length) return 0;
  const candidateTokens = new Set(getTokens(candidate));
  let overlap = 0;
  for (const token of queryNumeric) {
    if (candidateTokens.has(token)) overlap += 1;
  }
  return overlap / queryNumeric.length;
}

function getNgrams(value: string, size = 3) {
  const normalized = normalizeProductText(value).replace(/\s+/g, " ");
  if (!normalized) return [];
  if (normalized.length <= size) return [normalized];

  const grams: string[] = [];
  for (let index = 0; index <= normalized.length - size; index += 1) {
    grams.push(normalized.slice(index, index + size));
  }
  return grams;
}

function getNgramScore(a: string, b: string) {
  const aNgrams = getNgrams(a);
  const bNgrams = getNgrams(b);
  if (!aNgrams.length || !bNgrams.length) return 0;

  const bCounts = new Map<string, number>();
  for (const gram of bNgrams) {
    bCounts.set(gram, (bCounts.get(gram) ?? 0) + 1);
  }

  let overlap = 0;
  for (const gram of aNgrams) {
    const count = bCounts.get(gram) ?? 0;
    if (count > 0) {
      overlap += 1;
      bCounts.set(gram, count - 1);
    }
  }

  return (2 * overlap) / (aNgrams.length + bNgrams.length);
}

export function getProductSimilarityScore(a: string, b: string) {
  const normalizedA = normalizeProductText(a);
  const normalizedB = normalizeProductText(b);
  if (!normalizedA || !normalizedB) return 0;
  if (normalizedA === normalizedB) return 1;

  const tokenScore = getTokenScore(normalizedA, normalizedB);
  const ngramScore = getNgramScore(normalizedA, normalizedB);
  const coverageScore = getCoverageScore(normalizedA, normalizedB);
  const numericTokenScore = getNumericTokenScore(normalizedA, normalizedB);
  const containsBoost =
    normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)
      ? 0.92
      : 0;

  const blendedScore =
    tokenScore * 0.35 +
    ngramScore * 0.2 +
    coverageScore * 0.35 +
    numericTokenScore * 0.1;

  return Math.max(containsBoost, blendedScore);
}

export function findSimilarProducts<T extends { name: string; soldCount?: number | null }>(
  query: string,
  items: T[],
  threshold = 0.5,
  limit = 5,
): PosSimilarityMatch<T>[] {
  if (!query.trim()) return [];

  return items
    .map((item) => ({
      item,
      score: getProductSimilarityScore(query, item.name),
    }))
    .filter((match) => match.score >= threshold)
    .sort(
      (left, right) =>
        right.score - left.score ||
        Number(right.item.soldCount ?? 0) - Number(left.item.soldCount ?? 0) ||
        left.item.name.localeCompare(right.item.name),
    )
    .slice(0, limit);
}
