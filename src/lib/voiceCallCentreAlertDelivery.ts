import type { ChatraceDividedResult } from "@/lib/integrations/chatraceDivided";

export type ChatraceHealthSync = (input: {
  phone: string;
  firstName: string;
  fields: Record<string, string>;
  tagsToAdd?: string[];
  tagDelayMs?: number;
}) => Promise<ChatraceDividedResult>;

export type OrderedDeliveryResult = {
  ok: boolean;
  contactId: string | null;
  issueFieldUpdated: boolean;
  timeFieldUpdated: boolean;
  tagApplied: boolean;
  tagAttempted: boolean;
  error: string | null;
};

export async function runOrderedChatraceHealthDelivery(input: {
  phone: string;
  firstName: string;
  issue: string;
  alertTime: string;
  sync: ChatraceHealthSync;
  afterIssueUpdated?: (contactId: string | null) => Promise<void>;
  afterTimeUpdated?: (contactId: string | null) => Promise<void>;
  beforeTagAttempt?: () => Promise<void>;
}): Promise<OrderedDeliveryResult> {
  let contactId: string | null = null;
  let issueResult: ChatraceDividedResult;
  try {
    issueResult = await input.sync({
      phone: input.phone,
      firstName: input.firstName,
      fields: { "Call Centre Alert Issue": input.issue },
    });
  } catch (error) {
    return {
      ok: false,
      contactId,
      issueFieldUpdated: false,
      timeFieldUpdated: false,
      tagApplied: false,
      tagAttempted: false,
      error: error instanceof Error ? error.message : "issue_field_update_failed",
    };
  }
  contactId = issueResult.contactId;
  if (!issueResult.ok) {
    return {
      ok: false,
      contactId,
      issueFieldUpdated: false,
      timeFieldUpdated: false,
      tagApplied: false,
      tagAttempted: false,
      error: issueResult.debug.error || "issue_field_update_failed",
    };
  }
  await input.afterIssueUpdated?.(contactId);

  let timeResult: ChatraceDividedResult;
  try {
    timeResult = await input.sync({
      phone: input.phone,
      firstName: input.firstName,
      fields: { "Call Centre Alert Time": input.alertTime },
    });
  } catch (error) {
    return {
      ok: false,
      contactId,
      issueFieldUpdated: true,
      timeFieldUpdated: false,
      tagApplied: false,
      tagAttempted: false,
      error: error instanceof Error ? error.message : "time_field_update_failed",
    };
  }
  contactId = timeResult.contactId || contactId;
  if (!timeResult.ok) {
    return {
      ok: false,
      contactId,
      issueFieldUpdated: true,
      timeFieldUpdated: false,
      tagApplied: false,
      tagAttempted: false,
      error: timeResult.debug.error || "time_field_update_failed",
    };
  }
  await input.afterTimeUpdated?.(contactId);

  await input.beforeTagAttempt?.();
  let tagResult: ChatraceDividedResult;
  try {
    tagResult = await input.sync({
      phone: input.phone,
      firstName: input.firstName,
      fields: {},
      tagsToAdd: ["betech_call_centre_health_alert"],
      tagDelayMs: 0,
    });
  } catch (error) {
    return {
      ok: false,
      contactId,
      issueFieldUpdated: true,
      timeFieldUpdated: true,
      tagApplied: false,
      tagAttempted: true,
      error: error instanceof Error ? error.message : "tag_application_failed",
    };
  }
  contactId = tagResult.contactId || contactId;
  return {
    ok: tagResult.ok,
    contactId,
    issueFieldUpdated: true,
    timeFieldUpdated: true,
    tagApplied: tagResult.ok,
    tagAttempted: true,
    error: tagResult.ok ? null : tagResult.debug.error || "tag_application_failed",
  };
}
