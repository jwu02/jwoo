/**
 * Styling for the pill toggle both polled dashboards use: the activity
 * telemetry range selector and the AI-usage view switcher are one control in
 * two places, so the classes live here once rather than being copied into each.
 *
 * Only the styling is shared. Each caller still owns its own option list and
 * its own selection type.
 */

/** The rounded track the buttons sit in. */
export const pillGroupClass =
  "inline-flex rounded-full border border-border bg-card p-1";

/**
 * One button in the track. The selected button takes the primary fill; the rest
 * stay muted until hovered.
 */
export function pillButtonClass(selected: boolean): string {
  return `cursor-pointer rounded-full px-3 py-1 text-sm font-medium outline-none transition-colors ${
    selected
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:text-foreground"
  }`;
}
