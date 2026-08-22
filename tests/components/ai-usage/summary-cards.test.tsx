import { render, screen } from "@testing-library/react";
import { SummaryCards } from "@/components/ai-usage/summary-cards";

const totals = {
  costYuan: 0.499,
  totalTokens: 100000,
  promptTokens: 90000,
  completionTokens: 10000,
  cacheHitTokens: 60,
  cacheMissTokens: 40,
};

describe("SummaryCards", () => {
  it("renders cost and total tokens", () => {
    render(<SummaryCards totals={totals} />);
    expect(screen.getByText("Cost")).toBeInTheDocument();
    expect(screen.getByText("0.50")).toBeInTheDocument();
    expect(screen.getByText("Total Tokens")).toBeInTheDocument();
    expect(screen.getByText("100,000")).toBeInTheDocument();
  });
});
