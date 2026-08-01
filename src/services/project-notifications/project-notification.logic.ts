import type { ProjectNotificationChangedField } from "./project-notification.types";

export type MinimalProjectFlow = {
  scheduledDate?: string | null;
  handlerStaffId?: string | null;
  handlerStaffName?: string | null;
  handlerType?: string | null;
  externalAgentName?: string | null;
  externalAgentPhone?: string | null;
  stage?: string | null;
};

export function hasProjectBookingDate(projectFlow: MinimalProjectFlow | null | undefined) {
  return Boolean(String(projectFlow?.scheduledDate || "").trim());
}

export function hasProjectAssignedHandler(projectFlow: MinimalProjectFlow | null | undefined) {
  return Boolean(
    String(projectFlow?.handlerStaffId || "").trim() ||
      String(projectFlow?.handlerStaffName || "").trim() ||
      String(projectFlow?.externalAgentName || "").trim() ||
      String(projectFlow?.externalAgentPhone || "").trim(),
  );
}

export function hasProjectAssignmentChange(changedFields: ProjectNotificationChangedField[]) {
  return changedFields.some(
    (field) =>
      field === "handlerStaffId" ||
      field === "handlerStaffName" ||
      field === "handlerType" ||
      field === "externalAgentName" ||
      field === "externalAgentPhone",
  );
}

export function shouldSendProjectBooked(args: {
  previousProjectFlow: MinimalProjectFlow | null | undefined;
  nextProjectFlow: MinimalProjectFlow | null | undefined;
  hasSuccessfulBookedLog: boolean;
}) {
  const wasPreviouslyBooked = hasProjectBookingDate(args.previousProjectFlow);
  const isNowBooked = hasProjectBookingDate(args.nextProjectFlow);
  if (!isNowBooked) return false;
  if (!wasPreviouslyBooked) return true;
  return !args.hasSuccessfulBookedLog;
}

export function shouldSendProjectAssigned(args: {
  previousProjectFlow: MinimalProjectFlow | null | undefined;
  nextProjectFlow: MinimalProjectFlow | null | undefined;
  changedFields: ProjectNotificationChangedField[];
}) {
  const hasHandlerNow = hasProjectAssignedHandler(args.nextProjectFlow);
  const hadHandlerBefore = hasProjectAssignedHandler(args.previousProjectFlow);
  if (!hasHandlerNow) return false;
  if (!hadHandlerBefore) return true;
  return hasProjectAssignmentChange(args.changedFields);
}
