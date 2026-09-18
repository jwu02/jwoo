import { render, screen, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UsageBreakdown } from "@/components/ai-usage/usage-breakdown";

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

describe("UsageBreakdown", () => {
  it("renders one row per entry with its metrics", () => {
    render(<UsageBreakdown rows={rows} labelHeader="Model" />);
    expect(screen.getByText("deepseek-v4-flash")).toBeInTheDocument();
    expect(screen.getByText("gpt-4o")).toBeInTheDocument();
    expect(screen.getByText("claude-opus-5")).toBeInTheDocument();
    expect(screen.getByText("0.80")).toBeInTheDocument();
    // Token counts keep a fixed one decimal, so the whole 2,000 keeps its ".0"
    // rather than trimming to "2K" beside a fractional neighbour.
    expect(screen.getByText("2.0K")).toBeInTheDocument();
  });

  it("sorts rows by cost descending", () => {
    const { container } = render(<UsageBreakdown rows={rows} labelHeader="Model" />);
    const labels = Array.from(container.querySelectorAll("[data-label]")).map(
      (el) => el.textContent
    );
    expect(labels).toEqual(["claude-opus-5", "deepseek-v4-flash", "gpt-4o"]);
  });

  it("renders an empty state when there is no data", () => {
    render(<UsageBreakdown rows={[]} labelHeader="Model" />);
    expect(screen.getByText("No AI usage recorded yet.")).toBeInTheDocument();
  });

  it("renders the label header passed in", () => {
    const { rerender } = render(
      <UsageBreakdown rows={rows} labelHeader="Model" />
    );
    expect(screen.getByText("Model")).toBeInTheDocument();
    rerender(<UsageBreakdown rows={rows} labelHeader="Project" />);
    expect(screen.getByText("Project")).toBeInTheDocument();
  });

  it("shows each row's share of the column total as a bar", () => {
    render(<UsageBreakdown rows={rows} labelHeader="Model" />);
    // cost total 2.5; claude-opus-5 = 1.2 → 48%
    expect(
      screen.getByRole("progressbar", { name: /claude-opus-5 cost share/i })
    ).toHaveAttribute("aria-valuenow", "48");
    // tokens total 6000; claude-opus-5 = 3000 → 50%
    expect(
      screen.getByRole("progressbar", { name: /claude-opus-5 tokens share/i })
    ).toHaveAttribute("aria-valuenow", "50");
  });

  it("places each bar to the left of its value", () => {
    render(<UsageBreakdown rows={rows} labelHeader="Model" />);
    const bar = screen.getByRole("progressbar", {
      name: /claude-opus-5 cost share/i,
    });
    const value = screen.getByText("1.20");
    expect(
      bar.compareDocumentPosition(value) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("left-aligns the bars within each cell", () => {
    render(<UsageBreakdown rows={rows} labelHeader="Model" />);
    const bar = screen.getByRole("progressbar", {
      name: /claude-opus-5 cost share/i,
    });
    const row = bar.parentElement!;
    expect(row.className).toContain("justify-start");
  });

  it("renders bars tall enough to hover", () => {
    render(<UsageBreakdown rows={rows} labelHeader="Model" />);
    const bar = screen.getByRole("progressbar", {
      name: /claude-opus-5 cost share/i,
    });
    expect(bar.className).toContain("h-2");
  });

  it("left-aligns the statistic headers", () => {
    render(<UsageBreakdown rows={rows} labelHeader="Model" />);
    for (const label of ["Total Tokens", "Cost"]) {
      const th = screen.getByText(label).closest("th")!;
      expect(th.className).not.toContain("text-right");
    }
  });

  it("shows the percentage when hovering a bar", async () => {
    render(
      <TooltipProvider>
        <UsageBreakdown rows={rows} labelHeader="Model" />
      </TooltipProvider>
    );
    const bar = screen.getByRole("progressbar", {
      name: /claude-opus-5 cost share/i,
    });
    fireEvent.mouseEnter(bar);
    // A whole share keeps its ".0", like the summary card's cache hit rate.
    expect(await screen.findByText("48.0%")).toBeInTheDocument();
  });

  it("shows a share that is not whole to one decimal", async () => {
    render(
      <TooltipProvider>
        <UsageBreakdown
          rows={[
            { id: "a", label: "a", costYuan: 1, totalTokens: 0 },
            { id: "b", label: "b", costYuan: 2, totalTokens: 0 },
          ]}
          labelHeader="Model"
        />
      </TooltipProvider>
    );
    const bar = screen.getByRole("progressbar", { name: /a cost share/i });
    fireEvent.mouseEnter(bar);
    // 1 of 3 → 33.333…%, read at one decimal rather than rounded to 33%.
    expect(await screen.findByText("33.3%")).toBeInTheDocument();
  });

  it("renders no percentage labels", () => {
    const { container } = render(<UsageBreakdown rows={rows} labelHeader="Model" />);
    expect(container).not.toHaveTextContent("%");
  });

  it("drops the ambiguous bar from the label column", () => {
    const { container } = render(<UsageBreakdown rows={rows} labelHeader="Model" />);
    const labelCell = container
      .querySelector('[data-label="claude-opus-5"]')!
      .closest("td")!;
    expect(labelCell.querySelector('[role="presentation"]')).toBeNull();
  });

  it("keys rows uniquely even when labels collide", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const collidingRows = [
      {
        id: "/work/backend",
        label: "backend",
        costYuan: 0.5,
        totalTokens: 100,
      },
      {
        id: "/sandbox/backend",
        label: "backend",
        costYuan: 0.3,
        totalTokens: 80,
      },
    ];
    render(<UsageBreakdown rows={collidingRows} labelHeader="Project" />);
    const messages = errorSpy.mock.calls
      .flat()
      .filter((arg) => typeof arg === "string");
    expect(messages.some((msg) => msg.includes("same key"))).toBe(false);
    errorSpy.mockRestore();
  });
});
