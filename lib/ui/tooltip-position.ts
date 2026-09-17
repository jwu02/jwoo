/**
 * Tooltip placement for the keyboard heatmap.
 *
 * The heatmap lives in a horizontally scrollable container, and the tooltip is
 * positioned absolutely within it (in container-content coordinates, i.e. the
 * same space as `scrollLeft`).  Positioning the tooltip purely off the key's
 * center makes it clip out of view for keys on the container's edges — the
 * function row sits at the very top (no room above) and edge keys have no room
 * to either side.  This function clamps the tooltip into the visible area and
 * flips it below the key when there isn't room above.
 */

export interface TooltipAnchor {
  /** Horizontal center of the key, in container-content coordinates. */
  centerX: number;
  /** Top edge of the key, in container-content coordinates. */
  keyTop: number;
  /** Rendered height of the key (used to place a flipped tooltip below it). */
  keyHeight: number;
}

export interface TooltipContainer {
  /** Visible width of the scroll container (excludes scrollbars). */
  clientWidth: number;
  /** Current horizontal scroll offset of the container. */
  scrollLeft: number;
}

export interface TooltipPositionOptions {
  /** Gap between the key and the tooltip. */
  gap?: number;
  /** Minimum distance from the container's visible edges. */
  margin?: number;
}

export function computeTooltipPosition(
  anchor: TooltipAnchor,
  tooltipWidth: number,
  tooltipHeight: number,
  container: TooltipContainer,
  options: TooltipPositionOptions = {}
): { left: number; top: number } {
  const gap = options.gap ?? 8;
  const margin = options.margin ?? 4;

  // Horizontal: preferred position centers the tooltip on the key; clamp it
  // into the visible area.  `Math.max(minLeft, maxLeft)` guards the degenerate
  // case where the tooltip is wider than the container (fall back to the left
  // margin rather than a negative clamp).
  let left = anchor.centerX - tooltipWidth / 2;
  const minLeft = container.scrollLeft + margin;
  const maxLeft = container.scrollLeft + container.clientWidth - tooltipWidth - margin;
  left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft));

  // Vertical: prefer above the key; flip below when there isn't room.
  const roomAbove = anchor.keyTop - gap - tooltipHeight;
  const top =
    roomAbove >= margin ? roomAbove : anchor.keyTop + anchor.keyHeight + gap;

  return { left, top };
}
