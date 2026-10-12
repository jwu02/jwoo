import { render, screen, fireEvent, act } from "@testing-library/react";
import { cloneElement } from "react";
import {
  UsageBreakdown,
  segmentColor,
  ringPosition,
} from "@/components/ai-usage/usage-breakdown";
import { clearAppearance, saveAppearance } from "@/components/os/appearance";

// The donut needs a real box to lay its sectors out in; jsdom reports zero for
// the wrapper, so ResponsiveContainer is handed a size the way the chart test
// hands one to its bar charts.
jest.mock("recharts", () => {
  const actual = jest.requireActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      cloneElement(
        children as React.ReactElement<{ width?: number; height?: number }>,
        { width: 320, height: 160 }
      ),
  };
});

const rows = [
  {
    id: "deepseek-v4-flash",
    label: "deepseek-v4-flash",
    costYuan: 0.8,
    totalTokens: 2000,
  },
  { id: "gpt-4o", label: "gpt-4o", costYuan: 0.5, totalTokens: 1000 },
  {
    id: "claude-opus-5",
    label: "claude-opus-5",
    costYuan: 1.2,
    totalTokens: 3000,
  },
];

// Nine rows, so the tail past the fifth folds into `Others`.
const manyRows = Array.from({ length: 9 }, (_, i) => ({
  id: `m${i}`,
  label: `m${i}`,
  costYuan: 9 - i,
  totalTokens: 9 - i,
}));

// Recharts replaces the sector nodes on every re-render, so always query anew
// rather than holding a reference across a hover.
const sectorAt = (index: number) =>
  document.querySelectorAll(".recharts-sector")[index]!;

// A hovered donut's tooltip also prints the label, so pick the legend element
// (the one inside a list item) rather than the first text match.
const legendFor = (label: string) =>
  screen
    .getAllByText(label)
    .map((el) => el.closest("li"))
    .find((li): li is HTMLLIElement => li !== null)!;

describe("UsageBreakdown", () => {
  // The appearance store is module state shared across the file's renders, so
  // put it back where a fresh visit finds it after each test.
  afterEach(() => act(() => clearAppearance()));

  it("renders one legend entry per segment in both donuts", () => {
    render(<UsageBreakdown rows={rows} labelHeader="Model" />);
    for (const label of ["deepseek-v4-flash", "gpt-4o", "claude-opus-5"]) {
      expect(screen.getAllByText(label)).toHaveLength(2);
    }
  });

  it("names each donut by its metric and the grouping", () => {
    const { rerender } = render(
      <UsageBreakdown rows={rows} labelHeader="Model" />
    );
    expect(
      screen.getByRole("figure", { name: "Cost (¥) by Model" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("figure", { name: "Tokens by Model" })
    ).toBeInTheDocument();
    rerender(<UsageBreakdown rows={rows} labelHeader="Project" />);
    expect(
      screen.getByRole("figure", { name: "Cost (¥) by Project" })
    ).toBeInTheDocument();
  });

  it("shows each segment's actual value in the legend, per its own donut", () => {
    render(<UsageBreakdown rows={rows} labelHeader="Model" />);
    // The cost donut ranks by cost, the token donut by tokens, and each legend
    // prints the value it ranked on: this is a value, not a share.
    for (const value of ["¥1.20", "¥0.80", "¥0.50"]) {
      expect(screen.getAllByText(value)).toHaveLength(1);
    }
    for (const value of ["3.0K", "2.0K", "1.0K"]) {
      expect(screen.getAllByText(value)).toHaveLength(1);
    }
    expect(screen.queryByText("48.0%")).not.toBeInTheDocument();
  });

  it("folds everything past the fifth into one Others entry", () => {
    render(<UsageBreakdown rows={manyRows} labelHeader="Model" />);
    // Both donuts fold: five named rows plus Others.
    expect(screen.getAllByText("Others")).toHaveLength(2);
    expect(screen.getAllByRole("listitem")).toHaveLength(12);
  });

  it("carries every segment as text, not only as a donut", () => {
    render(<UsageBreakdown rows={rows} labelHeader="Model" />);
    // One list per donut, each item a real list item — the donut itself is
    // decoration and the table's progressbars are gone.
    expect(screen.getAllByRole("list")).toHaveLength(2);
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
  });

  it("renders an empty state when there is no data", () => {
    render(<UsageBreakdown rows={[]} labelHeader="Model" />);
    expect(screen.getByText("No AI usage recorded yet.")).toBeInTheDocument();
  });

  it("shows a segment's share, and only its share, on hover", async () => {
    render(<UsageBreakdown rows={rows} labelHeader="Model" />);
    fireEvent.mouseEnter(sectorAt(0));
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    // The cost donut ranks claude-opus-5 first, so it is the hovered sector.
    // The value stays in the legend; the tooltip holds the share and nothing
    // else — not even the segment's name.
    expect(await screen.findAllByText(/48\.0%/)).toHaveLength(1);
    expect(
      document.querySelector(".recharts-tooltip-wrapper")?.textContent
    ).toBe("48.0%");
    // The legend keeps the value, and never repeats the share beside it.
    expect(legendFor("claude-opus-5")).toHaveTextContent("¥1.20");
    expect(legendFor("claude-opus-5")).not.toHaveTextContent("48.0%");
    expect(screen.getAllByText("¥1.20")).toHaveLength(1);
    // A sector hover uses the chart's own tooltip; the legend card stays shut.
    expect(screen.queryByTestId("legend-tooltip")).not.toBeInTheDocument();
  });

  it("reads token counts the way the chart does, not at full length", () => {
    render(<UsageBreakdown rows={rows} labelHeader="Model" />);
    // The token legend reads each count through the chart's own formatter.
    expect(screen.getAllByText("3.0K")).toHaveLength(1);
  });

  it("shows a token segment's share on hover", async () => {
    render(<UsageBreakdown rows={rows} labelHeader="Model" />);
    // The three cost sectors come first, then the three token sectors.
    fireEvent.mouseEnter(sectorAt(3));
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(await screen.findAllByText("50.0%")).toHaveLength(1);
  });

  it("dims the other segments and legends while one segment is hovered", () => {
    render(<UsageBreakdown rows={rows} labelHeader="Model" />);
    fireEvent.mouseEnter(sectorAt(0));

    // The held segment and its legend row stay lit; the rest dim in both the
    // donut and the legend.
    expect(sectorAt(0).getAttribute("fill-opacity")).not.toBe("0.3");
    expect(sectorAt(1).getAttribute("fill-opacity")).toBe("0.3");
    expect(legendFor("claude-opus-5").className).not.toContain("opacity-30");
    expect(legendFor("gpt-4o").className).toContain("opacity-30");

    fireEvent.mouseLeave(sectorAt(0));
    expect(sectorAt(1).getAttribute("fill-opacity")).not.toBe("0.3");
  });

  it("comes undimmed when a poll drops the held segment", () => {
    const { rerender } = render(
      <UsageBreakdown rows={rows} labelHeader="Model" />
    );
    fireEvent.mouseEnter(sectorAt(0));
    expect(legendFor("gpt-4o").className).toContain("opacity-30");

    // The poll no longer reports the held model; nothing may stay dimmed.
    rerender(
      <UsageBreakdown
        rows={rows.filter((row) => row.label !== "claude-opus-5")}
        labelHeader="Model"
      />
    );
    expect(legendFor("gpt-4o").className).not.toContain("opacity-30");
  });

  it("does the same when a legend row itself is hovered", () => {
    render(<UsageBreakdown rows={rows} labelHeader="Model" />);
    // The second cost segment is deepseek-v4-flash; its legend row is the
    // matching one in the cost donut's list.
    const legend = legendFor("deepseek-v4-flash");
    fireEvent.mouseEnter(legend);

    expect(sectorAt(1).getAttribute("fill-opacity")).not.toBe("0.3");
    expect(sectorAt(0).getAttribute("fill-opacity")).toBe("0.3");
    expect(legend.className).not.toContain("opacity-30");
    expect(legendFor("gpt-4o").className).toContain("opacity-30");
    // The share is not repeated in the row; it rides on the ring instead,
    // where the segment's own tooltip would sit.
    expect(legend).not.toHaveTextContent("32.0%");
    const card = screen.getByTestId("legend-tooltip");
    expect(card).toHaveTextContent("32.0%");
    // The donut is 160px; deepseek's arc midpoint is left of centre, below it.
    expect(Number.parseFloat(card.style.left)).toBeCloseTo(24.5, 1);
    expect(Number.parseFloat(card.style.top)).toBeCloseTo(80.8, 1);

    fireEvent.mouseLeave(legend);
    expect(screen.queryByTestId("legend-tooltip")).not.toBeInTheDocument();
  });

  it("puts a slice's share card on that slice's arc", () => {
    // Recharts' Pie starts at 3 o'clock and sweeps anticlockwise, so a 50/50
    // split puts the first arc's midpoint at the top and the second at the
    // bottom.
    const first = ringPosition([{ share: 50 }, { share: 50 }], 0);
    expect(first.left).toBeCloseTo(50);
    expect(first.top).toBeCloseTo(10);
    const second = ringPosition([{ share: 50 }, { share: 50 }], 1);
    expect(second.left).toBeCloseTo(50);
    expect(second.top).toBeCloseTo(90);
  });

  it("gives the combined segment the neutral, not a chart slot", () => {
    expect(segmentColor("Others", 7, new Map())).toBe(
      "var(--muted-foreground)"
    );
    // A named segment with no brand colour falls back to its position's slot.
    expect(segmentColor("gpt-4o", 2, new Map())).toBe("var(--chart-3)");
  });

  it("gives an empty donut its own message rather than a blank circle", () => {
    render(
      <UsageBreakdown
        rows={[{ id: "a", label: "a", costYuan: 0, totalTokens: 0 }]}
        labelHeader="Model"
      />
    );
    expect(
      screen.getByText("No cost recorded in this range.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("No tokens recorded in this range.")
    ).toBeInTheDocument();
  });

  it("shades sibling models by the appearance, darkening over a light card", () => {
    // Two models of one provider are a ramp; the direction must come from the
    // appearance, not from a fixed mix toward white.
    const siblings = [
      { id: "deepseek-v4-flash", label: "deepseek-v4-flash", costYuan: 1, totalTokens: 1 },
      { id: "deepseek-v4-pro", label: "deepseek-v4-pro", costYuan: 1, totalTokens: 1 },
    ];
    const swatches = () =>
      [...document.querySelectorAll("span[style*='--ai-deepseek']")].map(
        (el) => el.getAttribute("style") ?? ""
      );

    act(() => saveAppearance("light"));
    const light = render(<UsageBreakdown rows={siblings} labelHeader="Model" />);
    expect(swatches().some((style) => style.includes("black"))).toBe(true);
    light.unmount();

    act(() => saveAppearance("dark"));
    render(<UsageBreakdown rows={siblings} labelHeader="Model" />);
    expect(swatches().some((style) => style.includes("white"))).toBe(true);
  });
});
