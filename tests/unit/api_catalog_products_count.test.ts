import { GET } from "../../src/app/api/catalog/products-count/route";

jest.mock("@/lib/redis", () => {
  const store = new Map<string, string>();
  return {
    getRedis: async () => ({
      get: async (k: string) => store.get(k) || null,
      set: async (...args: any[]) => {
        const [k, v] = args; // ignore EX for simplicity
        store.set(String(k), String(v));
        return "OK";
      },
    }),
  };
});

jest.mock("@/lib/jumia", () => {
  return {
    getShops: async () => [{ id: "s1", name: "Shop 1" }, { id: "s2", name: "Shop 2" }],
    getCatalogProductsCountQuickForShop: async ({ shopId }: { shopId: string }) => ({
      total: shopId === "s1" ? 10 : 20,
      approx: false,
      byStatus: { active: shopId === "s1" ? 8 : 15 },
      byQcStatus: { approved: shopId === "s1" ? 7 : 12 },
    }),
    getCatalogProductsCountExactForShop: async ({ shopId }: { shopId: string }) => ({
      total: shopId === "abc" ? 42 : 5,
      approx: false,
      byStatus: { active: shopId === "abc" ? 40 : 5 },
      byQcStatus: { approved: shopId === "abc" ? 39 : 5 },
    }),
    getCatalogProductsCountExactAll: async () => ({
      total: 33,
      approx: false,
      byStatus: { active: 30 },
      byQcStatus: { approved: 29 },
    }),
  };
});

describe("/api/catalog/products-count", () => {
  it("caches per-shop quick counts", async () => {
    const req1 = new Request("http://localhost/api/catalog/products-count?shopId=s1");
    const res1 = await GET(req1);
    expect(res1.status).toBe(200);
    expect(res1.headers.get("x-cache")).toBe("miss");
    const j1 = await res1.json();
    expect(j1.total).toBe(10); // from mocked quick for s1

    const req2 = new Request("http://localhost/api/catalog/products-count?shopId=s1");
    const res2 = await GET(req2);
    expect(res2.status).toBe(200);
    expect(res2.headers.get("x-cache")).toBe("hit");
    const j2 = await res2.json();
    expect(j2.total).toBe(j1.total);
  });

  it("aggregates all shops in quick mode", async () => {
    const req = new Request("http://localhost/api/catalog/products-count?all=true");
    const res = await GET(req);
    const j = await res.json();
    expect(j.total).toBe(30); // 10 + 20
    expect(j.byStatus.active).toBe(23); // 8 + 15
  });

  it("uses exact function when exact=true", async () => {
    const req = new Request("http://localhost/api/catalog/products-count?all=true&exact=true");
    const res = await GET(req);
    const j = await res.json();
    expect(j.total).toBe(33);
    expect(j.approx).toBe(false);
  });
});
