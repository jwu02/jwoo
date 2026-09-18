import { getBucketInterval } from "@/lib/ai-usage/ranges";
import { Range } from "@/lib/ranges";

// The AI-usage bucket interval is deliberately not the shared one: this
// dashboard's 24h view buckets hourly rather than in telemetry's 30-minute bins.
describe("getBucketInterval", () => {
  it.each([
    ["24h", { unit: "hour", binSize: 1 }],
    ["30d", { unit: "day", binSize: 1 }],
    ["1y", { unit: "month", binSize: 1 }],
  ] as [Range, { unit: string; binSize: number }][])(
    "returns the correct interval for %s",
    (range, expected) => {
      expect(getBucketInterval(range)).toEqual(expected);
    }
  );
});
