import { prisma } from "@/lib/prisma";
import AttendantEditorClient from "./AttendantEditorClient";
import { getCategoryLabel } from "@/lib/getLandingPage";

async function resolveMaybePromise<T>(value: T | Promise<T>) {
  let resolvedValue = value;
  if (resolvedValue && typeof (resolvedValue as Promise<T>).then === "function") {
    try {
      resolvedValue = await (resolvedValue as Promise<T>);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[admin/attendants] failed to resolve params", { err: e });
      resolvedValue = null as T;
    }
  }
  return resolvedValue;
}

export default async function AttendantEditPage({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  const resolvedParams = await resolveMaybePromise(params);
  const { id } = (resolvedParams ?? {}) as { id: string };
  if (!id) return <div className="p-8">Attendant not found</div>;

  const attendant = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      attendantCategory: true,
      isActive: true,
      bankName: true,
      bankAccountNumber: true,
      technicalProfile: true,
      employeeDocuments: {
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          documentType: true,
          title: true,
          fileUrl: true,
          notes: true,
          createdAt: true,
          uploadedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });
  if (!attendant) return <div className="p-8">Attendant not found</div>;

  const prepared = {
    ...attendant,
    categoryLabel: getCategoryLabel(attendant.attendantCategory),
  };

  return <AttendantEditorClient attendant={prepared} />;
}
