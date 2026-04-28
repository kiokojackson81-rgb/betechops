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

function getNumericPart(token: string) {
  const match = token.match(/\d+(?:\.\d+)?/g);
  return match ? match.join("") : "";
}

function tokensMatch(left: string, right: string) {
  if (left === right) return true;

  const leftNumeric = getNumericPart(left);
  const rightNumeric = getNumericPart(right);
  if (leftNumeric && rightNumeric && leftNumeric === rightNumeric) return true;

  if (left.length >= 3 && right.length >= 3) {
    if (left.includes(right) || right.includes(left)) return true;
  }

  return false;
}

function getTokenOverlapCount(aTokens: string[], bTokens: string[]) {
  if (!aTokens.length || !bTokens.length) return 0;

  const remaining = [...bTokens];
  let overlap = 0;

  for (const token of aTokens) {
    const index = remaining.findIndex((candidate) => tokensMatch(token, candidate));
    if (index >= 0) {
      overlap += 1;
      remaining.splice(index, 1);
    }
  }

  return overlap;
}

function getTokenScore(a: string, b: string) {
  const aTokens = Array.from(new Set(getTokens(a)));
  const bTokens = Array.from(new Set(getTokens(b)));
  if (!aTokens.length || !bTokens.length) return 0;

  const overlap = getTokenOverlapCount(aTokens, bTokens);

  return (2 * overlap) / (aTokens.length + bTokens.length);
}

function getCoverageScore(query: string, candidate: string) {
  const queryTokens = getTokens(query);
  const candidateTokens = getTokens(candidate);
  if (!queryTokens.length || !candidateTokens.length) return 0;

  const overlap = getTokenOverlapCount(queryTokens, candidateTokens);
  return overlap / queryTokens.length;
}

function getNumericTokenScore(query: string, candidate: string) {
  const queryNumeric = Array.from(
    new Set(getTokens(query).map(getNumericPart).filter(Boolean)),
  );
  if (!queryNumeric.length) return 0;
  const candidateTokens = new Set(getTokens(candidate).map(getNumericPart).filter(Boolean));
  let overlap = 0;
  for (const token of queryNumeric) {
    if (candidateTokens.has(token)) overlap += 1;
  }
  return overlap / queryNumeric.length;
}

function getSequentialTokenScore(query: string, candidate: string) {
  const queryTokens = getTokens(query);
  const candidateTokens = getTokens(candidate);
  if (!queryTokens.length || !candidateTokens.length) return 0;

  let bestRun = 0;
  for (let start = 0; start < candidateTokens.length; start += 1) {
    let run = 0;
    for (
      let queryIndex = 0, candidateIndex = start;
      queryIndex < queryTokens.length && candidateIndex < candidateTokens.length;
      queryIndex += 1, candidateIndex += 1
    ) {
      if (!tokensMatch(queryTokens[queryIndex], candidateTokens[candidateIndex])) break;
      run += 1;
    }
    if (run > bestRun) bestRun = run;
  }

  return bestRun / queryTokens.length;
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
  const sequentialTokenScore = getSequentialTokenScore(normalizedA, normalizedB);
  const containsBoost =
    normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)
      ? 0.95
      : 0;

  const blendedScore =
    coverageScore * 0.38 +
    tokenScore * 0.26 +
    sequentialTokenScore * 0.16 +
    numericTokenScore * 0.12 +
    ngramScore * 0.08;

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
