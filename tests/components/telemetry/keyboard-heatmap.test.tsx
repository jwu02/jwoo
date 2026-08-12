import { render, screen, within } from "@testing-library/react";
import { KeyboardHeatmap } from "@/components/telemetry/keyboard-heatmap";

describe("KeyboardHeatmap", () => {
  it("renders the option character to the right of the base on the 2 key", () => {
    render(<KeyboardHeatmap keys={{}} />);

    const twoKey = screen.getByRole("button", { name: "2: 0 presses" });
    // getByText matches the <tspan> (its parent <text> carries the x/y attrs)
    const baseTwo = within(twoKey).getByText("2").closest("text")!;
    const euro = within(twoKey).getByText("€");

    expect(Number(euro.getAttribute("x"))).toBeGreaterThan(
      Number(baseTwo.getAttribute("x"))
    );
  });

  it("renders the option character to the right of the base on the 3 key", () => {
    render(<KeyboardHeatmap keys={{}} />);

    const threeKey = screen.getByRole("button", { name: "3: 0 presses" });
    // getByText matches the <tspan> (its parent <text> carries the x/y attrs)
    const baseThree = within(threeKey).getByText("3").closest("text")!;
    const hash = within(threeKey).getByText("#");

    expect(Number(hash.getAttribute("x"))).toBeGreaterThan(
      Number(baseThree.getAttribute("x"))
    );
  });

  it("renders the shift accent at the top-left of the key", () => {
    render(<KeyboardHeatmap keys={{}} />);

    const twoKey = screen.getByRole("button", { name: "2: 0 presses" });
    // getByText matches the <tspan> (its parent <text> carries the x/y attrs)
    const baseTwo = within(twoKey).getByText("2").closest("text")!;
    const at = within(twoKey).getByText("@");

    expect(Number(at.getAttribute("y"))).toBeLessThan(
      Number(baseTwo.getAttribute("y"))
    );
    expect(Number(at.getAttribute("x"))).toBeLessThan(
      Number(baseTwo.getAttribute("x"))
    );
  });

  it("renders the pound shift accent on the 3 key", () => {
    render(<KeyboardHeatmap keys={{}} />);

    const threeKey = screen.getByRole("button", { name: "3: 0 presses" });
    expect(within(threeKey).getByText("£")).toBeInTheDocument();
  });
});
