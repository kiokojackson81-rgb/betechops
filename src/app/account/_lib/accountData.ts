import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { findSafeCustomerProfileByUserId } from "@/lib/customerProfile";
import { backfillPosReceiptsForCustomerAccount } from "@/lib/posCustomerAccountSync";
import { prisma } from "@/lib/prisma";
import { backfillQuoteRequestsForCustomerAccount } from "@/lib/quoteRequests";
import { buildCustomerAccountIdentity } from "@/lib/shopCustomerOrders";

export const getCustomerAccountContext = cache(async () => {
  const session = await auth();
  const sessionUser = session?.user as
    | {
        id?: string | null;
        name?: string | null;
        phone?: string | null;
        email?: string | null;
      }
    | undefined;

  if (!sessionUser?.id) {
    redirect("/login/phone?callbackUrl=/account");
  }

  const dbUser = await findSafeCustomerProfileByUserId(sessionUser.id);
  const identity = buildCustomerAccountIdentity(
    {
      id: sessionUser.id,
      phone: sessionUser.phone || null,
      email: sessionUser.email || null,
    },
    dbUser,
  );
  const profile = {
    id: sessionUser.id,
    name: dbUser?.name || sessionUser.name || "",
    email: dbUser?.email || sessionUser.email || "",
    phone: dbUser?.phone || sessionUser.phone || "",
    whatsappNumber:
      dbUser?.whatsappNumber || dbUser?.phone || sessionUser.phone || "",
    county: dbUser?.county || "",
    town: dbUser?.town || "",
    estateLandmark: dbUser?.estateLandmark || "",
    locationNotes: dbUser?.locationNotes || "",
  };
  const completionFields = [
    profile.name,
    profile.phone,
    profile.email,
    profile.county,
    profile.town,
  ];
  const profileCompletion = Math.round(
    (completionFields.filter((value) => value.trim()).length /
      completionFields.length) *
      100,
  );

  return { userId: sessionUser.id, profile, profileCompletion, identity };
});

export const syncCustomerAccountRecords = cache(async () => {
  const context = await getCustomerAccountContext();
  await Promise.all([
    backfillPosReceiptsForCustomerAccount({
      phoneVariants: context.identity.phoneVariants,
      normalizedEmails: context.identity.normalizedEmails,
      limit: 100,
    }),
    backfillQuoteRequestsForCustomerAccount({
      userId: context.userId,
      phoneVariants: context.identity.phoneVariants,
      normalizedEmails: context.identity.normalizedEmails,
    }),
  ]);

  if (context.identity.phoneVariants.length) {
    await prisma.websiteOrder.updateMany({
      where: {
        customerPhone: { in: context.identity.phoneVariants },
        customerUserId: { not: context.userId },
      },
      data: { customerUserId: context.userId },
    });
  }

  return context;
});
