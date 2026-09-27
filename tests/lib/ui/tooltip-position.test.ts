import {
  computeTooltipPosition,
  TooltipAnchor,
} from "@/lib/ui/tooltip-position";

const GAP = 8;
const MARGIN = 4;

function anchor(overrides: Partial<TooltipAnchor> = {}): TooltipAnchor {
  return { centerX: 300, keyTop: 100, keyHeight: 34, ...overrides };
}

describe("computeTooltipPosition", () => {
  it("centers above a key when there is room", () => {
    const pos = computeTooltipPosition(anchor(), 100, 40, { clientWidth: 600 });

    // 300 - 100/2 = 250 (within clamp [4, 496]); above: 100 - 8 - 40 = 52
    expect(pos).toEqual({ left: 250, top: 52 });
  });

  it("clamps into view for keys at the left edge", () => {
    const pos = computeTooltipPosition(anchor({ centerX: 20 }), 100, 40, {
      clientWidth: 600,
    });

    // 20 - 50 = -30 would extend past the left edge → clamp to margin
    expect(pos.left).toBe(MARGIN);
  });

  it("clamps into view for keys at the right edge", () => {
    const pos = computeTooltipPosition(anchor({ centerX: 580 }), 100, 40, {
      clientWidth: 600,
    });

    // 580 - 50 = 530 would extend past the right edge → clamp to clientWidth - width - margin
    expect(pos.left).toBe(600 - 100 - MARGIN);
  });

  it("flips below the key when there is no room above (function row)", () => {
    const pos = computeTooltipPosition(
      anchor({ keyTop: 0, keyHeight: 28 }),
      100,
      40,
      { clientWidth: 600 }
    );

    // Above would need to be at 0 - 8 - 40 = -48 (< margin) → show below the key
    expect(pos.top).toBe(0 + 28 + GAP);
  });

  it("keeps the tooltip at the left edge when it is wider than the container", () => {
    const pos = computeTooltipPosition(anchor({ centerX: 30 }), 100, 40, {
      clientWidth: 60,
    });

    // maxLeft would be negative → fall back to the left margin
    expect(pos.left).toBe(MARGIN);
  });
});
