import type { ProjectNotificationChangedField } from "./project-notification.types";

export type MinimalProjectFlow = {
  scheduledDate?: string | null;
  handlerStaffId?: string | null;
  handlerStaffIds?: string[] | null;
  handlerStaffName?: string | null;
  handlerType?: string | null;
  assignedHandlers?: Array<{
    kind?: string | null;
    staffId?: string | null;
    staffName?: string | null;
    externalAgentId?: string | null;
    externalAgentName?: string | null;
    phone?: string | null;
  }> | null;
  externalAgentId?: string | null;
  externalAgentName?: string | null;
  externalAgentIds?: string[] | null;
  externalAgentPhone?: string | null;
  stage?: string | null;
};

export function hasProjectBookingDate(projectFlow: MinimalProjectFlow | null | undefined) {
  return Boolean(String(projectFlow?.scheduledDate || "").trim());
}

export function hasProjectAssignedHandler(projectFlow: MinimalProjectFlow | null | undefined) {
  return Boolean(
    String(projectFlow?.handlerStaffId || "").trim() ||
      (Array.isArray(projectFlow?.handlerStaffIds) && projectFlow!.handlerStaffIds!.some((entry) => String(entry || "").trim())) ||
      String(projectFlow?.handlerStaffName || "").trim() ||
      (Array.isArray(projectFlow?.assignedHandlers) &&
        projectFlow!.assignedHandlers!.some(
          (entry) =>
            String(entry?.staffId || "").trim() ||
            String(entry?.staffName || "").trim() ||
            String(entry?.externalAgentId || "").trim() ||
            String(entry?.externalAgentName || "").trim() ||
            String(entry?.phone || "").trim(),
        )) ||
      String(projectFlow?.externalAgentId || "").trim() ||
      String(projectFlow?.externalAgentName || "").trim() ||
      (Array.isArray(projectFlow?.externalAgentIds) && projectFlow!.externalAgentIds!.some((entry) => String(entry || "").trim())) ||
      String(projectFlow?.externalAgentPhone || "").trim(),
  );
}

export function hasProjectAssignmentChange(changedFields: ProjectNotificationChangedField[]) {
  return changedFields.some(
    (field) =>
      field === "handlerStaffId" ||
      field === "handlerStaffName" ||
      field === "handlerType" ||
      field === "handlerAssignments" ||
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
  if (wasPreviouslyBooked) return false;
  return true;
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
