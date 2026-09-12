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
  });

  it("renders total tokens in millions with an M unit", () => {
    render(<SummaryCards totals={{ ...totals, totalTokens: 1234567 }} />);
    expect(screen.getByText("1.2")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("keeps sub-million token counts readable", () => {
    render(<SummaryCards totals={{ ...totals, totalTokens: 100000 }} />);
    expect(screen.getByText("0.1")).toBeInTheDocument();
  });

  it("trims trailing zeros for whole millions", () => {
    render(<SummaryCards totals={{ ...totals, totalTokens: 5000000 }} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders zero rather than collapsing an empty range", () => {
    render(<SummaryCards totals={{ ...totals, totalTokens: 0 }} />);
    expect(screen.queryByText("0.0")).not.toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders labels without icons", () => {
    const { container } = render(<SummaryCards totals={totals} />);
    expect(container.querySelectorAll("svg")).toHaveLength(0);
  });
});
