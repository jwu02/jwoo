process.env.TZ = "Asia/Shanghai";

import {
  formatTick,
  formatTooltip,
  formatCompactNumber,
  estimateTickLabelWidth,
} from "@/lib/telemetry/chart-format";

describe("formatTick", () => {
  const bucket = "2025-08-09T03:00:00.000Z"; // 11:00 CST

  it("formats 24h range as 24-hour time", () => {
    expect(formatTick(bucket, "24h")).toBe("11:00");
  });

  it("formats 30d range as month and day", () => {
    expect(formatTick(bucket, "30d")).toBe("Aug 9");
  });

  it("formats 1y range as month and year", () => {
    expect(formatTick(bucket, "1y")).toBe("Aug 2025");
  });
});

describe("formatTooltip", () => {
  const bucket = "2025-08-09T03:00:00.000Z"; // 11:00 CST

  it("formats 24h tooltip as weekday, month, day, and 24-hour time", () => {
    expect(formatTooltip(bucket, "24h")).toBe("Sat, Aug 9, 11:00");
  });

  it("formats 30d tooltip as weekday, month, day, and year without time", () => {
    expect(formatTooltip(bucket, "30d")).toBe("Sat, Aug 9, 2025");
  });

  it("formats 1y tooltip as month and year", () => {
    expect(formatTooltip(bucket, "1y")).toBe("Aug, 2025");
  });
});

describe("estimateTickLabelWidth", () => {
  const bucket = "2025-08-09T03:00:00.000Z"; // 11:00 CST

  // The expected widths are the ones the browser reports for these labels on a
  // rendered axis (fontSize 12): "11:00" and "Aug 9" render 36px, "Aug 2025"
  // renders 57.6px.
  it("matches the rendered width of a 24h label", () => {
    expect(estimateTickLabelWidth(bucket, "24h")).toBe(36);
  });

  it("matches the rendered width of a 30d label", () => {
    expect(estimateTickLabelWidth(bucket, "30d")).toBe(36);
  });

  it("matches the rendered width of a 1y label", () => {
    expect(estimateTickLabelWidth("2025-08-20T16:00:00.000Z", "1y")).toBe(57.6);
  });
});

describe("formatCompactNumber", () => {
  it("formats millions with an M suffix", () => {
    expect(formatCompactNumber(1_200_000)).toBe("1.2M");
    expect(formatCompactNumber(1_000_000)).toBe("1M");
  });

  it("formats thousands with a K suffix", () => {
    expect(formatCompactNumber(550_000)).toBe("550K");
    expect(formatCompactNumber(2_500)).toBe("2.5K");
  });

  it("leaves small numbers compact", () => {
    expect(formatCompactNumber(1.25)).toBe("1.3");
    expect(formatCompactNumber(0)).toBe("0");
  });
});
