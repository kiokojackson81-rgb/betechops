import { estimateNeedBasedLoad } from "@/lib/aiLoadEstimator";

describe("estimateNeedBasedLoad", () => {
  it("estimates five bulbs with default hours", () => {
    const result = estimateNeedBasedLoad("I have 5 bulbs");
    expect(result).not.toBeNull();
    expect(result?.runningLoadWatts).toBe(50);
    expect(result?.dailyEnergyWh).toBe(250);
    expect(result?.recommendedSearchQuery).toBe("100W solar full kit");
  });

  it("estimates bulbs and a 32 inch tv", () => {
    const result = estimateNeedBasedLoad("I have 5 bulbs and 32 inch TV");
    expect(result).not.toBeNull();
    expect(result?.runningLoadWatts).toBe(100);
    expect(result?.recommendedSearchQuery).toBe("150W solar full kit");
  });

  it("estimates starlink as a need-based lithium recommendation", () => {
    const result = estimateNeedBasedLoad("I need solar for Starlink");
    expect(result).not.toBeNull();
    expect(result?.runningLoadWatts).toBe(75);
    expect(result?.dailyEnergyWh).toBe(1800);
    expect(result?.recommendedSearchQuery).toBe("1KW lithium solar kit");
  });

  it("flags heavy mixed loads for human sizing", () => {
    const result = estimateNeedBasedLoad("I have microwave, fridge, washing machine and pump");
    expect(result).not.toBeNull();
    expect(result?.needsSizing).toBe(true);
    expect(result?.recommendationClass).toBe("system_quote");
  });
});
