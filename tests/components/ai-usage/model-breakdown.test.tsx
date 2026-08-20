import { render, screen, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ModelBreakdown } from "@/components/ai-usage/model-breakdown";

const byModel = [
  { model: "deepseek-v4-flash", costYuan: 0.8, totalTokens: 2000, requests: 2 },
  { model: "gpt-4o", costYuan: 0.5, totalTokens: 1000, requests: 1 },
  { model: "claude-opus-5", costYuan: 1.2, totalTokens: 3000, requests: 3 },
];

describe("ModelBreakdown", () => {
  it("renders one row per model with its metrics", () => {
    render(<ModelBreakdown byModel={byModel} />);
    expect(screen.getByText("deepseek-v4-flash")).toBeInTheDocument();
    expect(screen.getByText("gpt-4o")).toBeInTheDocument();
    expect(screen.getByText("claude-opus-5")).toBeInTheDocument();
    expect(screen.getByText("0.80")).toBeInTheDocument();
    expect(screen.getByText("2K")).toBeInTheDocument();
  });

  it("sorts models by cost descending", () => {
    const { container } = render(<ModelBreakdown byModel={byModel} />);
    const names = Array.from(container.querySelectorAll("[data-model]")).map(
      (el) => el.textContent
    );
    expect(names).toEqual(["claude-opus-5", "deepseek-v4-flash", "gpt-4o"]);
  });

  it("renders an empty state when there is no data", () => {
    render(<ModelBreakdown byModel={[]} />);
    expect(screen.getByText("No AI usage recorded yet.")).toBeInTheDocument();
  });

  it("shows each model's share of the column total as a bar", () => {
    render(<ModelBreakdown byModel={byModel} />);
    // cost total 2.5; claude-opus-5 = 1.2 → 48%
    expect(
      screen.getByRole("progressbar", { name: /claude-opus-5 cost share/i })
    ).toHaveAttribute("aria-valuenow", "48");
    // requests total 6; claude-opus-5 = 3 → 50%
    expect(
      screen.getByRole("progressbar", { name: /claude-opus-5 requests share/i })
    ).toHaveAttribute("aria-valuenow", "50");
    // tokens total 6000; claude-opus-5 = 3000 → 50%
    expect(
      screen.getByRole("progressbar", { name: /claude-opus-5 tokens share/i })
    ).toHaveAttribute("aria-valuenow", "50");
  });

  it("places each bar to the left of its value", () => {
    render(<ModelBreakdown byModel={byModel} />);
    const bar = screen.getByRole("progressbar", {
      name: /claude-opus-5 cost share/i,
    });
    const value = screen.getByText("1.20");
    expect(
      bar.compareDocumentPosition(value) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("left-aligns the bars within each cell", () => {
    render(<ModelBreakdown byModel={byModel} />);
    const bar = screen.getByRole("progressbar", {
      name: /claude-opus-5 cost share/i,
    });
    const row = bar.parentElement!;
    expect(row.className).toContain("justify-start");
  });

  it("renders bars tall enough to hover", () => {
    render(<ModelBreakdown byModel={byModel} />);
    const bar = screen.getByRole("progressbar", {
      name: /claude-opus-5 cost share/i,
    });
    expect(bar.className).toContain("h-2");
  });

  it("left-aligns the statistic headers", () => {
    render(<ModelBreakdown byModel={byModel} />);
    for (const label of ["Requests", "Total Tokens", "Cost"]) {
      const th = screen.getByText(label).closest("th")!;
      expect(th.className).not.toContain("text-right");
    }
  });

  it("shows the percentage when hovering a bar", async () => {
    render(
      <TooltipProvider>
        <ModelBreakdown byModel={byModel} />
      </TooltipProvider>
    );
    const bar = screen.getByRole("progressbar", {
      name: /claude-opus-5 cost share/i,
    });
    fireEvent.mouseEnter(bar);
    expect(await screen.findByText("48%")).toBeInTheDocument();
  });

  it("renders no percentage labels", () => {
    const { container } = render(<ModelBreakdown byModel={byModel} />);
    expect(container).not.toHaveTextContent("%");
  });

  it("drops the ambiguous bar from the model column", () => {
    const { container } = render(<ModelBreakdown byModel={byModel} />);
    const modelCell = container
      .querySelector('[data-model="claude-opus-5"]')!
      .closest("td")!;
    expect(modelCell.querySelector('[role="presentation"]')).toBeNull();
  });
});
