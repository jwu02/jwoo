# The kevala UX is drawn cabinet screens

Status: accepted

Everything kevala shows the visitor is drawn in the cabinet's own skin: the ready screen's second choice, the consent screen, the download progress, the per-session loading beat, the toggle during play, and the Margin readout. No DOM chrome sits over the cabinet. The cabinet is one framed design at fixed art resolution (ADR 0007); DOM over the canvas would put a second visual language on it and drag scale-aware positioning into a canvas the adapter already scales as a unit. Drawn screens reuse what the cabinet already has — the pixel font, the blink as the attention device, the phase-drawn screens — and touch acts through tap zones hit-tested over art regions.

## Considered options

**A DOM overlay** — a button under the well, or a panel floating over the canvas. Rejected: it breaks the one-framed-design reading ADR 0007 exists to protect, needs scale-aware styling to track the CSS-scaled canvas, and a glass consent card would read as site chrome landing on the game rather than the cabinet speaking.

**A keyboard-only toggle** with a drawn state indicator. Rejected: touch visitors could never hand off mid-game. The toggle is drawn and tappable, with K as the keyboard's twin.

## Consequences

- Copy lives within the pixel font's glyph set (`A–Z 0–9 - . : ! ? / ' + ( ) < >`): a drawn bar and a fraction instead of a percentage, a blink instead of an asterisk to mark a new Checkpoint, no commas.
- Every hint line names its key and carries its own tap zone, so keyboard and touch have the same power on every screen.
- Accessibility stays where the cabinet's already is: the sr-only status region announces kevala's states (consent shown, downloading, kevala playing, handed off); nothing drawn is the sole carrier of meaning.
- The weights cache (Cache Storage) and the consent record (localStorage) are both keyed to the Checkpoint; neither is visitor-visible beyond the screens above.
