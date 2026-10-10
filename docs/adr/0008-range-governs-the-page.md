# The range governs the page, and the key heatmap keeps a fixed 30-day window

Status: accepted

Both polled dashboards carry one range selector, in a row with *Last updated* at the top of the page, and it governs every panel on the page: the summary cards, the usage breakdowns, activity telemetry's mouse, and the charts. That reverses what the dashboards first shipped with, where only the time series moved with the range and every number above it was a lifetime sum — a page's most prominent control re-labelling one chart, with nothing saying so.

The keyboard heatmap is the one deliberate exception. Its source retains only about 30 days of keystrokes, so a "lifetime" map was never true — the page says so instead, "Data from last 30 days", next to the heatmap's toggle. The exception survives on the privacy ground that motivated it: a heatmap that followed the range would put a map of the visitor's last 24h of typing one click away. So `keys` stays on its own fixed 30-day window while `totals` is matched to the range, and the page says which clock is which rather than leaving it to this file.

## Consequences

The telemetry payload runs on two clocks at once: `totals` is the range's, `keys` is a fixed 30-day window. A reader who assumes one clock for a whole response will get it wrong, which is why the route says so where the two fetches sit side by side.

## Considered options

**Everything follows the range, heatmap included.** Rejected on the privacy ground above.

**The range governs only the time series** — what shipped, and what `docs/superpowers/specs/2026-08-09-telemetry-dashboard-design.md` and `2026-08-18-ai-usage-design.md` describe. Rejected: the cards and breakdowns read as "how much lately" to every viewer who asked, and the control implied it was answering that.

**A range control per section.** Rejected: two controls is two answers to "how far back am I looking", and no panel on either page wants a different range than its neighbour.
