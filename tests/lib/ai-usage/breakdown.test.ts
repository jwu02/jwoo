import {
  buildDonutSegments,
  MAX_SEGMENTS,
  OTHERS_SEGMENT,
  BreakdownRow,
} from "@/lib/ai-usage/breakdown";

function row(
  label: string,
  costYuan: number,
  totalTokens: number
): BreakdownRow {
  return { id: label, label, costYuan, totalTokens };
}

describe("buildDonutSegments", () => {
  it("keeps every row when there are fewer than the cap", () => {
    const segments = buildDonutSegments(
      [row("a", 3, 30), row("b", 2, 20), row("c", 1, 10)],
      "costYuan"
    );
    expect(segments).toEqual([
      { label: "a", value: 3 },
      { label: "b", value: 2 },
      { label: "c", value: 1 },
    ]);
  });

  it("folds everything past the seventh into one Others segment", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      row(String.fromCharCode(97 + i), 10 - i, 10 - i)
    );
    const segments = buildDonutSegments(rows, "costYuan");
    expect(segments.map((segment) => segment.label)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      OTHERS_SEGMENT,
    ]);
    // Rows h, i, j hold 3 + 2 + 1.
    expect(segments.at(-1)).toEqual({ label: OTHERS_SEGMENT, value: 6 });
  });

  it("never draws more than the cap", () => {
    const rows = Array.from({ length: 50 }, (_, i) =>
      row(`m${i}`, 50 - i, 50 - i)
    );
    expect(buildDonutSegments(rows, "costYuan")).toHaveLength(MAX_SEGMENTS);
  });

  it("ranks each metric on its own", () => {
    // Cost descends a..h while tokens ascend a..h, so the two donuts keep
    // different sets: the cost donut drops `h`, the token donut drops `a`.
    const rows = Array.from({ length: 8 }, (_, i) =>
      row(String.fromCharCode(97 + i), 8 - i, i + 1)
    );

    const cost = buildDonutSegments(rows, "costYuan").map((s) => s.label);
    const tokens = buildDonutSegments(rows, "totalTokens").map((s) => s.label);

    expect(cost).toEqual(["a", "b", "c", "d", "e", "f", "g", OTHERS_SEGMENT]);
    expect(tokens).toEqual(["h", "g", "f", "e", "d", "c", "b", OTHERS_SEGMENT]);
  });

  it("sums a row already called Others into the combined segment", () => {
    const rows = [
      ...Array.from({ length: 8 }, (_, i) =>
        row(`n${i}`, 8 - i, 8 - i)
      ),
      row(OTHERS_SEGMENT, 0.5, 0.5),
    ];
    const segments = buildDonutSegments(rows, "costYuan");
    const others = segments.filter(
      (segment) => segment.label === OTHERS_SEGMENT
    );
    expect(others).toHaveLength(1);
    // The fallback row (0.5) joins the folded tail (`n7`, worth 1).
    expect(others[0].value).toBe(1.5);
  });

  it("drops rows with no value", () => {
    const segments = buildDonutSegments(
      [row("zero", 0, 0), row("a", 1, 1)],
      "costYuan"
    );
    expect(segments).toEqual([{ label: "a", value: 1 }]);
  });

  it("breaks a ranking tie by label", () => {
    const segments = buildDonutSegments(
      [row("b", 5, 0), row("a", 5, 0)],
      "costYuan"
    );
    expect(segments.map((segment) => segment.label)).toEqual(["a", "b"]);
  });

  it("draws nothing when every row is empty", () => {
    expect(buildDonutSegments([row("a", 0, 0)], "totalTokens")).toEqual([]);
  });
});
