export type ProjectNotificationEvent =
  | "PROJECT_BOOKED"
  | "PROJECT_ASSIGNED"
  | "PROJECT_BOOKING_UPDATED"
  | "PROJECT_COMPLETED";

export type ProjectNotificationChannel = "WHATSAPP" | "SMS" | "EMAIL";

export type ProjectNotificationRecipientType =
  | "CUSTOMER"
  | "ADMIN"
  | "ASSIGNED_HANDLER"
  | "COMPLETING_USER"
  | "PREVIOUS_HANDLER";

export type ProjectNotificationChangedField =
  | "scheduledDate"
  | "handlerStaffId"
  | "handlerStaffName"
  | "handlerType"
  | "externalAgentName"
  | "externalAgentPhone"
  | "handlerAssignments"
  | "deliveryAddress"
  | "stage";

export type ProjectNotificationQueueInput = {
  receiptId: string;
  event: ProjectNotificationEvent;
  triggeredByUserId?: string | null;
  changedFields?: ProjectNotificationChangedField[];
  previousHandler?: {
    name?: string | null;
    phone?: string | null;
  } | null;
};

export type ProjectNotificationChannelResultStatus =
  | "SENT"
  | "FAILED"
  | "SKIPPED"
  | "SKIPPED_ALREADY_SENT";

export type ProjectNotificationChannelResult = {
  key: string;
  eventType: ProjectNotificationEvent;
  channel: ProjectNotificationChannel;
  recipientType: ProjectNotificationRecipientType;
  templateKey: string;
  recipientAddress: string | null;
  status: ProjectNotificationChannelResultStatus;
  providerMessageId?: string | null;
  reason?: string | null;
  error?: string | null;
};

export type ProjectNotificationPublishResult = {
  receiptId: string;
  eventType: ProjectNotificationEvent;
  dispatched: boolean;
  results: ProjectNotificationChannelResult[];
};

export type ProjectNotificationContext = {
  receiptId: string;
  event: ProjectNotificationEvent;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  projectNumber: string;
  installationDate: string | null;
  installationAddress: string | null;
  projectValue: number;
  amountPaid: number;
  balance: number;
  paymentTerm: string | null;
  paymentStatus: string | null;
  depositRequired: number;
  depositPaid: number;
  balanceAfterInstallation: number;
  receiptLink: string;
  receiptPdfLink: string;
  reviewLink: string | null;
  assignedHandlerName: string | null;
  assignedHandlerPhone: string | null;
  assignedHandlerId: string | null;
  assignedHandlers: Array<{
    id: string;
    name: string;
    phone: string | null;
    kind: "STAFF" | "EXTERNAL";
  }>;
  bookedByName: string | null;
  updatedByName: string | null;
  completedByName: string | null;
  completedByRole: string | null;
  completionDate: string | null;
  changedFields: ProjectNotificationChangedField[];
  previousHandlerName: string | null;
  previousHandlerPhone: string | null;
};

export type ProjectNotificationDraft = {
  eventType: ProjectNotificationEvent;
  channel: ProjectNotificationChannel;
  recipientType: ProjectNotificationRecipientType;
  recipientName?: string | null;
  recipientAddress?: string | null;
  templateKey: string;
  idempotencyKey: string;
  status: "PENDING" | "SKIPPED";
  errorMessage?: string | null;
  payloadSnapshot: Record<string, unknown>;
};
