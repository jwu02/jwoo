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
  it("renders cost, total tokens, and request turns", () => {
    render(<SummaryCards totals={totals} />);
    expect(screen.getByText("Cost")).toBeInTheDocument();
    expect(screen.getByText("0.50")).toBeInTheDocument();
    expect(screen.getByText("Total Tokens")).toBeInTheDocument();
    expect(screen.getByText("100K")).toBeInTheDocument();
    expect(screen.getByText("Request Turns")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("formats request turns with thousands separators", () => {
    render(<SummaryCards totals={{ ...totals, requests: 1500 }} />);
    expect(screen.getByText("1,500")).toBeInTheDocument();
  });
});
