import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { cloneElement } from "react";
import {
  UsageChart,
  formatCostAxisLabel,
  formatMillionsAxisLabel,
  buildModelChartData,
} from "@/components/ai-usage/usage-chart";
import { AiUsageModelTimeSeries } from "@/lib/telemetry/types";

jest.mock("recharts", () => {
  const actual = jest.requireActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      cloneElement(
        children as React.ReactElement<{ width?: number; height?: number }>,
        { width: 800, height: 400 }
      ),
  };
});

const fakeRect = {
  width: 800,
  height: 400,
  left: 0,
  top: 0,
  right: 800,
  bottom: 400,
  x: 0,
  y: 0,
  toJSON: () => {},
};

// UsageChart renders two stacked line charts (cost, then tokens). Hover the
// wrapper at `chartIndex` and read every tooltip listitem that is on screen.
async function readTooltipItems(chartIndex: number) {
  const wrapper =
    document.querySelectorAll(".recharts-wrapper")[chartIndex]!;
  fireEvent.mouseMove(wrapper, { clientX: 400, clientY: 200 });
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  return Array.from(
    document.querySelectorAll(".recharts-tooltip-wrapper")
  ).flatMap((tooltip) =>
    within(tooltip as HTMLElement)
      .queryAllByRole("listitem")
      .map((li) => li.textContent)
  );
}

// Recharts 3.x renders bar shapes only after the bars' entrance animation
// has ticked to completion (~400ms of requestAnimationFrame frames). jsdom
// never runs those frames on its own, so advance enough of them for the bar
// rects to appear in the DOM before asserting on them.
async function settleBarAnimation() {
  await act(async () => {
    await new Promise((resolve) => {
      let frames = 0;
      const tick = () => {
        frames++;
        if (frames >= 40) resolve(true);
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  });
}

// Two models, highest total cost first (model-b), matching the API order.
function buildModelData(): AiUsageModelTimeSeries[] {
  const buckets = Array.from({ length: 4 }, (_, i) =>
    new Date(Date.UTC(2025, 7, 9, i * 6)).toISOString()
  );
  return [
    {
      model: "model-b",
      points: buckets.map((bucket, i) => ({
        bucket,
        costYuan: 0.5 + i * 0.25,
        totalTokens: 500_000 + i * 250_000,
      })),
    },
    {
      model: "model-a",
      points: buckets.map((bucket, i) => ({
        bucket,
        costYuan: 0.25 + i * 0.1,
        totalTokens: 100_000 + i * 50_000,
      })),
    },
  ];
}

// A single model whose per-bucket cost stays under ¥0.05, where the compact
// M/K axis formatter would round every tick down to "0".
function buildTinyCostData(): AiUsageModelTimeSeries[] {
  const buckets = Array.from({ length: 4 }, (_, i) =>
    new Date(Date.UTC(2025, 7, 9, i * 6)).toISOString()
  );
  return [
    {
      model: "model-a",
      points: buckets.map((bucket, i) => ({
        bucket,
        costYuan: 0.01 + i * 0.01,
        totalTokens: 1_000_000 + i * 100_000,
      })),
    },
  ];
}

// Three models: model-a's values exceed model-b's in every bucket, but the
// input order lists model-b first, so an unsorted tooltip would show model-b
// above model-a. model-c is idle everywhere (all zeros) and must not appear
// in the tooltip at all.
function buildMixedActivityData(): AiUsageModelTimeSeries[] {
  const buckets = Array.from({ length: 4 }, (_, i) =>
    new Date(Date.UTC(2025, 7, 9, i * 6)).toISOString()
  );
  return [
    {
      model: "model-b",
      points: buckets.map((bucket, i) => ({
        bucket,
        costYuan: 0.25 + i * 0.1,
        totalTokens: 100_000 + i * 50_000,
      })),
    },
    {
      model: "model-a",
      points: buckets.map((bucket, i) => ({
        bucket,
        costYuan: 0.5 + i * 0.25,
        totalTokens: 500_000 + i * 250_000,
      })),
    },
    {
      model: "model-c",
      points: buckets.map((bucket) => ({
        bucket,
        costYuan: 0,
        totalTokens: 0,
      })),
    },
  ];
}

// The charts size their Y axis from the rendered tick labels (`width="auto"`),
// measuring each `.recharts-cartesian-axis-tick-value` node. The blunt fakeRect
// below reports every element as 800px wide, which would size the axis to the
// whole chart and collapse the plot area, so tick labels report a realistic
// label width instead.
const TICK_LABEL_WIDTH = 40;

beforeAll(() => {
  jest
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: Element) {
      if (this.classList?.contains("recharts-cartesian-axis-tick-value")) {
        return {
          ...fakeRect,
          width: TICK_LABEL_WIDTH,
          right: TICK_LABEL_WIDTH,
        } as DOMRect;
      }
      return fakeRect as DOMRect;
    });
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe("formatCostAxisLabel", () => {
  it("keeps decimals for small yuan values", () => {
    expect(formatCostAxisLabel(0.01)).toBe("0.01");
    expect(formatCostAxisLabel(0.5)).toBe("0.5");
    expect(formatCostAxisLabel(0.001)).toBe("0.001");
  });

  it("rounds larger values to two decimals without K/M suffixes", () => {
    expect(formatCostAxisLabel(12.345)).toBe("12.35");
    expect(formatCostAxisLabel(1250)).toBe("1250");
  });

  it("renders zero as 0", () => {
    expect(formatCostAxisLabel(0)).toBe("0");
  });
});

describe("formatMillionsAxisLabel", () => {
  it("shows the value in millions with no M suffix", () => {
    expect(formatMillionsAxisLabel(1_250_000)).toBe("1.25");
    expect(formatMillionsAxisLabel(500_000)).toBe("0.5");
    expect(formatMillionsAxisLabel(1_000_000)).toBe("1");
    expect(formatMillionsAxisLabel(0)).toBe("0");
  });
});

describe("buildModelChartData", () => {
  it("builds wide rows with per-model token and cost keys", () => {
    const { rows, series } = buildModelChartData(buildModelData());

    expect(series).toEqual([
      { model: "model-b", tokensKey: "tokens:model-b", costKey: "cost:model-b" },
      { model: "model-a", tokensKey: "tokens:model-a", costKey: "cost:model-a" },
    ]);

    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      bucket: expect.any(String),
      "tokens:model-b": 500_000,
      "cost:model-b": 0.5,
      "tokens:model-a": 100_000,
      "cost:model-a": 0.25,
    });
  });

  it("fills absent buckets with zeros instead of dropping rows", () => {
    const [modelB, modelA] = buildModelData();
    modelA.points = modelA.points.slice(1); // drop model-a's first bucket

    const { rows } = buildModelChartData([modelB, modelA]);

    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      "tokens:model-b": 500_000,
      "tokens:model-a": 0,
      "cost:model-a": 0,
    });
  });

  it("returns empty rows and series when there are no models", () => {
    const { rows, series } = buildModelChartData([]);
    expect(rows).toEqual([]);
    expect(series).toEqual([]);
  });

  it("orders series by modelOrder when provided, ignoring input order", () => {
    // Input is range-cost-desc (model-b first), but the table ranks model-a
    // first; the chart must follow the table.
    const { series } = buildModelChartData(buildModelData(), [
      "model-a",
      "model-b",
    ]);
    expect(series.map((s) => s.model)).toEqual(["model-a", "model-b"]);
  });
});

describe("UsageChart", () => {
  it("renders one stacked bar segment per model on each chart", async () => {
    const { container } = render(
      <UsageChart data={buildModelData()} range="24h" />
    );
    await settleBarAnimation();

    const rects = Array.from(
      container.querySelectorAll(".recharts-rectangle")
    );
    const fills = rects.map((rect) => rect.getAttribute("fill"));

    // 4 buckets × 2 models per chart, tokens and cost → 16 segments.
    expect(rects).toHaveLength(16);

    // Each model keeps the same color across both charts, keyed to its
    // table position (--chart-1 for model-b, --chart-2 for model-a).
    expect(new Set(fills)).toEqual(
      new Set(["var(--chart-1)", "var(--chart-2)"])
    );
  });

  it("stacks each bucket's segments instead of placing them side by side", async () => {
    const { container } = render(
      <UsageChart data={buildModelData()} range="24h" />
    );
    await settleBarAnimation();

    // Both charts share the same bucket x-positions; within each chart the
    // two models' segments of a bucket must sit directly atop one another
    // (the top segment's bottom edge equals the bottom segment's top).
    for (const wrapper of container.querySelectorAll(".recharts-wrapper")) {
      const byX = new Map<number, Element[]>();
      for (const rect of Array.from(
        wrapper.querySelectorAll(".recharts-rectangle")
      )) {
        const x = Number(rect.getAttribute("x"));
        byX.set(x, [...(byX.get(x) ?? []), rect]);
      }

      for (const segments of byX.values()) {
        expect(segments).toHaveLength(2); // two models per bucket
        const [bottom, top] = [...segments].sort(
          (a, b) => Number(a.getAttribute("y")) - Number(b.getAttribute("y"))
        );
        const bottomTop =
          Number(bottom.getAttribute("y")) +
          Number(bottom.getAttribute("height"));
        // Both edges are read back from SVG attributes, which recharts rounds
        // to 4 decimals. Summing the bottom segment's two rounded values can
        // therefore differ from the top segment's rounded y by one rounding
        // step (1e-4), so compare at that granularity rather than demanding
        // float-exact agreement.
        expect(Number(top.getAttribute("y"))).toBeCloseTo(bottomTop, 3);
      }
    }
  });

  it("labels the tokens chart in millions and keeps ticks unit-free", () => {
    const { container } = render(
      <UsageChart data={buildModelData()} range="24h" />
    );

    const tickLabels = Array.from(
      container.querySelectorAll(".recharts-cartesian-axis-tick-value")
    ).map((el) => el.textContent);

    // The unit now lives in the tokens heading, so no tick carries an M/K
    // suffix, and no axis renders a full 4+ digit number.
    expect(tickLabels.some((label) => /[MK]$/.test(label ?? ""))).toBe(false);
    expect(tickLabels.some((label) => /000$/.test(label ?? ""))).toBe(false);

    // The "(M)" unit sits next to the "Tokens" heading (above the chart),
    // mirroring the "Cost (¥)" heading.
    expect(container.textContent).toContain("Tokens (M)");
  });

  it("prefixes per-model cost values with the yuan sign in the tooltip", async () => {
    render(<UsageChart data={buildModelData()} range="24h" />);

    const items = await readTooltipItems(0);
    expect(
      items.some((item) => item?.startsWith("model-b") && item?.includes("¥"))
    ).toBe(true);
    expect(
      items.some((item) => item?.startsWith("model-a") && item?.includes("¥"))
    ).toBe(true);
  });

  it("right-aligns model names and values into two columns", async () => {
    render(<UsageChart data={buildModelData()} range="24h" />);

    const wrapper = document.querySelectorAll(".recharts-wrapper")[0];
    fireEvent.mouseMove(wrapper, { clientX: 400, clientY: 200 });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    const tooltip = Array.from(
      document.querySelectorAll(".recharts-tooltip-wrapper")
    ).find((t) => t.textContent?.includes("model-b"));
    expect(tooltip).toBeTruthy();

    const rows = within(tooltip as HTMLElement).queryAllByRole("listitem");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      // `justify-between` pushes each value to the row's right edge so every
      // value lines up in one right-aligned column.
      expect(row.classList.contains("justify-between")).toBe(true);
      // Two columns: swatch + name on the left, the value on the right.
      expect(Array.from(row.children)).toHaveLength(2);
    }
  });

  it("shows a total row that sums the displayed model values", async () => {
    render(<UsageChart data={buildModelData()} range="24h" />);

    const wrapper = document.querySelectorAll(".recharts-wrapper")[0];
    fireEvent.mouseMove(wrapper, { clientX: 400, clientY: 200 });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    const tooltip = Array.from(
      document.querySelectorAll(".recharts-tooltip-wrapper")
    ).find((t) => t.querySelector('[data-testid="tooltip-total"]'));
    expect(tooltip).toBeTruthy();

    // The total equals the sum of the values shown in the breakdown, and it
    // carries the same yuan prefix as the per-model rows.
    const rowValues = within(tooltip as HTMLElement)
      .queryAllByRole("listitem")
      .map((li) => Number(li.textContent?.match(/¥([\d.]+)/)?.[1] ?? 0));
    const expectedTotal = rowValues.reduce((sum, value) => sum + value, 0);

    const totalText =
      within(tooltip as HTMLElement)
        .getByTestId("tooltip-total")
        .textContent ?? "";
    const totalValue = Number(totalText.match(/¥([\d.]+)/)?.[1] ?? 0);
    expect(totalValue).toBeCloseTo(expectedTotal, 5);
  });

  it("omits the separator and total when only one model is active", async () => {
    render(<UsageChart data={buildModelData().slice(0, 1)} range="24h" />);

    const wrapper = document.querySelectorAll(".recharts-wrapper")[0];
    fireEvent.mouseMove(wrapper, { clientX: 400, clientY: 200 });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    const tooltip = Array.from(
      document.querySelectorAll(".recharts-tooltip-wrapper")
    ).find((t) => t.textContent?.includes("model-b"));
    expect(tooltip).toBeTruthy();
    expect(tooltip!.textContent).toContain("model-b");

    // A single value needs no total row, and no divider between it and nothing.
    expect(tooltip!.querySelector('[data-testid="tooltip-total"]')).toBeNull();
    expect(
      Array.from(tooltip!.querySelectorAll(".border-t"))
    ).toHaveLength(0);
  });

  it("styles the cost tooltip yuan sign as muted foreground", async () => {
    render(<UsageChart data={buildModelData()} range="24h" />);

    // Hover the cost chart (the first of the two stacked charts).
    const wrapper = document.querySelectorAll(".recharts-wrapper")[0];
    fireEvent.mouseMove(wrapper, { clientX: 400, clientY: 200 });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    // The cost tooltip is the one that lists a model name.
    const tooltip = Array.from(
      document.querySelectorAll(".recharts-tooltip-wrapper")
    ).find((t) => t.textContent?.includes("model-b"));
    expect(tooltip).toBeTruthy();

    // Mirror the model cost table: the ¥ sign renders muted, the number not.
    const yuanSigns = Array.from(
      tooltip!.querySelectorAll(".text-muted-foreground")
    );
    expect(yuanSigns.length).toBeGreaterThan(0);
    expect(yuanSigns.every((span) => span.textContent === "¥")).toBe(true);
  });

  it("shortens each model's token value in the tooltip to M/K", async () => {
    render(<UsageChart data={buildModelData()} range="24h" />);

    const items = await readTooltipItems(1);
    // Token tooltips use the same M/K compaction as the y-axis rather than
    // full thousands-separated precision.
    expect(items.some((item) => item?.match(/model-b\d+(\.\d+)?[MK]/))).toBe(
      true
    );
  });

  it("orders tooltip entries from highest to lowest value", async () => {
    render(<UsageChart data={buildMixedActivityData()} range="24h" />);

    const items = await readTooltipItems(0);
    const modelAIndex = items.findIndex((item) => item?.startsWith("model-a"));
    const modelBIndex = items.findIndex((item) => item?.startsWith("model-b"));

    // model-a's token values exceed model-b's in every bucket, so it must
    // sort above model-b even though the input (series) order lists model-b
    // first.
    expect(modelAIndex).toBeGreaterThan(-1);
    expect(modelBIndex).toBeGreaterThan(-1);
    expect(modelAIndex).toBeLessThan(modelBIndex);
  });

  it("hides models with zero activity from the tooltip", async () => {
    render(<UsageChart data={buildMixedActivityData()} range="24h" />);

    const items = await readTooltipItems(0);
    expect(items.some((item) => item?.startsWith("model-a"))).toBe(true);
    expect(items.some((item) => item?.startsWith("model-b"))).toBe(true);
    expect(items.some((item) => item?.startsWith("model-c"))).toBe(false);
  });

  it("shows a legend naming each model when multiple models are present", () => {
    const { container } = render(
      <UsageChart data={buildModelData()} range="24h" />
    );

    const legendText = container.textContent ?? "";
    expect(legendText).toContain("model-b");
    expect(legendText).toContain("model-a");
  });

  it("renders a single legend, below both charts", () => {
    const { container } = render(
      <UsageChart data={buildModelData()} range="24h" />
    );

    // Exactly one legend for the two stacked charts, not one per chart.
    const legends = container.querySelectorAll('[data-testid="chart-legend"]');
    expect(legends).toHaveLength(1);

    // The legend sits after the last (tokens) chart's plot area in document
    // order, so it reads as the legend for the whole chart group.
    const wrappers = document.querySelectorAll(".recharts-wrapper");
    expect(wrappers.length).toBe(2);
    expect(wrappers[1].compareDocumentPosition(legends[0])).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("lists models in table order when modelOrder is provided", () => {
    const { container } = render(
      <UsageChart
        data={buildModelData()}
        range="24h"
        modelOrder={["model-a", "model-b"]}
      />
    );

    const legendText = container.textContent ?? "";
    const modelAIndex = legendText.indexOf("model-a");
    const modelBIndex = legendText.indexOf("model-b");
    expect(modelAIndex).toBeGreaterThan(-1);
    expect(modelAIndex).toBeLessThan(modelBIndex);
  });

  it("draws no outline around bar segments", async () => {
    const { container } = render(
      <UsageChart data={buildModelData()} range="24h" />
    );
    await settleBarAnimation();

    const rects = Array.from(
      container.querySelectorAll(".recharts-rectangle")
    );
    expect(rects.length).toBeGreaterThan(0);
    for (const rect of rects) {
      // Segments separate by fill hue alone; a stroke would read as a dark
      // border around each model's segment.
      expect(rect.getAttribute("stroke")).toBeNull();
    }
  });

  it("keeps every segment a square rectangle so stacked widths match", async () => {
    const { container } = render(
      <UsageChart data={buildModelData()} range="24h" />
    );
    await settleBarAnimation();

    // Recharts draws rounded corners as arc commands (A) in the segment path.
    // A rounded top segment tapers its top edge narrower than the segment
    // below it, making the lower block look wider — so every segment must be
    // a plain rectangle with square corners.
    const paths = Array.from(
      container.querySelectorAll(".recharts-rectangle")
    );
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path.getAttribute("d")).not.toMatch(/A\s*\d/);
    }
  });

  it("colors each model by its table position even when the range shows a subset", async () => {
    // The 24h range has data for model-b only, but the table lists model-a
    // first. model-b's bar segments and legend swatch must use its table
    // color (--chart-2), not the first-available --chart-1.
    const { container } = render(
      <UsageChart
        data={buildModelData().slice(0, 1)}
        range="24h"
        modelOrder={["model-a", "model-b"]}
      />
    );
    await settleBarAnimation();

    const fills = Array.from(
      container.querySelectorAll(".recharts-rectangle")
    ).map((rect) => rect.getAttribute("fill"));
    expect(new Set(fills)).toEqual(new Set(["var(--chart-2)"]));

    const legend = container.querySelector('[data-testid="chart-legend"]')!;
    expect(legend.textContent).toContain("model-b");
    expect(legend.querySelector("span[style*='--chart-2']")).toBeTruthy();
  });

  it("renders a single stacked bar per chart and a legend naming the one model", async () => {
    const { container } = render(
      <UsageChart data={buildModelData().slice(0, 1)} range="24h" />
    );
    await settleBarAnimation();

    const fills = Array.from(
      container.querySelectorAll(".recharts-rectangle")
    ).map((rect) => rect.getAttribute("fill"));

    // Tokens and cost charts, one --chart-1 segment per bucket.
    expect(new Set(fills)).toEqual(new Set(["var(--chart-1)"]));

    // A single model still gets a legend rather than losing it entirely.
    const legends = container.querySelectorAll('[data-testid="chart-legend"]');
    expect(legends).toHaveLength(1);
    expect(legends[0].textContent).toContain("model-b");
  });

  it("keeps decimal cost ticks instead of rounding every tick to 0", () => {
    render(<UsageChart data={buildTinyCostData()} range="24h" />);

    const tickLabels = Array.from(
      document.querySelectorAll(".recharts-cartesian-axis-tick-value")
    ).map((el) => el.textContent);

    // The cost y-axis shows fractional yuan ticks (e.g. "0.02") rather than
    // collapsing sub-0.05 values to "0".
    expect(
      tickLabels.some((label) => /^0\.\d+/.test(label ?? ""))
    ).toBe(true);
  });

  it("renders an interactive legend button per model", () => {
    render(<UsageChart data={buildModelData()} range="24h" />);

    expect(
      screen.getByRole("button", { name: /Hide model-b/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Hide model-a/i })
    ).toBeInTheDocument();
  });

  it("hides a model in both charts when its legend button is clicked", async () => {
    const { container } = render(
      <UsageChart data={buildModelData()} range="24h" />
    );
    await settleBarAnimation();

    // 4 buckets × 2 models × 2 charts (tokens + cost).
    expect(container.querySelectorAll(".recharts-rectangle")).toHaveLength(16);

    fireEvent.click(screen.getByRole("button", { name: /Hide model-b/i }));
    await settleBarAnimation();

    // model-b's segments vanish from both charts: 4 buckets × 1 model × 2 charts.
    const rects = container.querySelectorAll(".recharts-rectangle");
    expect(rects).toHaveLength(8);
    // Only model-a's table color remains.
    expect(new Set(Array.from(rects).map((r) => r.getAttribute("fill")))).toEqual(
      new Set(["var(--chart-2)"])
    );
  });

  it("shows a hidden model when its legend button is clicked again", async () => {
    const { container } = render(
      <UsageChart data={buildModelData()} range="24h" />
    );
    await settleBarAnimation();

    fireEvent.click(screen.getByRole("button", { name: /Hide model-b/i }));
    await settleBarAnimation();
    expect(container.querySelectorAll(".recharts-rectangle")).toHaveLength(8);

    fireEvent.click(screen.getByRole("button", { name: /Show model-b/i }));
    await settleBarAnimation();
    expect(container.querySelectorAll(".recharts-rectangle")).toHaveLength(16);
  });

  it("renders hidden legend items with reduced opacity and muted text", () => {
    render(<UsageChart data={buildModelData()} range="24h" />);

    fireEvent.click(screen.getByRole("button", { name: /Hide model-a/i }));

    const hiddenButton = screen.getByRole("button", { name: /Show model-a/i });
    expect(hiddenButton).toHaveClass("opacity-50");
    expect(hiddenButton).toHaveClass("text-muted-foreground");
  });

  it("sets aria-pressed true for hidden models and false for visible ones", () => {
    render(<UsageChart data={buildModelData()} range="24h" />);

    const visibleButton = screen.getByRole("button", { name: /Hide model-b/i });
    expect(visibleButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(visibleButton);
    expect(
      screen.getByRole("button", { name: /Show model-b/i })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps hidden models hidden when the range changes", () => {
    const { rerender } = render(
      <UsageChart data={buildModelData()} range="24h" />
    );

    fireEvent.click(screen.getByRole("button", { name: /Hide model-a/i }));

    rerender(<UsageChart data={buildModelData()} range="30d" />);

    expect(
      screen.getByRole("button", { name: /Show model-a/i })
    ).toBeInTheDocument();
  });

  it("excludes hidden models from the tooltip", async () => {
    render(<UsageChart data={buildModelData()} range="24h" />);

    fireEvent.click(screen.getByRole("button", { name: /Hide model-b/i }));

    const items = await readTooltipItems(0);
    expect(items.some((item) => item?.startsWith("model-a"))).toBe(true);
    expect(items.some((item) => item?.startsWith("model-b"))).toBe(false);
  });

  it("grounds remaining segments when a hidden model leaves the stack", async () => {
    const { container } = render(
      <UsageChart data={buildModelData()} range="24h" />
    );
    await settleBarAnimation();

    const wrapper = container.querySelectorAll(".recharts-wrapper")[0];
    // Per-bucket bottom edges: the largest y+height in a bucket is the edge
    // that rests on the baseline. With two models, model-b (bottom) grounds
    // the stack, so its bottom edge is the baseline.
    const bottomEdgesByX = () => {
      const edges = new Map<number, number[]>();
      for (const rect of Array.from(
        wrapper.querySelectorAll(".recharts-rectangle")
      )) {
        const x = Number(rect.getAttribute("x"));
        const bottomEdge =
          Number(rect.getAttribute("y")) + Number(rect.getAttribute("height"));
        edges.set(x, [...(edges.get(x) ?? []), bottomEdge]);
      }
      return [...edges.values()].map((e) => Math.max(...e));
    };

    const baselinesBefore = bottomEdgesByX();

    fireEvent.click(screen.getByRole("button", { name: /Hide model-b/i }));
    await settleBarAnimation();

    // Hiding the bottom model drops model-a to the same baseline rather than
    // leaving a floating gap where model-b used to sit.
    const baselinesAfter = bottomEdgesByX();
    expect(baselinesAfter).toHaveLength(baselinesBefore.length);
    baselinesAfter.forEach((edge, i) =>
      expect(edge).toBeCloseTo(baselinesBefore[i], 5)
    );
  });
});
