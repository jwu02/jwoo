import {
  aiUsageColorVar,
  aiUsageColorMap,
} from "@/lib/telemetry/ai-usage-colors";

describe("aiUsageColorVar", () => {
  describe("semantic colors for known AI entities (full strength)", () => {
    it("maps deepseek models (family prefix) to the blue var", () => {
      expect(aiUsageColorVar("deepseek-v4-flash", 0)).toBe(
        "var(--ai-deepseek)"
      );
      expect(aiUsageColorVar("deepseek-v4-pro", 0)).toBe("var(--ai-deepseek)");
    });

    it("maps kimi models to the purple var", () => {
      expect(aiUsageColorVar("kimi-k2.5", 0)).toBe("var(--ai-kimi)");
      expect(aiUsageColorVar("kimi-k2.7-code", 0)).toBe("var(--ai-kimi)");
    });

    it("maps glm models to the yellow var", () => {
      expect(aiUsageColorVar("glm-5.3-flash", 0)).toBe("var(--ai-glm)");
    });

    it("maps the Claude Code harness to the orange var", () => {
      expect(aiUsageColorVar("Claude Code", 0)).toBe("var(--claude-orange)");
      expect(aiUsageColorVar("claude-code", 0)).toBe("var(--claude-orange)");
    });

    it("maps the OpenCode harness to the white var", () => {
      expect(aiUsageColorVar("OpenCode", 0)).toBe("var(--ai-opencode)");
      expect(aiUsageColorVar("open-code", 0)).toBe("var(--ai-opencode)");
    });

    it("maps the DeepSeek Harness to the same blue as the deepseek models", () => {
      expect(aiUsageColorVar("DeepSeek Harness", 0)).toBe("var(--ai-deepseek)");
    });
  });

  describe("positional fallback for unknown entities", () => {
    it("reuses --chart-N by the caller's index", () => {
      expect(aiUsageColorVar("model-a", 0)).toBe("var(--chart-1)");
      expect(aiUsageColorVar("model-b", 1)).toBe("var(--chart-2)");
    });

    it("cycles through the 5 chart slots", () => {
      expect(aiUsageColorVar("work", 4)).toBe("var(--chart-5)");
      expect(aiUsageColorVar("work", 5)).toBe("var(--chart-1)");
      expect(aiUsageColorVar("work", 6)).toBe("var(--chart-2)");
    });

    it("keeps projects unknown so they stay positional", () => {
      expect(aiUsageColorVar("personal-site", 2)).toBe("var(--chart-3)");
    });
  });

  describe("normalization", () => {
    it("is case-insensitive", () => {
      expect(aiUsageColorVar("DEEPSEEK-V4", 0)).toBe("var(--ai-deepseek)");
      expect(aiUsageColorVar("Kimi-K2", 0)).toBe("var(--ai-kimi)");
      expect(aiUsageColorVar("opencode", 0)).toBe("var(--ai-opencode)");
    });

    it("collapses mixed separators to a single space", () => {
      expect(aiUsageColorVar("deepseek/v4-flash", 0)).toBe("var(--ai-deepseek)");
      expect(aiUsageColorVar("deepseek  v4", 0)).toBe("var(--ai-deepseek)");
    });
  });
});

describe("aiUsageColorMap", () => {
  it("gives each sibling model of a provider a distinct shaded blue", () => {
    const map = aiUsageColorMap([
      "deepseek-v4-pro",
      "deepseek-v4-flash",
      "deepseek-v4-flash-vision-exp",
    ]);
    const colors = [...map.values()];
    // Three models, three distinguishable shades, all in the deepseek hue.
    expect(colors).toHaveLength(3);
    expect(new Set(colors).size).toBe(3);
    expect(colors.every((c) => c.includes("--ai-deepseek"))).toBe(true);
    // The first sibling is the pure brand colour; the rest lighten toward white.
    expect(colors).toContain("var(--ai-deepseek)");
    expect(colors.some((c) => c.includes("color-mix"))).toBe(true);
  });

  it("assigns shades stably regardless of input order", () => {
    const a = aiUsageColorMap(["deepseek-v4-pro", "deepseek-v4-flash"]);
    const b = aiUsageColorMap(["deepseek-v4-flash", "deepseek-v4-pro"]);
    // Same model name resolves to the same shade either way.
    expect(a.get("deepseek-v4-flash")).toBe(b.get("deepseek-v4-flash"));
    expect(a.get("deepseek-v4-pro")).toBe(b.get("deepseek-v4-pro"));
    // And the two models still differ within each map.
    expect(a.get("deepseek-v4-flash")).not.toBe(a.get("deepseek-v4-pro"));
  });

  it("gives glm siblings distinct yellow shades", () => {
    const map = aiUsageColorMap(["glm-5.3-flash", "glm-5-air"]);
    expect(map.size).toBe(2);
    expect(new Set(map.values()).size).toBe(2);
    expect([...map.values()].every((c) => c.includes("--ai-glm"))).toBe(true);
  });

  it("gives kimi siblings distinct purple shades", () => {
    const map = aiUsageColorMap(["kimi-k2.5", "kimi-k2.7-code"]);
    expect(map.size).toBe(2);
    expect(new Set(map.values()).size).toBe(2);
    expect([...map.values()].every((c) => c.includes("--ai-kimi"))).toBe(true);
  });

  it("returns the base color (unmixed) for a lone family member", () => {
    // A harness view with a single deepseek entry is not a ramp.
    const map = aiUsageColorMap(["DeepSeek Harness"]);
    expect(map.get("DeepSeek Harness")).toBe("var(--ai-deepseek)");
  });

  it("omits unknown names so callers keep their positional fallback", () => {
    const map = aiUsageColorMap(["model-a", "work", "model-b"]);
    expect(map.size).toBe(0);
  });

  it("handles an empty list", () => {
    expect(aiUsageColorMap([]).size).toBe(0);
  });

  it("lightens later siblings toward white, not the dark background", () => {
    const map = aiUsageColorMap([
      "deepseek-v4-flash",
      "deepseek-v4-pro",
      "deepseek-v4-flash-vision-exp",
    ]);
    // The first sibling keeps the full-strength brand colour; each later one
    // mixes toward white so it reads as a lighter tint over a dark card (never
    // darker, which a mix toward the background would be in dark mode).
    expect(map.get("deepseek-v4-flash")).toBe("var(--ai-deepseek)");
    const middle = map.get("deepseek-v4-flash-vision-exp")!; // lexicographic index 1
    const last = map.get("deepseek-v4-pro")!;                // lexicographic index 2
    expect(middle).toMatch(/white\)$/);
    expect(last).toMatch(/white\)$/);
    // The last sibling takes a smaller percentage of the brand colour (more
    // white) than the middle one, i.e. it is a lighter tint.
    const pct = (c: string) => Number(c.match(/var\(--ai-deepseek\)\s+([\d.]+)%/)?.[1]);
    expect(pct(last)).toBeLessThan(pct(middle));
  });
});
