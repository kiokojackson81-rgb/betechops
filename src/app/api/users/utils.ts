import type { Prisma } from "@prisma/client";
import { AttendantCategory } from "@prisma/client";

export const categoryValues = new Set(Object.values(AttendantCategory));

export function sanitizeCategories(input: unknown, fallback: AttendantCategory): AttendantCategory[] {
  const raw = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];

  const normalized = raw
    .map((value) => (typeof value === "string" ? value : String(value)).trim().toUpperCase())
    .filter((value): value is AttendantCategory => categoryValues.has(value as AttendantCategory))
    .map((value) => value as AttendantCategory);

  const set = new Set(normalized);
  if (!set.size) set.add(fallback);
  return Array.from(set);
}

export async function syncUserCategories(tx: Prisma.TransactionClient, userId: string, categories: AttendantCategory[]) {
  await tx.attendantCategoryAssignment.deleteMany({
    where: { userId, category: { notIn: categories } },
  });

  await Promise.all(
    categories.map((category) =>
      tx.attendantCategoryAssignment.upsert({
        where: { userId_category: { userId, category } },
        update: {},
        create: { userId, category },
      })
    )
  );
}

export function shapeUser<T extends { categoryAssignments: { category: AttendantCategory }[] }>(user: T) {
  const { categoryAssignments, ...rest } = user;
  return { ...rest, categories: categoryAssignments.map((item) => item.category) };
}
