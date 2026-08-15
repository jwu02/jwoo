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
      expect(row).toHaveClass("flex justify-between gap-3");
      expect(spans[1]).toHaveClass("tabular-nums");
      expect(row.textContent).not.toContain(":");
    });

    it("shows unclicked characters with a zero count", () => {
      render(<KeyboardHeatmap keys={{ "3": 4, "#": 2 }} />);

      // The 3 key aggregates to 6 presses; £ was never pressed.
      fireEvent.mouseEnter(screen.getByRole("button", { name: "3: 6 presses" }));

      const tooltip = screen.getByText("6 presses").parentElement!;
      const poundRow = within(tooltip).getByText("£").closest("div")!;

      const spans = poundRow.querySelectorAll("span");
      expect(spans).toHaveLength(2);
      expect(spans[0]).toHaveTextContent("£");
      expect(spans[1]).toHaveTextContent("0");
    });

    it("shows every character of the key even when it has no presses", () => {
      render(<KeyboardHeatmap keys={{}} />);

      fireEvent.mouseEnter(screen.getByRole("button", { name: "2: 0 presses" }));

      const tooltip = screen.getByText("0 presses").parentElement!;
      // The 2 key prints 2, @, and € — all should appear, each at 0.
      expect(within(tooltip).getByText("2")).toBeInTheDocument();
      expect(within(tooltip).getByText("@")).toBeInTheDocument();
      expect(within(tooltip).getByText("€")).toBeInTheDocument();
    });
  });

  describe("keycap icons", () => {
    // key name → lucide class added to the icon's svg (lucide-<kebab-name>)
    const iconKeys: Array<[string, string]> = [
      ["Tab", "lucide-arrow-right-to-line"],
      ["Caps Lock", "lucide-arrow-big-up-dash"],
      ["Left Shift", "lucide-arrow-big-up"],
      ["Delete", "lucide-delete"],
      ["Return", "lucide-corner-down-left"],
      ["Left Ctrl", "lucide-chevron-up"],
      ["Left Option", "lucide-option"],
      ["Left Cmd", "lucide-command"],
    ];

    it.each(iconKeys)(
      "renders a lucide %s icon on the %s key",
      (keyName, iconClass) => {
        render(<KeyboardHeatmap keys={{}} />);

        const key = screen.getByRole("button", {
          name: `${keyName}: 0 presses`,
        });

        expect(key.querySelector(`.${iconClass}`)).toBeInTheDocument();
      }
    );

    // key name → the text label the keycap used to print
    const textLabels: Array<[string, string]> = [
      ["Tab", "tab"],
      ["Caps Lock", "caps"],
      ["Left Shift", "shift"],
      ["Delete", "delete"],
      ["Return", "return"],
      ["Left Ctrl", "ctrl"],
      ["Left Option", "opt"],
      ["Left Cmd", "cmd"],
    ];

    it.each(textLabels)(
      "replaces the %s key's text label with an icon",
      (keyName, oldLabel) => {
        render(<KeyboardHeatmap keys={{}} />);

        const key = screen.getByRole("button", {
          name: `${keyName}: 0 presses`,
        });

        expect(within(key).queryByText(oldLabel)).not.toBeInTheDocument();
      }
    );

    it("renders the same shift icon on both shift keys", () => {
      render(<KeyboardHeatmap keys={{}} />);

      expect(
        screen
          .getByRole("button", { name: "Left Shift: 0 presses" })
          .querySelector(".lucide-arrow-big-up")
      ).toBeInTheDocument();
      expect(
        screen
          .getByRole("button", { name: "Right Shift: 0 presses" })
          .querySelector(".lucide-arrow-big-up")
      ).toBeInTheDocument();
    });
  });

  describe("icon corner positioning", () => {
    // Must mirror the component's ICON_SIZE and keycap padding.
    const iconSize = 11;
    const pad = 6;

    function parseTranslate(g: Element) {
      const match = g
        .getAttribute("transform")!
        .match(/translate\(([\d.]+),\s*([\d.]+)\)/)!;
      return { x: Number(match[1]), y: Number(match[2]) };
    }

    // key name → horizontal → vertical corner for its icon
    const cornerCases: Array<[string, "left" | "right", "top" | "bottom"]> = [
      ["Tab", "left", "bottom"],
      ["Caps Lock", "left", "bottom"],
      ["Left Shift", "left", "bottom"],
      ["Right Shift", "right", "bottom"],
      ["Delete", "right", "bottom"],
      ["Return", "right", "bottom"],
      ["Left Ctrl", "right", "top"],
      ["Left Option", "right", "top"],
      ["Right Option", "left", "top"],
      ["Left Cmd", "right", "top"],
      ["Right Cmd", "left", "top"],
    ];

    it.each(cornerCases)(
      "positions the icon in the %s-%s corner of the %s key",
      (keyName, horizontal, vertical) => {
        render(<KeyboardHeatmap keys={{}} />);

        const key = screen.getByRole("button", {
          name: `${keyName}: 0 presses`,
        });
        const rect = key.querySelector("rect")!;
        const iconG = key.querySelector("g[transform]")!;
        const { x: iconX, y: iconY } = parseTranslate(iconG);

        const rectX = Number(rect.getAttribute("x"));
        const rectY = Number(rect.getAttribute("y"));
        const rectW = Number(rect.getAttribute("width"));
        const rectH = Number(rect.getAttribute("height"));

        const expectedX =
          horizontal === "left"
            ? rectX + pad
            : rectX + rectW - pad - iconSize;
        const expectedY =
          vertical === "top" ? rectY + pad : rectY + rectH - pad - iconSize;

        expect(Math.abs(iconX - expectedX)).toBeLessThan(1);
        expect(Math.abs(iconY - expectedY)).toBeLessThan(1);
      }
    );
  });

  describe("modifier key labels", () => {
    it("renders the modifier words under the icons on each key", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const ctrl = screen.getByRole("button", {
        name: "Left Ctrl: 0 presses",
      });
      const leftOpt = screen.getByRole("button", {
        name: "Left Option: 0 presses",
      });
      const rightOpt = screen.getByRole("button", {
        name: "Right Option: 0 presses",
      });
      const leftCmd = screen.getByRole("button", {
        name: "Left Cmd: 0 presses",
      });
      const rightCmd = screen.getByRole("button", {
        name: "Right Cmd: 0 presses",
      });

      expect(within(ctrl).getByText("control")).toBeInTheDocument();
      expect(within(leftOpt).getByText("option")).toBeInTheDocument();
      expect(within(rightOpt).getByText("option")).toBeInTheDocument();
      expect(within(leftCmd).getByText("command")).toBeInTheDocument();
      expect(within(rightCmd).getByText("command")).toBeInTheDocument();
    });

    it("sits below the key's vertical centre so it reads as under the icon", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const ctrl = screen.getByRole("button", {
        name: "Left Ctrl: 0 presses",
      });
      const rect = ctrl.querySelector("rect")!;
      const centreY =
        Number(rect.getAttribute("y")) + Number(rect.getAttribute("height")) / 2;
      const word = within(ctrl).getByText("control");

      expect(Number(word.getAttribute("y"))).toBeGreaterThan(centreY);
    });
  });
});
