process.env.TZ = "Asia/Shanghai";

import { formatTick, formatTooltip } from "@/lib/telemetry/chart-format";

describe("formatTick", () => {
  const bucket = "2025-08-09T03:00:00.000Z"; // 11:00 CST

  it("formats 24h range as 24-hour time", () => {
    expect(formatTick(bucket, "24h")).toBe("11:00");
  });

  it("formats 7d range as month and day", () => {
    expect(formatTick(bucket, "7d")).toBe("Aug 9");
  });

  it("formats 1y range as month and year", () => {
    expect(formatTick(bucket, "1y")).toBe("Aug 2025");
  });
});

describe("formatTooltip", () => {
  const bucket = "2025-08-09T03:00:00.000Z"; // 11:00 CST

  it("formats 24h tooltip as short date and 24-hour time", () => {
    expect(formatTooltip(bucket, "24h")).toBe("8/9/2025, 11:00");
  });

  it("formats 7d tooltip as weekday, month, day, year, and 24-hour time", () => {
    expect(formatTooltip(bucket, "7d")).toBe("Sat, Aug 9, 2025, 11:00");
  });

  it("formats 1y tooltip as month, day, and year", () => {
    expect(formatTooltip(bucket, "1y")).toBe("Aug 9, 2025");
  });
});
