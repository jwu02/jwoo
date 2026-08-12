import { fireEvent, render, screen, within } from "@testing-library/react";
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

  describe("Caps Lock LED", () => {
    // The LED circle is the only circle inside the Caps Lock key.
    function getLed() {
      const capsKey = screen.getByRole("button", { name: "Caps Lock: 0 presses" });
      return capsKey.querySelector("circle")!;
    }

    it("renders off by default, the same color as the keycap text", () => {
      render(<KeyboardHeatmap keys={{}} />);

      expect(getLed()).toHaveAttribute("fill", "oklch(0.96 0 0)");
    });

    it("turns green when clicked", () => {
      render(<KeyboardHeatmap keys={{}} />);

      fireEvent.click(screen.getByRole("button", { name: "Caps Lock: 0 presses" }));

      expect(getLed()).toHaveAttribute("fill", "oklch(0.65 0.18 145)");
    });

    it("returns to off when clicked a second time", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const capsKey = screen.getByRole("button", { name: "Caps Lock: 0 presses" });
      fireEvent.click(capsKey);
      fireEvent.click(capsKey);

      expect(getLed()).toHaveAttribute("fill", "oklch(0.96 0 0)");
    });
  });

  describe("tooltip breakdown", () => {
    it("renders each contributing label and its count as separate, non-colon-joined elements", () => {
      render(<KeyboardHeatmap keys={{ "2": 5, "@": 3 }} />);

      // The 2 key aggregates to 8 presses (5 + 3); hover to open its tooltip.
      fireEvent.mouseEnter(screen.getByRole("button", { name: "2: 8 presses" }));

      const tooltip = screen.getByText("8 presses").parentElement!;
      // Breakdown is sorted by count descending, so the "2 → 5" row comes first.
      const row = within(tooltip).getByText("2").closest("div")!;

      const spans = row.querySelectorAll("span");
      expect(spans).toHaveLength(2);
      expect(spans[0]).toHaveTextContent("2");
      expect(spans[1]).toHaveTextContent("5");
      expect(row.textContent).not.toContain(":");
    });
  });
});
