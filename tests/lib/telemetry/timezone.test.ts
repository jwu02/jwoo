import {
  getTimezoneOffsetMs,
  isValidTimeZone,
  alignToInterval,
} from "@/lib/telemetry/timezone";

describe("getTimezoneOffsetMs", () => {
  it("returns 0 for UTC", () => {
    expect(
      getTimezoneOffsetMs(new Date("2026-08-22T18:18:16.000Z"), "UTC")
    ).toBe(0);
  });

  it("returns +8h for Asia/Shanghai", () => {
    expect(
      getTimezoneOffsetMs(new Date("2026-08-22T18:18:16.000Z"), "Asia/Shanghai")
    ).toBe(8 * 60 * 60 * 1000);
  });

  it("ignores the input's milliseconds", () => {
    // Intl only reports whole seconds, so the offset must not come back short
    // by the input's millisecond remainder (which would leak into buckets).
    expect(
      getTimezoneOffsetMs(new Date("2026-08-22T18:18:16.535Z"), "Asia/Shanghai")
    ).toBe(8 * 60 * 60 * 1000);
  });
});

describe("isValidTimeZone", () => {
  it("accepts a valid IANA name", () => {
    expect(isValidTimeZone("Asia/Shanghai")).toBe(true);
  });

  it("rejects null and garbage values", () => {
    expect(isValidTimeZone(null)).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});

describe("alignToInterval", () => {
  it("aligns day buckets to local midnight for Asia/Shanghai", () => {
    // Sunday 02:18 local is Saturday 18:18 UTC.
    const date = new Date("2026-08-22T18:18:16.000Z");
    const aligned = alignToInterval(
      date,
      { unit: "day", binSize: 1 },
      "Asia/Shanghai"
    );
    // Local Sunday Aug 23 00:00 == UTC Saturday Aug 22 16:00.
    expect(aligned.toISOString()).toBe("2026-08-22T16:00:00.000Z");
  });

  it("aligns day buckets to UTC midnight by default", () => {
    const date = new Date("2026-08-22T18:18:16.000Z");
    const aligned = alignToInterval(date, { unit: "day", binSize: 1 }, "UTC");
    expect(aligned.toISOString()).toBe("2026-08-22T00:00:00.000Z");
  });

  it("floors away the input's milliseconds", () => {
    const date = new Date("2026-08-22T18:18:16.535Z");
    const aligned = alignToInterval(
      date,
      { unit: "day", binSize: 1 },
      "Asia/Shanghai"
    );
    expect(aligned.toISOString()).toBe("2026-08-22T16:00:00.000Z");
  });
});
