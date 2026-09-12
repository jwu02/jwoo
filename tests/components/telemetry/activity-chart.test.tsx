import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { cloneElement, createElement } from "react";
import { ActivityChart } from "@/components/telemetry/activity-chart";
import { TimeSeriesPoint } from "@/lib/telemetry/types";
import { formatTooltip } from "@/lib/telemetry/chart-format";

// recharts does not render axis tick *labels* under jsdom (the axis measures
// its own ticks from a ResizeObserver that never fires), so the Y axis tick
// formatter can't be asserted from the DOM. Capture the props it was handed
// instead, and read them back through `jest.requireMock`.
jest.mock("recharts", () => {
  const actual = jest.requireActual("recharts");
  const capturedYAxisProps: { current: Record<string, unknown> | null } = {
    current: null,
  };

  return {
    ...actual,
    __capturedYAxisProps: capturedYAxisProps,
    YAxis: (props: Record<string, unknown>) => {
      capturedYAxisProps.current = props;
      return createElement(actual.YAxis, props);
    },
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      cloneElement(
        children as React.ReactElement<{ width?: number; height?: number }>,
        { width: 800, height: 400 }
      ),
  };
});

function getYAxisProps() {
  const { __capturedYAxisProps } = jest.requireMock("recharts");
  return __capturedYAxisProps.current as {
    tickFormatter?: (value: number) => string;
  };
}

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

// recharts maps mouse events to data indices using the wrapper's bounding
// rect. jsdom reports a zero rect, so stub a real one and let the raf-throttled
// tooltip settle before reading the rendered tooltip.
async function readTooltipItems() {
  const wrapper = document.querySelector(".recharts-wrapper")!;
  fireEvent.mouseMove(wrapper, { clientX: 400, clientY: 200 });
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  const tooltip = document.querySelector(".recharts-tooltip-wrapper");
  if (!tooltip) return [];
  return within(tooltip as HTMLElement)
    .queryAllByRole("listitem")
    .map((li) => ({
      // The label group (swatch + name) is the first child span; the value is
      // the last child span. The swatch carries no text, so the label group's
      // textContent is just the series name.
      label: (li as HTMLElement).firstElementChild?.textContent ?? "",
      value: (li as HTMLElement).lastElementChild?.textContent ?? "",
    }));
}

function buildData(): TimeSeriesPoint[] {
  return Array.from({ length: 4 }, (_, i) => ({
    bucket: new Date(Date.UTC(2025, 7, 9, i * 6)).toISOString(),
    leftClicks: i * 10,
    rightClicks: i * 5,
    keyPresses: i * 20,
    movementMeters: i * 100,
  }));
}

// The chart sizes its Y axis from the rendered tick labels (`width="auto"`),
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

describe("ActivityChart", () => {
  it("renders a legend item for each series", () => {
    render(<ActivityChart data={buildData()} range="24h" />);

    expect(screen.getByRole("button", { name: /Hide Left Clicks/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hide Right Clicks/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hide Key Presses/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hide Mouse Movement \(m\)/i })).toBeInTheDocument();
  });

  it("hides a series when its legend item is clicked", () => {
    render(<ActivityChart data={buildData()} range="24h" />);

    const leftClicksButton = screen.getByRole("button", { name: /Hide Left Clicks/i });
    fireEvent.click(leftClicksButton);

    expect(screen.getByRole("button", { name: /Show Left Clicks/i })).toBeInTheDocument();
  });

  it("shows a hidden series when its legend item is clicked again", () => {
    render(<ActivityChart data={buildData()} range="24h" />);

    const leftClicksButton = screen.getByRole("button", { name: /Hide Left Clicks/i });
    fireEvent.click(leftClicksButton);
    fireEvent.click(screen.getByRole("button", { name: /Show Left Clicks/i }));

    expect(screen.getByRole("button", { name: /Hide Left Clicks/i })).toBeInTheDocument();
  });

  it("keeps hidden series hidden when the range changes", () => {
    const { rerender } = render(<ActivityChart data={buildData()} range="24h" />);

    fireEvent.click(screen.getByRole("button", { name: /Hide Key Presses/i }));

    rerender(<ActivityChart data={buildData()} range="30d" />);

    expect(screen.getByRole("button", { name: /Show Key Presses/i })).toBeInTheDocument();
  });

  it("renders hidden legend items with reduced opacity and muted text", () => {
    render(<ActivityChart data={buildData()} range="24h" />);

    fireEvent.click(screen.getByRole("button", { name: /Hide Right Clicks/i }));

    const hiddenButton = screen.getByRole("button", { name: /Show Right Clicks/i });
    expect(hiddenButton).toHaveClass("opacity-50");
    expect(hiddenButton).toHaveClass("text-muted-foreground");
  });

  it("sets aria-pressed true for hidden series and false for visible series", () => {
    render(<ActivityChart data={buildData()} range="24h" />);

    const distanceButton = screen.getByRole("button", { name: /Hide Mouse Movement \(m\)/i });
    expect(distanceButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(distanceButton);

    expect(screen.getByRole("button", { name: /Show Mouse Movement \(m\)/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("renders chart axes with foreground stroke color", () => {
    const { container } = render(<ActivityChart data={buildData()} range="24h" />);

    const xAxisLine = container.querySelector(".recharts-xAxis .recharts-cartesian-axis-line");
    const yAxisLine = container.querySelector(".recharts-yAxis .recharts-cartesian-axis-line");

    expect(xAxisLine).toHaveAttribute("stroke", "var(--foreground)");
    expect(yAxisLine).toHaveAttribute("stroke", "var(--foreground)");
  });

  it("abbreviates thousands in the Y axis tick labels", () => {
    render(<ActivityChart data={buildData()} range="24h" />);

    const { tickFormatter } = getYAxisProps();
    expect(tickFormatter).toBeDefined();
    expect(tickFormatter!(2_500)).toBe("2.5K");
    expect(tickFormatter!(1_000)).toBe("1K");
    expect(tickFormatter!(1_200_000)).toBe("1.2M");
    // Counts below a thousand stay exact.
    expect(tickFormatter!(750)).toBe("750");
  });

  it("renders legend items in canonical metric order", () => {
    const { container } = render(<ActivityChart data={buildData()} range="24h" />);

    const labels = Array.from(container.querySelectorAll("button")).map((b) => b.textContent);

    expect(labels).toEqual([
      "Key Presses",
      "Left Clicks",
      "Right Clicks",
      "Mouse Movement (m)",
    ]);
  });

  it("renders series lines in canonical order", () => {
    const { container } = render(<ActivityChart data={buildData()} range="24h" />);

    // recharts builds the tooltip payload in Line render order, so the DOM order
    // of the line curves is a faithful proxy for tooltip payload order.
    const strokes = Array.from(container.querySelectorAll(".recharts-line-curve")).map(
      (path) => path.getAttribute("stroke")
    );

    expect(strokes).toEqual([
      "var(--chart-3)", // Key Presses
      "var(--chart-1)", // Left Clicks
      "var(--chart-2)", // Right Clicks
      "var(--chart-4)", // Mouse Movement
    ]);
  });

  it("keeps tooltip series order after hiding a middle series", () => {
    const { container } = render(<ActivityChart data={buildData()} range="24h" />);

    fireEvent.click(screen.getByRole("button", { name: /Hide Left Clicks/i }));

    const strokes = Array.from(container.querySelectorAll(".recharts-line-curve")).map(
      (path) => path.getAttribute("stroke")
    );

    expect(strokes).toEqual([
      "var(--chart-3)", // Key Presses
      "var(--chart-2)", // Right Clicks
      "var(--chart-4)", // Mouse Movement
    ]);
  });

  it("keeps tooltip series order after re-showing a hidden middle series", async () => {
    render(<ActivityChart data={buildData()} range="24h" />);

    fireEvent.click(screen.getByRole("button", { name: /Hide Left Clicks/i }));
    fireEvent.click(screen.getByRole("button", { name: /Show Left Clicks/i }));

    const items = await readTooltipItems();
    expect(items.map((item) => item.label)).toEqual([
      "Key Presses",
      "Left Clicks",
      "Right Clicks",
      "Mouse Movement (m)",
    ]);
  });

  it("rounds mouse movement to a whole number in the tooltip", async () => {
    const fractional = buildData().map((point) => ({
      ...point,
      movementMeters: 10.56,
    }));
    render(<ActivityChart data={fractional} range="24h" />);

    const items = await readTooltipItems();
    expect(
      items.some(
        (item) => item.label === "Mouse Movement (m)" && item.value === "11"
      )
    ).toBe(true);
    expect(items.some((item) => item.value === "10.56")).toBe(false);
  });

  it("shows a formatted datetime header in the tooltip", async () => {
    render(<ActivityChart data={buildData()} range="24h" />);

    const wrapper = document.querySelector(".recharts-wrapper")!;
    fireEvent.mouseMove(wrapper, { clientX: 400, clientY: 200 });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    const tooltip = document.querySelector(".recharts-tooltip-wrapper");
    expect(tooltip).not.toBeNull();

    const header = within(tooltip as HTMLElement).getByRole("paragraph");
    const expectedLabels = buildData().map((p) => formatTooltip(p.bucket, "24h"));
    expect(expectedLabels).toContain(header.textContent);
  });
});
