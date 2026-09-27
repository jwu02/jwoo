/**
 * Tooltip placement for a 3D scene's hover tooltip.
 *
 * The tooltip is positioned absolutely inside the scene box, in that box's own
 * coordinates.  Positioning it purely off the hovered key's center makes it
 * clip out of view for keys on the box's edges — the function row sits at the
 * very top (no room above) and edge keys have no room to either side.  This
 * function clamps the tooltip into the visible area and flips it below the key
 * when there isn't room above.
 */

/** Gap between the key and the tooltip. */
const GAP = 8;

/** Minimum distance from the box's visible edges. */
const MARGIN = 4;

export interface TooltipAnchor {
  /** Horizontal center of the key, in the scene box's coordinates. */
  centerX: number;
  /** Top edge of the key, in the scene box's coordinates. */
  keyTop: number;
  /** Rendered height of the key (used to place a flipped tooltip below it). */
  keyHeight: number;
}

export interface TooltipContainer {
  /** Visible width of the scene box (excludes scrollbars). */
  clientWidth: number;
}

export function computeTooltipPosition(
  anchor: TooltipAnchor,
  tooltipWidth: number,
  tooltipHeight: number,
  container: TooltipContainer
): { left: number; top: number } {
  // Horizontal: preferred position centers the tooltip on the key; clamp it
  // into the visible area.  `Math.max(minLeft, maxLeft)` guards the degenerate
  // case where the tooltip is wider than the container (fall back to the left
  // margin rather than a negative clamp).
  let left = anchor.centerX - tooltipWidth / 2;
  const minLeft = MARGIN;
  const maxLeft = container.clientWidth - tooltipWidth - MARGIN;
  left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft));

  // Vertical: prefer above the key; flip below when there isn't room.
  const roomAbove = anchor.keyTop - GAP - tooltipHeight;
  const top = roomAbove >= MARGIN ? roomAbove : anchor.keyTop + anchor.keyHeight + GAP;

  return { left, top };
}
