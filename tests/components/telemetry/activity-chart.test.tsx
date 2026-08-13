import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { cloneElement } from "react";
import { ActivityChart } from "@/components/telemetry/activity-chart";
import { TimeSeriesPoint } from "@/lib/telemetry/types";
import { formatTooltip } from "@/lib/telemetry/chart-format";

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
    .map((li) => li.textContent);
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

beforeAll(() => {
  jest
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(() => fakeRect as DOMRect);
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

    rerender(<ActivityChart data={buildData()} range="7d" />);

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
    expect(items.map((item) => item.split(":")[0])).toEqual([
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
    expect(items.some((item) => item.includes("Mouse Movement (m): 11"))).toBe(true);
    expect(items.some((item) => item.includes("10.56"))).toBe(false);
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
