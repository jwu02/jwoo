import { render, screen } from "@testing-library/react";
import { SummaryCards } from "@/components/telemetry/summary-cards";

const totals = {
  leftClicks: 1000,
  rightClicks: 250,
  movementMeters: 1234.56,
  totalKeyPresses: 50000,
};

describe("SummaryCards", () => {
  it("renders all four totals", () => {
    render(<SummaryCards totals={totals} />);
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
    expect(screen.getByText("1,235")).toBeInTheDocument();
    expect(screen.getByText("50,000")).toBeInTheDocument();
  });

  it("renders cards in canonical order with Mouse Movement label", () => {
    const { container } = render(<SummaryCards totals={totals} />);

    const labels = Array.from(
      container.querySelectorAll(".grid > div > span")
    ).map((label) => label.textContent);

    expect(labels).toEqual([
      "Key Presses",
      "Left Clicks",
      "Right Clicks",
      "Mouse Movement",
    ]);
  });

  it("renders labels without icons", () => {
    const { container } = render(<SummaryCards totals={totals} />);
    expect(container.querySelectorAll("svg")).toHaveLength(0);
  });
});
