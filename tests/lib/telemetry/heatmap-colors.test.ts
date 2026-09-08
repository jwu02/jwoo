import {
  keyIntensity,
  keycapColor,
  oklchToSrgbHex,
} from "@/lib/telemetry/heatmap-colors";

describe("keyIntensity", () => {
  it("scales a count by maxCount", () => {
    expect(keyIntensity(25, 100)).toBe(0.25);
    expect(keyIntensity(100, 100)).toBe(1);
    expect(keyIntensity(0, 100)).toBe(0);
  });

  it("floors maxCount at 1 so a lone key saturates", () => {
    expect(keyIntensity(5, 0)).toBe(1);
    expect(keyIntensity(0, 0)).toBe(0);
  });

  it("clamps out-of-range inputs", () => {
    expect(keyIntensity(-3, 10)).toBe(0);
    expect(keyIntensity(50, 10)).toBe(1);
  });
});

describe("oklchToSrgbHex", () => {
  it("converts the ramp anchor colours to the legacy SVG pins", () => {
    // Cold: oklch(0.25 0 45) → the near-black "never pressed" cap.
    expect(oklchToSrgbHex(0.25, 0, 45)).toBe("#222222");
    // Midpoint: oklch(0.445 0.08 45).
    expect(oklchToSrgbHex(0.25 + 0.5 * 0.39, 0.5 * 0.16, 45)).toBe("#78442d");
    // Hot: oklch(0.64 0.16 45) → the warm orange cap.
    expect(oklchToSrgbHex(0.64, 0.16, 45)).toBe("#d8662a");
  });

  it("neutral colours are achromatic regardless of hue", () => {
    expect(oklchToSrgbHex(0.25, 0, 0)).toBe("#222222");
    expect(oklchToSrgbHex(0.25, 0, 200)).toBe("#222222");
  });
});

describe("keycapColor", () => {
  it("reproduces the intensified ramp at the three pinned intensities", () => {
    expect(keycapColor(0)).toBe("#222222");
    expect(keycapColor(0.5)).toBe("#8c3d12");
    expect(keycapColor(1)).toBe("#ff4c00");
  });

  // Perceived lightness of a hex colour (Rec.601 luma over sRGB).
  function luma(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  it("is monotonic in lightness (0 → 1 darkens less, warms up)", () => {
    const dark = luma(keycapColor(0));
    const mid = luma(keycapColor(0.5));
    const hot = luma(keycapColor(1));
    expect(dark).toBeLessThan(mid);
    expect(mid).toBeLessThan(hot);
  });
});
