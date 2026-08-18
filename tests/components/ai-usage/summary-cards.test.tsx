import { render, screen } from "@testing-library/react";
import { SummaryCards } from "@/components/ai-usage/summary-cards";

const totals = {
  costYuan: 0.499,
  totalTokens: 100000,
  promptTokens: 90000,
  completionTokens: 10000,
  cacheHitTokens: 60,
  cacheMissTokens: 40,
  requests: 3,
};

describe("SummaryCards", () => {
  it("renders cost, tokens, cache rate, and request totals", () => {
    render(<SummaryCards totals={totals} />);
    expect(screen.getByText("Cost")).toBeInTheDocument();
    expect(screen.getByText("0.50")).toBeInTheDocument();
    expect(screen.getByText("Total Tokens")).toBeInTheDocument();
    expect(screen.getByText("100,000")).toBeInTheDocument();
    expect(screen.getByText("Prompt Tokens")).toBeInTheDocument();
    expect(screen.getByText("90,000")).toBeInTheDocument();
    expect(screen.getByText("Completion Tokens")).toBeInTheDocument();
    expect(screen.getByText("10,000")).toBeInTheDocument();
    expect(screen.getByText("Cache Hit Rate")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("Requests")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders cache hit rate as 0% when there are no cached tokens", () => {
    render(
      <SummaryCards
        totals={{ ...totals, cacheHitTokens: 0, cacheMissTokens: 0 }}
      />
    );
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
