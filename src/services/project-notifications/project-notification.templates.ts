import type { ProjectNotificationContext } from "./project-notification.types";
import { formatKenyaCurrency, formatKenyaDate } from "./project-notification.formatters";

function bookingSummary(context: ProjectNotificationContext) {
  return {
    projectValue: formatKenyaCurrency(context.projectValue),
    amountPaid: formatKenyaCurrency(context.amountPaid),
    balance: formatKenyaCurrency(context.balance),
    depositPaid: formatKenyaCurrency(context.depositPaid),
    depositRequired: formatKenyaCurrency(context.depositRequired),
    balanceAfterInstallation: formatKenyaCurrency(context.balanceAfterInstallation),
    installationDate: formatKenyaDate(context.installationDate) ?? "To be confirmed",
    completionDate: formatKenyaDate(context.completionDate) ?? "Today",
  };
}

function projectPaymentPosition(context: ProjectNotificationContext) {
  if (context.paymentTerm === "DEPOSIT_AND_BALANCE") return "Deposit and balance";
  if (context.paymentTerm === "FULL_AFTER_INSTALLATION") return "Pay after installation";
  if (context.paymentTerm === "FULL_BEFORE_INSTALLATION") return "Full payment";
  return "Project payment";
}

export function buildProjectBookingCustomerWhatsApp(context: ProjectNotificationContext) {
  const summary = bookingSummary(context);
  return [
    `Hi ${context.customerName},`,
    "",
    "Your installation has been successfully booked.",
    "",
    `Project No.: ${context.projectNumber}`,
    `Installation Date: ${summary.installationDate}`,
    `Amount Paid: ${summary.amountPaid}`,
    `Outstanding Balance: ${summary.balance}`,
    "",
    "View and download your project receipt here:",
    context.receiptLink,
    "",
    "We look forward to serving you and completing your installation on the scheduled date.",
    "",
    "Thank you for choosing Betech Solar Solutions.",
  ].join("\n");
}

export function buildProjectBookingCustomerSms(context: ProjectNotificationContext) {
  const summary = bookingSummary(context);
  return `Hi ${context.customerName}. Your installation has been booked. Project No: ${context.projectNumber}. Installation Date: ${summary.installationDate}. Paid: ${summary.amountPaid}. Balance: ${summary.balance}. Receipt: ${context.receiptLink}. - Betech Solar Solutions`;
}

export function buildProjectBookingAdminWhatsApp(context: ProjectNotificationContext) {
  const summary = bookingSummary(context);
  return [
    "New Installation Booked",
    "",
    `Customer: ${context.customerName}`,
    `Phone: ${context.customerPhone ?? "Not available"}`,
    `Project No.: ${context.projectNumber}`,
    `Installation Date: ${summary.installationDate}`,
    "",
    `Project Value: ${summary.projectValue}`,
    `Amount Paid: ${summary.amountPaid}`,
    `Outstanding Balance: ${summary.balance}`,
    "",
    `Assigned Staff/Technician: ${context.assignedHandlerName ?? "Not assigned"}`,
    `Booked By: ${context.bookedByName ?? context.updatedByName ?? "System"}`,
    "",
    "Customer Receipt and Project Details:",
    context.receiptLink,
  ].join("\n");
}

export function buildProjectBookingHandlerWhatsApp(context: ProjectNotificationContext) {
  const summary = bookingSummary(context);
  return [
    "New Installation Assigned",
    "",
    `Hello ${context.assignedHandlerName ?? "Team Member"},`,
    "",
    "You have been assigned a new installation project.",
    "",
    `Customer: ${context.customerName}`,
    `Phone: ${context.customerPhone ?? "Not available"}`,
    `Installation Address: ${context.installationAddress ?? "Not provided"}`,
    "",
    `Project No.: ${context.projectNumber}`,
    `Installation Date: ${summary.installationDate}`,
    "",
    `Project Value: ${summary.projectValue}`,
    `Amount Paid: ${summary.amountPaid}`,
    `Outstanding Balance: ${summary.balance}`,
    "",
    "Customer Receipt and Project Details:",
    context.receiptLink,
  ].join("\n");
}

export function buildProjectBookingUpdateCustomerWhatsApp(context: ProjectNotificationContext) {
  const summary = bookingSummary(context);
  return [
    `Hi ${context.customerName},`,
    "",
    "Your installation booking has been updated.",
    "",
    `Project No.: ${context.projectNumber}`,
    `Updated Installation Date: ${summary.installationDate}`,
    "",
    "View your updated project details and receipt here:",
    context.receiptLink,
    "",
    "Thank you for choosing Betech Solar Solutions.",
  ].join("\n");
}

export function buildProjectBookingUpdateCustomerSms(context: ProjectNotificationContext) {
  const summary = bookingSummary(context);
  return `Hi ${context.customerName}. Your installation booking for Project No. ${context.projectNumber} has been updated. Installation Date: ${summary.installationDate}. Details: ${context.receiptLink}. - Betech Solar Solutions`;
}

export function buildProjectBookingUpdateAdminWhatsApp(context: ProjectNotificationContext) {
  const summary = bookingSummary(context);
  return [
    "Installation Booking Updated",
    "",
    `Customer: ${context.customerName}`,
    `Phone: ${context.customerPhone ?? "Not available"}`,
    `Project No.: ${context.projectNumber}`,
    `Installation Date: ${summary.installationDate}`,
    `Assigned Staff/Technician: ${context.assignedHandlerName ?? "Not assigned"}`,
    `Updated By: ${context.updatedByName ?? "System"}`,
    "",
    "Project Details:",
    context.receiptLink,
  ].join("\n");
}

export function buildProjectReassignedWhatsApp(context: ProjectNotificationContext) {
  return [
    "Project Reassigned",
    "",
    `Project No. ${context.projectNumber} for ${context.customerName} has been reassigned to another staff member or technician.`,
    "",
    "No further action is required from you unless instructed by the operations team.",
  ].join("\n");
}

export function buildProjectCompletedCustomerWhatsApp(context: ProjectNotificationContext) {
  const summary = bookingSummary(context);
  return [
    `Hi ${context.customerName},`,
    "",
    `Your installation for Project No. ${context.projectNumber} has been successfully completed.`,
    "",
    `Project Value: ${summary.projectValue}`,
    `Total Paid: ${summary.amountPaid}`,
    `Balance: ${summary.balance}`,
    "",
    "View and download your receipt here:",
    context.receiptLink,
    "",
    "Thank you for choosing Betech Solar Solutions. We appreciate the opportunity to serve you and remain available for after-sales support.",
  ].join("\n");
}

export function buildProjectCompletedCustomerSms(context: ProjectNotificationContext) {
  const summary = bookingSummary(context);
  return `Hi ${context.customerName}. Project No. ${context.projectNumber} has been completed successfully. Total Paid: ${summary.amountPaid}. Balance: ${summary.balance}. Receipt: ${context.receiptLink}. Thank you for choosing Betech Solar Solutions.`;
}

export function buildProjectCompletedAdminWhatsApp(context: ProjectNotificationContext) {
  const summary = bookingSummary(context);
  return [
    "Project Completed",
    "",
    `Customer: ${context.customerName}`,
    `Phone: ${context.customerPhone ?? "Not available"}`,
    `Project No.: ${context.projectNumber}`,
    `Completed On: ${summary.completionDate}`,
    `Completed By: ${context.completedByName ?? "System"}`,
    `Role: ${context.completedByRole ?? "Unknown"}`,
    "",
    `Project Value: ${summary.projectValue}`,
    `Total Paid: ${summary.amountPaid}`,
    `Balance: ${summary.balance}`,
    "",
    "Receipt:",
    context.receiptLink,
  ].join("\n");
}

export function buildProjectCompletedHandlerWhatsApp(context: ProjectNotificationContext) {
  const summary = bookingSummary(context);
  const handlerName = context.assignedHandlerName ?? context.completedByName ?? "Team Member";
  return [
    "Project Completion Recorded",
    "",
    `Hello ${handlerName},`,
    "",
    `Project No. ${context.projectNumber} for ${context.customerName} has been successfully marked as completed.`,
    "",
    `Completed On: ${summary.completionDate}`,
    `Project Value: ${summary.projectValue}`,
    `Total Paid: ${summary.amountPaid}`,
    `Balance: ${summary.balance}`,
    "",
    "Final Receipt:",
    context.receiptLink,
    "",
    "Thank you.",
  ].join("\n");
}

export function buildProjectBookingCustomerEmail(context: ProjectNotificationContext) {
  const summary = bookingSummary(context);
  return {
    subject: `Installation Booking Confirmation - Project No. ${context.projectNumber}`,
    title: "Installation booking confirmation",
    intro: `Dear ${context.customerName},`,
    bodyHtml: `
      <p>We are pleased to confirm that your installation has been successfully booked.</p>
      <p><strong>Project Number:</strong> ${context.projectNumber}<br />
      <strong>Installation Date:</strong> ${summary.installationDate}<br />
      <strong>Amount Paid So Far:</strong> ${summary.amountPaid}<br />
      <strong>Outstanding Balance:</strong> ${summary.balance}</p>
      <p>Our team will arrive at your premises on the scheduled date to carry out the installation.</p>
      <p>Please find your project receipt attached. You can also view or download it using the link below:</p>
      <p><a href="${context.receiptLink}">${context.receiptLink}</a></p>
      <p>We look forward to serving you and delivering a professional installation.</p>
      <p>Thank you for choosing Betech Solar Solutions.</p>
    `,
  };
}

export function buildProjectCompletedCustomerEmail(context: ProjectNotificationContext) {
  const summary = bookingSummary(context);
  return {
    subject: `Project Completion - ${context.projectNumber}`,
    title: "Project completion",
    intro: `Dear ${context.customerName},`,
    bodyHtml: `
      <p>We are pleased to confirm that your installation under Project No. ${context.projectNumber} has been successfully completed.</p>
      <p><strong>Project Value:</strong> ${summary.projectValue}<br />
      <strong>Total Paid:</strong> ${summary.amountPaid}<br />
      <strong>Outstanding Balance:</strong> ${summary.balance}</p>
      <p>Please find your receipt attached. You can also view or download it using the link below:</p>
      <p><a href="${context.receiptLink}">${context.receiptLink}</a></p>
      <p>Thank you for choosing Betech Solar Solutions. We appreciate the opportunity to serve you and remain available for after-sales support.</p>
    `,
  };
}

export function buildProjectAssignedCustomerSms(context: ProjectNotificationContext) {
  const summary = bookingSummary(context);
  const technicianName = context.assignedHandlerName ?? "Technician";
  const technicianPhone = context.assignedHandlerPhone ?? "Not available";

  if (context.paymentTerm === "DEPOSIT_AND_BALANCE") {
    return `Hello ${context.customerName}, your Betech Solar project ${context.projectNumber} has been assigned to Technician ${technicianName} (${technicianPhone}). Deposit paid: ${summary.depositPaid}. Balance after installation: ${summary.balanceAfterInstallation}. Installation: ${summary.installationDate}. View your project receipt and payment options: ${context.receiptLink}. - Betech Solar Solutions`;
  }

  if (context.paymentTerm === "FULL_AFTER_INSTALLATION") {
    return `Hello ${context.customerName}, your Betech Solar project ${context.projectNumber} has been assigned to Technician ${technicianName} (${technicianPhone}). Amount paid: ${summary.amountPaid}. Balance after installation: ${summary.balanceAfterInstallation}. Installation: ${summary.installationDate}. View your project receipt and payment options: ${context.receiptLink}. - Betech Solar Solutions`;
  }

  return `Hello ${context.customerName}, your Betech Solar project ${context.projectNumber} has been assigned to Technician ${technicianName} (${technicianPhone}). Amount paid: ${summary.amountPaid}. Balance: ${summary.balance}. Installation: ${summary.installationDate}. View your project receipt and payment options: ${context.receiptLink}. - Betech Solar Solutions`;
}

export function buildProjectAssignedCustomerEmail(context: ProjectNotificationContext) {
  const summary = bookingSummary(context);
  const technicianName = context.assignedHandlerName ?? "Technician";
  const technicianPhone = context.assignedHandlerPhone ?? "Not available";

  return {
    subject: `Project Assignment and Payment Details - ${context.projectNumber}`,
    title: "Project assignment and payment details",
    intro: `Hello ${context.customerName},`,
    bodyHtml: `
      <p>Your Betech Solar project has been assigned to the following technician:</p>
      <p><strong>Technician:</strong> ${technicianName}<br />
      <strong>Phone Number:</strong> ${technicianPhone}</p>
      <p><strong>Project Number:</strong> ${context.projectNumber}<br />
      <strong>Installation Date:</strong> ${summary.installationDate}<br />
      <strong>Project Address:</strong> ${context.installationAddress ?? "Not provided"}<br />
      <strong>Project Value:</strong> ${summary.projectValue}</p>
      <p><strong>Payment Position:</strong> ${projectPaymentPosition(context)}<br />
      <strong>Amount Paid:</strong> ${summary.amountPaid}<br />
      <strong>Balance Remaining:</strong> ${summary.balance}<br />
      <strong>Deposit Paid:</strong> ${summary.depositPaid}<br />
      <strong>Required Deposit:</strong> ${summary.depositRequired}<br />
      <strong>Payment Status:</strong> ${context.paymentStatus ?? "Pending"}</p>
      <p>Your project receipt contains the approved payment options, including M-Pesa and bank transfer details.</p>
      <p>View your receipt and payment details here:</p>
      <p><a href="${context.receiptLink}">${context.receiptLink}</a></p>
      <p>The assigned technician may contact you before installation to confirm timing and any site preparation required.</p>
      <p>Thank you for choosing Betech Solar Solutions.</p>
    `,
  };
}
