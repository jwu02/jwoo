import { render, screen, fireEvent, act } from "@testing-library/react";
import { cloneElement } from "react";
import {
  UsageBreakdown,
  segmentColor,
} from "@/components/ai-usage/usage-breakdown";

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

// Nine rows, so the tail past the seventh folds into `Others`.
const manyRows = Array.from({ length: 9 }, (_, i) => ({
  id: `m${i}`,
  label: `m${i}`,
  costYuan: 9 - i,
  totalTokens: 9 - i,
}));

describe("UsageBreakdown", () => {
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

  it("folds everything past the seventh into one Others entry", () => {
    render(<UsageBreakdown rows={manyRows} labelHeader="Model" />);
    // Both donuts fold: seven named rows plus Others.
    expect(screen.getAllByText("Others")).toHaveLength(2);
    expect(screen.getAllByRole("listitem")).toHaveLength(16);
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

  it("shows a segment's exact value on hover", async () => {
    render(<UsageBreakdown rows={rows} labelHeader="Model" />);
    const sector = document.querySelectorAll(".recharts-sector")[0]!;
    fireEvent.mouseEnter(sector);
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    // The cost donut ranks claude-opus-5 first, so it is the hovered sector;
    // the legend already carries the value, so the tooltip's share is what
    // proves the card rendered.
    expect(await screen.findByText("48.0%")).toBeInTheDocument();
    expect(screen.getAllByText("¥1.20")).toHaveLength(2);
  });

  it("reads token counts the way the chart does, not at full length", async () => {
    render(<UsageBreakdown rows={rows} labelHeader="Model" />);
    // The three cost sectors come first, then the three token sectors.
    const sector = document.querySelectorAll(".recharts-sector")[3]!;
    fireEvent.mouseEnter(sector);
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(await screen.findByText("50.0%")).toBeInTheDocument();
    expect(screen.getAllByText("3.0K")).toHaveLength(2);
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
});
