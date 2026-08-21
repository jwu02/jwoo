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

  it("renders the shift accent above the base character", () => {
    render(<KeyboardHeatmap keys={{}} />);

    const twoKey = screen.getByRole("button", { name: "2: 0 presses" });
    // getByText matches the <tspan> (its parent <text> carries the x/y attrs)
    const baseTwo = within(twoKey).getByText("2").closest("text")!;
    const at = within(twoKey).getByText("@");

    // Shifted character sits above the base, horizontally aligned with it.
    expect(Number(at.getAttribute("y"))).toBeLessThan(
      Number(baseTwo.getAttribute("y"))
    );
    expect(Number(at.getAttribute("x"))).toBeCloseTo(
      Number(baseTwo.getAttribute("x")),
      1
    );
  });

  it("renders the pound shift accent on the 3 key", () => {
    render(<KeyboardHeatmap keys={{}} />);

    const threeKey = screen.getByRole("button", { name: "3: 0 presses" });
    expect(within(threeKey).getByText("£")).toBeInTheDocument();
  });

  describe("stacked multi-character labels", () => {
    // The 2 key prints @ above 2, with € to the right of the 2, all on a
    // standard 38×34 keycap.
    function fontSizeOf(el: Element): number {
      return Number(el.getAttribute("style")!.match(/font-size:\s*(\d+)/)![1]);
    }

    it("stacks the shifted character above the base symmetrically about the vertical centre", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const twoKey = screen.getByRole("button", { name: "2: 0 presses" });
      const rect = twoKey.querySelector("rect")!;
      const baseTwo = within(twoKey).getByText("2").closest("text")!;
      const at = within(twoKey).getByText("@");

      const centreY =
        Number(rect.getAttribute("y")) + Number(rect.getAttribute("height")) / 2;
      const baseY = Number(baseTwo.getAttribute("y"));
      const shiftY = Number(at.getAttribute("y"));

      // Shift is as far above centre as the base is below it — neither reads
      // as more vertically centred than the other.
      expect(centreY - shiftY).toBeCloseTo(baseY - centreY, 1);
    });

    it("positions the option character to the right of and level with the base", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const twoKey = screen.getByRole("button", { name: "2: 0 presses" });
      const baseTwo = within(twoKey).getByText("2").closest("text")!;
      const euro = within(twoKey).getByText("€");

      expect(Number(euro.getAttribute("x"))).toBeGreaterThan(
        Number(baseTwo.getAttribute("x"))
      );
      // Level with the main (bottom) character, not the key's centre.
      expect(Number(euro.getAttribute("y"))).toBeCloseTo(
        Number(baseTwo.getAttribute("y")),
        1
      );
    });

    it("renders the shift, base, and option characters at the same font size", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const twoKey = screen.getByRole("button", { name: "2: 0 presses" });
      const baseTwo = within(twoKey).getByText("2").closest("text")!;
      const at = within(twoKey).getByText("@");
      const euro = within(twoKey).getByText("€");

      const baseSize = fontSizeOf(baseTwo);
      expect(fontSizeOf(at)).toBe(baseSize);
      expect(fontSizeOf(euro)).toBe(baseSize);
    });
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
      ["Fn", "lucide-globe"],
      ["Up Arrow", "lucide-chevron-up"],
      ["Down Arrow", "lucide-chevron-down"],
      ["Left Arrow", "lucide-chevron-left"],
      ["Right Arrow", "lucide-chevron-right"],
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

  describe("function row icons", () => {
    // key name → lucide class added to the icon's svg (lucide-<kebab-name>)
    const iconKeys: Array<[string, string]> = [
      ["F1", "lucide-sun-dim"],
      ["F2", "lucide-sun"],
      ["F3", "lucide-layout-template"],
      ["F4", "lucide-search"],
      ["F5", "lucide-mic"],
      ["F6", "lucide-moon"],
      ["F7", "lucide-step-back"],
      ["F9", "lucide-step-forward"],
      ["F10", "lucide-volume"],
      ["F11", "lucide-volume-1"],
      ["F12", "lucide-volume-2"],
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

    it("renders the composed play/pause glyphs on the F8 key", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const f8 = screen.getByRole("button", { name: "F8: 0 presses" });
      expect(f8.querySelector(".lucide-play")).toBeInTheDocument();
      expect(f8.querySelector(".lucide-pause")).toBeInTheDocument();
    });

    it("keeps the function number printed under the icon", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const f1 = screen.getByRole("button", { name: "F1: 0 presses" });
      expect(within(f1).getByText("F1")).toBeInTheDocument();
    });

    it("positions the icon above the number and sizes the icon larger", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const f1 = screen.getByRole("button", { name: "F1: 0 presses" });
      const rect = f1.querySelector("rect")!;
      const icon = f1.querySelector(".lucide-sun-dim")!;
      const iconG = f1.querySelector("g[transform]")!;
      const label = within(f1).getByText("F1").closest("text")!;

      const rectY = Number(rect.getAttribute("y"));
      const rectH = Number(rect.getAttribute("height"));
      const centreY = rectY + rectH / 2;

      const translate = iconG
        .getAttribute("transform")!
        .match(/translate\(([\d.]+),\s*([\d.]+)\)/)!;
      const iconY = Number(translate[2]);

      const labelY = Number(label.getAttribute("y"));
      const labelSize = Number(
        label.getAttribute("style")!.match(/font-size:\s*(\d+)/)![1]
      );
      const iconSize = Number(icon.getAttribute("width"));

      // Icon in the upper half, number in the lower half.
      expect(iconY).toBeLessThan(centreY);
      expect(labelY).toBeGreaterThan(centreY);
      // Icon renders larger than the number text.
      expect(iconSize).toBeGreaterThan(labelSize);
    });
  });

  describe("icon corner positioning", () => {
    // Must mirror the component's ICON_SIZE / MODIFIER_ICON_SIZE and padding.
    const pad = 6;

    function parseTranslate(g: Element) {
      const match = g
        .getAttribute("transform")!
        .match(/translate\(([\d.]+),\s*([\d.]+)\)/)!;
      return { x: Number(match[1]), y: Number(match[2]) };
    }

    // key name → horizontal → vertical corner → icon size
    const cornerCases: Array<
      [string, "left" | "right", "top" | "bottom", number]
    > = [
      ["Tab", "left", "bottom", 11],
      ["Caps Lock", "left", "bottom", 11],
      ["Left Shift", "left", "bottom", 11],
      ["Right Shift", "right", "bottom", 11],
      ["Delete", "right", "bottom", 11],
      ["Return", "right", "bottom", 11],
      ["Left Ctrl", "right", "top", 8],
      ["Left Option", "right", "top", 8],
      ["Right Option", "left", "top", 8],
      ["Left Cmd", "right", "top", 8],
      ["Right Cmd", "left", "top", 8],
      ["Fn", "left", "bottom", 8],
    ];

    it.each(cornerCases)(
      "positions the icon in the %s-%s corner of the %s key",
      (keyName, horizontal, vertical, iconSize) => {
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

    it("renders modifier icons smaller than the other key icons", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const ctrlIcon = screen
        .getByRole("button", { name: "Left Ctrl: 0 presses" })
        .querySelector("svg")!;
      const tabIcon = screen
        .getByRole("button", { name: "Tab: 0 presses" })
        .querySelector("svg")!;

      expect(Number(ctrlIcon.getAttribute("width"))).toBeLessThan(
        Number(tabIcon.getAttribute("width"))
      );
    });

    it("renders the fn globe at the modifier icon size", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const fnIcon = screen
        .getByRole("button", { name: "Fn: 0 presses" })
        .querySelector("svg")!;
      const ctrlIcon = screen
        .getByRole("button", { name: "Left Ctrl: 0 presses" })
        .querySelector("svg")!;
      const tabIcon = screen
        .getByRole("button", { name: "Tab: 0 presses" })
        .querySelector("svg")!;

      // Same size as the modifier glyphs, smaller than the standalone icons.
      expect(Number(fnIcon.getAttribute("width"))).toBe(
        Number(ctrlIcon.getAttribute("width"))
      );
      expect(Number(fnIcon.getAttribute("width"))).toBeLessThan(
        Number(tabIcon.getAttribute("width"))
      );
    });

    it("renders the modifier word larger than its icon", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const ctrl = screen.getByRole("button", {
        name: "Left Ctrl: 0 presses",
      });
      const iconWidth = Number(
        ctrl.querySelector("svg")!.getAttribute("width")
      );
      const word = within(ctrl).getByText("control").closest("text")!;
      const fontSize = Number(
        word.getAttribute("style")!.match(/font-size:\s*(\d+)/)![1]
      );

      expect(fontSize).toBeGreaterThan(iconWidth);
    });
  });

  describe("arrow key icons", () => {
    // The chevron icon's top-left corner should sit at the keycap centre
    // minus half its size, so the glyph is centred on the keycap.
    it("centres the chevron on the up arrow keycap", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const up = screen.getByRole("button", { name: "Up Arrow: 0 presses" });
      const rect = up.querySelector("rect")!;
      const icon = up.querySelector(".lucide-chevron-up")!;
      const iconG = up.querySelector("g[transform]")!;

      const translate = iconG
        .getAttribute("transform")!
        .match(/translate\(([\d.]+),\s*([\d.]+)\)/)!;
      const iconX = Number(translate[1]);
      const iconY = Number(translate[2]);
      const iconSize = Number(icon.getAttribute("width"));

      const rectX = Number(rect.getAttribute("x"));
      const rectY = Number(rect.getAttribute("y"));
      const rectW = Number(rect.getAttribute("width"));
      const rectH = Number(rect.getAttribute("height"));

      expect(iconX).toBeCloseTo(rectX + rectW / 2 - iconSize / 2, 1);
      expect(iconY).toBeCloseTo(rectY + rectH / 2 - iconSize / 2, 1);
    });

    it("replaces the triangle glyph on the arrow keys", () => {
      render(<KeyboardHeatmap keys={{}} />);

      for (const keyName of [
        "Up Arrow",
        "Down Arrow",
        "Left Arrow",
        "Right Arrow",
      ]) {
        const key = screen.getByRole("button", {
          name: `${keyName}: 0 presses`,
        });
        expect(within(key).queryByText("▲")).not.toBeInTheDocument();
      }
    });
  });

  describe("keycap label positioning", () => {
    it("pins the esc text label to the bottom-left of the key", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const esc = screen.getByRole("button", { name: "Esc: 0 presses" });
      const rect = esc.querySelector("rect")!;
      const text = within(esc).getByText("esc").closest("text")!;

      const rectX = Number(rect.getAttribute("x"));
      const rectY = Number(rect.getAttribute("y"));
      const rectW = Number(rect.getAttribute("width"));
      const rectH = Number(rect.getAttribute("height"));

      // Left of centre and in the lower half of the keycap.
      expect(Number(text.getAttribute("x"))).toBeLessThan(rectX + rectW / 2);
      expect(Number(text.getAttribute("y"))).toBeGreaterThan(rectY + rectH / 2);
    });

    it("renders the fn label at the top-right at the modifier text size", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const fn = screen.getByRole("button", { name: "Fn: 0 presses" });
      const rect = fn.querySelector("rect")!;
      const text = within(fn).getByText("fn").closest("text")!;

      const rectX = Number(rect.getAttribute("x"));
      const rectY = Number(rect.getAttribute("y"));
      const rectW = Number(rect.getAttribute("width"));
      const rectH = Number(rect.getAttribute("height"));

      // Right of centre, in the top half, and as big as the modifier words.
      expect(Number(text.getAttribute("x"))).toBeGreaterThan(rectX + rectW / 2);
      expect(Number(text.getAttribute("y"))).toBeLessThan(rectY + rectH / 2);
      expect(text.getAttribute("style")).toContain("font-size: 9px");
    });
  });

  describe("tactile markers", () => {
    it.each(["F", "J"])("renders a tactile marker on the %s key", (keyName) => {
      render(<KeyboardHeatmap keys={{}} />);

      const key = screen.getByRole("button", {
        name: `${keyName}: 0 presses`,
      });

      expect(key.querySelector(".tactile-marker")).toBeInTheDocument();
    });

    it("does not render a tactile marker on the D key", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const d = screen.getByRole("button", { name: "D: 0 presses" });

      expect(d.querySelector(".tactile-marker")).not.toBeInTheDocument();
    });

    it("places the tactile marker in the lower half of the key", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const f = screen.getByRole("button", { name: "F: 0 presses" });
      const rect = f.querySelector("rect")!;
      const marker = f.querySelector(".tactile-marker")!;

      const rectY = Number(rect.getAttribute("y"));
      const rectH = Number(rect.getAttribute("height"));

      expect(Number(marker.getAttribute("y"))).toBeGreaterThan(rectY + rectH / 2);
    });
  });

  describe("keycap hover highlight", () => {
    // The 2 key has no icon, so its first <rect> is the keycap base.
    function getHighlight() {
      const key = screen.getByRole("button", { name: "2: 0 presses" });
      return key.querySelector(".keycap-hover")!;
    }

    it("renders a primary tint overlay that is transparent at rest", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const highlight = getHighlight();
      expect(highlight).toBeInTheDocument();
      expect(highlight.getAttribute("opacity")).toBe("0");
      expect(highlight).toHaveClass("pointer-events-none");
    });

    it("fades the tint in when the key is hovered", () => {
      render(<KeyboardHeatmap keys={{}} />);

      fireEvent.mouseEnter(
        screen.getByRole("button", { name: "2: 0 presses" })
      );

      expect(getHighlight().getAttribute("opacity")).toBe("0.2");
    });

    it("fades the tint back out when the pointer leaves", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const key = screen.getByRole("button", { name: "2: 0 presses" });
      fireEvent.mouseEnter(key);
      fireEvent.mouseLeave(key);

      expect(getHighlight().getAttribute("opacity")).toBe("0");
    });

    it("mirrors the keycap geometry so it tints exactly the keycap", () => {
      render(<KeyboardHeatmap keys={{}} />);

      const key = screen.getByRole("button", { name: "2: 0 presses" });
      const baseRect = key.querySelector("rect")!;
      const highlight = getHighlight();

      for (const attr of ["x", "y", "width", "height", "rx"]) {
        expect(highlight.getAttribute(attr)).toBe(
          baseRect.getAttribute(attr)
        );
      }
    });
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
