import { render, screen } from "@testing-library/react";
import { SummaryCards } from "@/components/ai-usage/summary-cards";

// The cache pair partitions the prompt tokens, as the collector records it, so
// this fixture keeps hit + miss === promptTokens rather than inventing a shape
// the real data cannot take.
const totals = {
  costYuan: 0.499,
  totalTokens: 100000,
  promptTokens: 90000,
  completionTokens: 10000,
  cacheHitTokens: 54000,
  cacheMissTokens: 36000,
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

  it("renders the cache hit rate as a share of prompt tokens", () => {
    render(<SummaryCards totals={totals} />);
    expect(screen.getByText("Cache Hit Rate")).toBeInTheDocument();
    expect(screen.getByText("60.0")).toBeInTheDocument();
    expect(screen.getByText("%")).toBeInTheDocument();
  });

  it("excludes completion tokens from the hit rate", () => {
    render(
      <SummaryCards
        totals={{
          ...totals,
          promptTokens: 2,
          cacheHitTokens: 1,
          cacheMissTokens: 1,
          completionTokens: 999999,
        }}
      />
    );
    expect(screen.getByText("50.0")).toBeInTheDocument();
  });

  it("orders the rate card after the two primary totals", () => {
    const { container } = render(<SummaryCards totals={totals} />);
    const labels = Array.from(
      container.querySelectorAll(".grid > div > span")
    ).map((label) => label.textContent);
    expect(labels).toEqual(["Cost", "Total Tokens", "Cache Hit Rate"]);
  });

  it("shows an unknown rate when no prompt tokens went through the cache", () => {
    render(
      <SummaryCards
        totals={{ ...totals, cacheHitTokens: 0, cacheMissTokens: 0 }}
      />
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("%")).not.toBeInTheDocument();
  });

  it("shows an unknown rate for an empty range", () => {
    render(
      <SummaryCards
        totals={{
          ...totals,
          promptTokens: 0,
          cacheHitTokens: 0,
          cacheMissTokens: 0,
        }}
      />
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("%")).not.toBeInTheDocument();
  });
});
