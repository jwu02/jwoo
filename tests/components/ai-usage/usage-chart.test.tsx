import { render, fireEvent, act, within } from "@testing-library/react";
import { cloneElement } from "react";
import {
  UsageChart,
  formatCostAxisLabel,
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

// UsageChart renders two stacked line charts (tokens, then cost). Hover the
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

beforeAll(() => {
  jest
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(() => fakeRect as DOMRect);
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
  it("renders one line per model on each chart", () => {
    const { container } = render(
      <UsageChart data={buildModelData()} range="24h" />
    );

    const strokes = Array.from(
      container.querySelectorAll(".recharts-line-curve")
    ).map((path) => path.getAttribute("stroke"));

    // Tokens chart then cost chart, one line per model with the same color
    // per model across both charts (--chart-1 for model-b, --chart-2 for model-a).
    expect(strokes).toEqual([
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-1)",
      "var(--chart-2)",
    ]);
  });

  it("shortens y-axis labels to M/K", () => {
    const { container } = render(
      <UsageChart data={buildModelData()} range="24h" />
    );

    const tickLabels = Array.from(
      container.querySelectorAll(".recharts-cartesian-axis-tick-value")
    ).map((el) => el.textContent);

    // The tokens y-axis shows a value in the millions (e.g. "1.3M"), and no
    // axis renders a full 4+ digit number — the compact formatter is wired up.
    expect(
      tickLabels.some((label) => /\d+(\.\d+)?[MK]$/.test(label ?? ""))
    ).toBe(true);
    expect(tickLabels.some((label) => /000$/.test(label ?? ""))).toBe(false);
  });

  it("prefixes per-model cost values with the yuan sign in the tooltip", async () => {
    render(<UsageChart data={buildModelData()} range="24h" />);

    const items = await readTooltipItems(1);
    expect(items.some((item) => item?.startsWith("model-b: ¥"))).toBe(true);
    expect(items.some((item) => item?.startsWith("model-a: ¥"))).toBe(true);
  });

  it("shortens each model's token value in the tooltip to M/K", async () => {
    render(<UsageChart data={buildModelData()} range="24h" />);

    const items = await readTooltipItems(0);
    // Token tooltips use the same M/K compaction as the y-axis rather than
    // full thousands-separated precision.
    expect(items.some((item) => item?.match(/model-b: \d+(\.\d+)?[MK]/))).toBe(
      true
    );
  });

  it("shows a legend naming each model when multiple models are present", () => {
    const { container } = render(
      <UsageChart data={buildModelData()} range="24h" />
    );

    const legendText = container.textContent ?? "";
    expect(legendText).toContain("model-b");
    expect(legendText).toContain("model-a");
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

  it("renders a single line per chart with no legend for one model", () => {
    const { container } = render(
      <UsageChart data={buildModelData().slice(0, 1)} range="24h" />
    );

    const strokes = Array.from(
      container.querySelectorAll(".recharts-line-curve")
    ).map((path) => path.getAttribute("stroke"));

    // Tokens and cost charts, one --chart-1 line each.
    expect(strokes).toEqual(["var(--chart-1)", "var(--chart-1)"]);
    expect(container.querySelectorAll("li")).toHaveLength(0);
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
});
