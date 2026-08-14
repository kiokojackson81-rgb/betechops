jest.mock("server-only", () => ({}), { virtual: true });

import { pickNextRoundRobinAgent } from "@/lib/lipaPolePoleService";

describe("lipaPolePoleService", () => {
  test("round robin starts from the first sorted eligible agent", () => {
    const next = pickNextRoundRobinAgent(
      [
        { id: "b", name: "Jeniffer", email: "jeniffer@betech.co.ke", role: "ATTENDANT", attendantCategory: "BETECH_OPS" },
        { id: "a", name: "Breadh", email: "breadh@betech.co.ke", role: "ATTENDANT", attendantCategory: "BETECH_OPS" },
      ],
      null,
    );

    expect(next.id).toBe("a");
  });

  test("round robin advances to the next eligible agent", () => {
    const next = pickNextRoundRobinAgent(
      [
        { id: "a", name: "Breadh", email: "breadh@betech.co.ke", role: "ATTENDANT", attendantCategory: "BETECH_OPS" },
        { id: "b", name: "Jeniffer", email: "jeniffer@betech.co.ke", role: "ATTENDANT", attendantCategory: "BETECH_OPS" },
        { id: "c", name: "Mercy", email: "mercy@betech.co.ke", role: "ATTENDANT", attendantCategory: "BETECH_OPS" },
      ],
      "b",
    );

    expect(next.id).toBe("c");
  });

  test("round robin wraps when the previous agent was the last one", () => {
    const next = pickNextRoundRobinAgent(
      [
        { id: "a", name: "Breadh", email: "breadh@betech.co.ke", role: "ATTENDANT", attendantCategory: "BETECH_OPS" },
        { id: "b", name: "Jeniffer", email: "jeniffer@betech.co.ke", role: "ATTENDANT", attendantCategory: "BETECH_OPS" },
      ],
      "b",
    );

    expect(next.id).toBe("a");
  });
});
