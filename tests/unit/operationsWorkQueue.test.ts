import {
  isOpenQuotationStatus,
  isOpenWorkItemStatus,
  isPendingPodStatus,
  wasCreatedOrUpdatedInPeriod,
} from "@/lib/operationsWorkQueue";

describe("operations work queue helpers", () => {
  const period = {
    start: new Date("2026-05-25T00:00:00.000Z"),
    end: new Date("2026-06-24T23:59:59.999Z"),
  };

  it("shows quotations with new status", () => {
    expect(isOpenQuotationStatus("new")).toBe(true);
  });

  it("shows quotations with contacted status", () => {
    expect(isOpenQuotationStatus("contacted")).toBe(true);
  });

  it("hides quotations with closed status", () => {
    expect(isOpenQuotationStatus("closed")).toBe(false);
  });

  it("removes a quotation from the queue once it becomes closed", () => {
    expect(isOpenQuotationStatus("quoted")).toBe(true);
    expect(isOpenQuotationStatus("closed")).toBe(false);
  });

  it("shows pending POD items", () => {
    expect(isPendingPodStatus("pending")).toBe(true);
  });

  it("hides delivered POD items", () => {
    expect(isPendingPodStatus("delivered")).toBe(false);
  });

  it("keeps items updated within the active period", () => {
    expect(
      wasCreatedOrUpdatedInPeriod(
        "2026-05-01T10:00:00.000Z",
        "2026-06-10T10:00:00.000Z",
        period,
      ),
    ).toBe(true);
  });

  it("hides items outside the active period when unchanged", () => {
    expect(
      wasCreatedOrUpdatedInPeriod(
        "2026-05-01T10:00:00.000Z",
        "2026-05-10T10:00:00.000Z",
        period,
      ),
    ).toBe(false);
  });

  it("treats completed work items as closed", () => {
    expect(isOpenWorkItemStatus("completed")).toBe(false);
    expect(isOpenWorkItemStatus("processing")).toBe(true);
  });
});

