/**
 * @jest-environment node
 */

import { NextResponse } from "next/server";

jest.mock("@/lib/api", () => ({
  requireRole: jest.fn(),
}));

jest.mock("@/lib/reviewsReferrals", () => ({
  getReviewInvitationOperations: jest.fn(),
  retryReviewInvitationSend: jest.fn(),
}));

import { requireRole } from "@/lib/api";
import { getReviewInvitationOperations, retryReviewInvitationSend } from "@/lib/reviewsReferrals";
import { GET as getInvitations } from "@/app/api/admin/reviews-referrals/invitations/route";
import { POST as retryInvitation } from "@/app/api/admin/reviews-referrals/invitations/[id]/retry/route";

const mockedRequireRole = requireRole as jest.MockedFunction<typeof requireRole>;
const mockedGetReviewInvitationOperations = getReviewInvitationOperations as jest.MockedFunction<typeof getReviewInvitationOperations>;
const mockedRetryReviewInvitationSend = retryReviewInvitationSend as jest.MockedFunction<typeof retryReviewInvitationSend>;

describe("reviews referrals admin invitation APIs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireRole.mockResolvedValue({ ok: true, role: "ADMIN", session: {} as any });
  });

  it("returns auth response when invitation list access is denied", async () => {
    mockedRequireRole.mockResolvedValueOnce({
      ok: false,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as any);

    const response = await getInvitations(new Request("http://localhost/api/admin/reviews-referrals/invitations"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(mockedGetReviewInvitationOperations).not.toHaveBeenCalled();
  });

  it("passes normalized filters to invitation operations listing", async () => {
    mockedGetReviewInvitationOperations.mockResolvedValueOnce([
      {
        id: "inv_1",
        customerName: "Jane",
      } as any,
    ]);

    const response = await getInvitations(
      new Request("http://localhost/api/admin/reviews-referrals/invitations?status=FAILED&limit=20"),
    );

    expect(response.status).toBe(200);
    expect(mockedGetReviewInvitationOperations).toHaveBeenCalledWith({
      status: "failed",
      limit: 20,
    });
    expect(await response.json()).toEqual({
      ok: true,
      invitations: [{ id: "inv_1", customerName: "Jane" }],
    });
  });

  it("returns retry payload for a specific invitation", async () => {
    mockedRetryReviewInvitationSend.mockResolvedValueOnce({
      result: { invitationId: "inv_retry_1", status: "sent" } as any,
      invitation: { id: "inv_retry_1", lastSendStatus: "SENT" } as any,
    });

    const response = await retryInvitation(new Request("http://localhost/api/admin/reviews-referrals/invitations/inv_retry_1/retry", {
      method: "POST",
    }), {
      params: Promise.resolve({ id: "inv_retry_1" }),
    });

    expect(response.status).toBe(200);
    expect(mockedRetryReviewInvitationSend).toHaveBeenCalledWith("inv_retry_1");
    expect(await response.json()).toEqual({
      ok: true,
      result: { invitationId: "inv_retry_1", status: "sent" },
      invitation: { id: "inv_retry_1", lastSendStatus: "SENT" },
    });
  });

  it("maps retry not-found errors to 404", async () => {
    mockedRetryReviewInvitationSend.mockRejectedValueOnce(new Error("Review invitation not found."));

    const response = await retryInvitation(new Request("http://localhost/api/admin/reviews-referrals/invitations/missing/retry", {
      method: "POST",
    }), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      ok: false,
      error: "Review invitation not found.",
    });
  });

  it("maps retry validation errors to 400", async () => {
    mockedRetryReviewInvitationSend.mockRejectedValueOnce(new Error("This review invitation was already sent."));

    const response = await retryInvitation(new Request("http://localhost/api/admin/reviews-referrals/invitations/inv_sent/retry", {
      method: "POST",
    }), {
      params: Promise.resolve({ id: "inv_sent" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: "This review invitation was already sent.",
    });
  });
});
