import { sendTransactionalSms } from "@/lib/africasTalking";
import { sendGeneralCustomerNotificationEmail } from "@/lib/email";

export async function notifySiteVisitCustomer(input: {
  event: "REQUEST_RECEIVED" | "PAYMENT_SUBMITTED" | "PAYMENT_CONFIRMED" | "SCHEDULE_CONFIRMED" | "VISIT_COMPLETED" | "QUOTATION_READY";
  customerName: string;
  phone?: string | null;
  email?: string | null;
  visitRef: string;
  detail?: string | null;
}) {
  const eventLabel = input.event.replace(/_/g, " ").toLowerCase();
  const message = `Betech Solar: Site visit ${input.visitRef} ${eventLabel}.${input.detail ? ` ${input.detail}` : ""} View your account: https://www.betech.co.ke/account/site-visits`;
  const results = await Promise.allSettled([
    input.phone ? sendTransactionalSms(input.phone, message) : Promise.resolve(null),
    input.email
      ? sendGeneralCustomerNotificationEmail({
          to: input.email,
          subject: `Site visit ${input.visitRef} update`,
          title: `Site visit ${eventLabel}`,
          intro: `Hello ${input.customerName},`,
          bodyText: message,
          bodyHtml: `<p>${message}</p>`,
          ctaLabel: "View site visit",
          ctaUrl: "https://www.betech.co.ke/account/site-visits",
        })
      : Promise.resolve(null),
  ]);
  return results;
}
