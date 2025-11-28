import { computeAdminSummary } from "./DailyTasksUI";

describe("computeAdminSummary", () => {
  test("normal numeric input", () => {
    const dayState = { promoVideosPosted: 2, demoVideosRecorded: 1, liveSessions: 1, leadsFollowed: 3, customersServed: 5, officeClean: true, stockChecked: false, meetingAttended: true, videoShoot: false, weekendPromosScheduled: false };
    const market = { newUploaded: 4, copiesUploaded: 2, productsEdited: 1, sales: [{ id: "1", name: "a", price: 100 }, { id: "2", name: "b", price: 200 }] };
    const s = computeAdminSummary(dayState as any, market as any);
    expect(s.videos).toBe(3); // promoVideosPosted + demoVideosRecorded
    expect(s.lives).toBe(1);
    expect(s.leads).toBe(3);
    expect(s.customers).toBe(5);
    expect(s.mk_new).toBe(4);
    expect(s.mk_copies).toBe(2);
    expect(s.mk_edits).toBe(1);
    expect(s.mk_sales).toBe(2);
    expect(s.totalSalesKES).toBe(300);
  });

  test("decimals are summed and rounded appropriately", () => {
    const dayState = {} as any;
    const market = { newUploaded: 0, copiesUploaded: 0, productsEdited: 0, sales: [{ id: "1", name: "A", price: 12500.5 }, { id: "2", name: "B", price: 499.5 }] } as any;
    const s = computeAdminSummary(dayState, market);
    // 12500.5 + 499.5 = 13000 (sum of decimals should be exact without fractional KES)
    expect(s.totalSalesKES).toBe(13000);
  });

  test("string prices: numeric strings are coerced to numbers", () => {
    const dayState = {} as any;
    const market = { newUploaded: 0, copiesUploaded: 0, productsEdited: 0, sales: [{ id: "1", name: "A", price: "2000" }, { id: "2", name: "B", price: 500 }] } as any;
    const s = computeAdminSummary(dayState, market);
    // RULE: numeric strings are coerced to numbers ("2000" -> 2000)
    // If you prefer treating string prices as invalid, update computeAdminSummary accordingly.
    expect(s.totalSalesKES).toBe(2500);
  });

  test("huge values handled safely", () => {
    const dayState = {} as any;
    const market = { newUploaded: 0, copiesUploaded: 0, productsEdited: 0, sales: [{ id: "1", name: "A", price: 1000000 }, { id: "2", name: "B", price: 2000000 }] } as any;
    const s = computeAdminSummary(dayState, market);
    expect(s.totalSalesKES).toBe(3000000);
  });

  test("stringified numbers and missing fields", () => {
    const dayState = { promoVideosPosted: "1", demoVideosRecorded: false } as any;
    const market = { newUploaded: "3", copiesUploaded: "", productsEdited: undefined, sales: [{ id: "1", name: "a", price: "50" }] } as any;
    const s = computeAdminSummary(dayState, market);
    expect(s.videos).toBe(1);
    expect(s.mk_new).toBe(3);
    expect(s.mk_copies).toBe(0);
    expect(s.mk_edits).toBe(0);
    expect(s.totalSalesKES).toBe(50);
    expect(s.mk_sales).toBe(1);
  });

  test("negative prices clamped to zero and non-numeric ignored", () => {
    const dayState = {} as any;
    const market = { newUploaded: 0, copiesUploaded: 0, productsEdited: 0, sales: [{ id: "1", name: "a", price: -10 }, { id: "2", name: "", price: 100 }, { id: "3", name: "c", price: "abc" }] } as any;
    const s = computeAdminSummary(dayState, market);
    // mk_sales counts rows with name and non-empty price only -> id:1 has name and price -10 (counts), id:2 has empty name (no), id:3 has name but non-numeric price treated as 0 but counts because price !== ""
    expect(s.mk_sales).toBe(2);
    expect(s.totalSalesKES).toBe(0); // -10 -> clamped 0, 'abc' -> 0
  });
});
