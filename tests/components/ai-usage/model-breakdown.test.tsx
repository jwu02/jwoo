import { render, screen } from "@testing-library/react";
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
});
