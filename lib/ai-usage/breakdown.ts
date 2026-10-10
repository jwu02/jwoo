// The AI-usage breakdown's row contract, and how much of it one donut may show.

import { OTHERS_PROJECT } from "./project-groups";

/** The one unnamed segment. It wears the project fallback's own name on
 *  purpose: both mean "not named individually", so the Project view shows a
 *  single `Others` rather than two similarly spelled slices. */
export const OTHERS_SEGMENT = OTHERS_PROJECT;

/** The most segments a donut draws: seven named plus {@link OTHERS_SEGMENT}. */
export const MAX_SEGMENTS = 8;

/** One row of a usage breakdown, shared by the page and the donut pair. */
export interface BreakdownRow {
  /** Stable unique key for the row. */
  id: string;
  label: string;
  costYuan: number;
  totalTokens: number;
}

/** A metric a donut can be drawn from. Each donut ranks by its own. */
export type BreakdownMetric = "costYuan" | "totalTokens";

export interface DonutSegment {
  label: string;
  value: number;
}

/**
 * Fold a breakdown into at most {@link MAX_SEGMENTS} segments: the seven
 * largest by `metric`, then one `Others` holding everything else.
 *
 * A row already called `Others` never ranks on its own — it is already "not
 * named individually", so it joins the folded tail instead of sitting beside
 * it. Zero-value rows are dropped rather than drawn as an invisible slice;
 * ties break on label so the donut is stable between polls.
 */
export function buildDonutSegments(
  rows: BreakdownRow[],
  metric: BreakdownMetric
): DonutSegment[] {
  const ranked = rows
    .filter((row) => row.label !== OTHERS_SEGMENT && row[metric] > 0)
    .sort((a, b) => b[metric] - a[metric] || a.label.localeCompare(b.label));

  const shown = ranked.slice(0, MAX_SEGMENTS - 1);
  const shownLabels = new Set(shown.map((row) => row.label));

  const others = rows.reduce(
    (sum, row) =>
      row.label === OTHERS_SEGMENT || !shownLabels.has(row.label)
        ? sum + row[metric]
        : sum,
    0
  );

  const segments = shown.map((row) => ({
    label: row.label,
    value: row[metric],
  }));
  if (others > 0) segments.push({ label: OTHERS_SEGMENT, value: others });
  return segments;
}
