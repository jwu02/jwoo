import { formatTokens } from "@/lib/ai-usage/format";

describe("formatTokens", () => {
  it("compacts to M/K like the generic formatter", () => {
    expect(formatTokens(1_250_000)).toBe("1.3M");
    expect(formatTokens(2_500)).toBe("2.5K");
  });

  it("keeps one decimal on a whole count", () => {
    expect(formatTokens(2_000_000)).toBe("2.0M");
    expect(formatTokens(550_000)).toBe("550.0K");
  });
});
