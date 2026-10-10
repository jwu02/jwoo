/** The site's one accent, named once: a Print's look is settled here, not in a
 * row and never in a Command. */
const ACCENT = "text-[var(--claude-orange)]"

/**
 * One row of a Print: a muted label beside its value. `tone` is the only
 * styling a Command can ask for, so no Command carries look.
 */
export interface PrintRow {
  label: string
  value: string
  /** Paint the value in the site's accent instead of the default foreground. */
  tone?: "accent"
}

/** What a Command leaves on the screen: the invocation, then its content —
 * rows, and a Portrait where the Command has one. */
export interface Print {
  /** The invocation the visitor ran. Absent on the opening print, which the
   * machine produces before anyone has typed anything. */
  echo?: string
  rows: readonly PrintRow[]
  /** The picture to draw beside the rows, as the glyphs themselves — a Command
   * that has one prints it, and no Command has to name an image. A space is
   * paper: the grid is drawn on whatever the Terminal's background is. */
  portrait?: string
  /** The not-found line an unknown invocation leaves instead of rows: the
   * machine's own error, never a Command's. The renderer draws it in the
   * Print's accent. */
  error?: string
  /** The application route this Print takes the visitor to. A Command that is
   * a way out of the Terminal carries one; the page follows it and the
   * renderer draws the Print unchanged. */
  href?: string
}

/** The pastiched machine's prompt, authored once: every Echo prefixes its
 * invocation with it, and the output ends with it, standing empty. */
export function Prompt() {
  return (
    <>
      jwoo@localhost ~ <span className={ACCENT}>%</span>
    </>
  )
}

/** One Print: its Echo, then its content — the Portrait beside the rows, or,
 * for an unknown invocation, the machine's not-found line. The rows are a
 * definition list, so a screen reader reads each label and value as a pair. */
function PrintBlock({ print }: { print: Print }) {
  return (
    <div className="mb-6 last:mb-0">
      {/* The Echo: the invocation, prefixed by the pastiched machine's prompt —
          Terminal chrome rather than a Command's data. The opening print has
          none, and shows its content alone. */}
      {print.echo && (
        <p className="text-muted-foreground">
          <Prompt />{" "}
          <span className="text-foreground">{print.echo}</span>
        </p>
      )}
      {/* The content wraps rather than shrinks: the Portrait is a picture at a
          fixed width, so a narrow pane puts the rows under it instead of
          squeezing either one. */}
      <div className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-3 pl-0.5">
        {print.portrait && (
          // Glyphs, not an image — the density is the shading, and `leading-none`
          // is what keeps the cells the shape the grid was drawn in. Announced
          // as a picture and not read out: the rows beside it say the same thing.
          // Type-sized rather than width-sized, because the cell is the picture:
          // the grid's columns of a phone's pane would otherwise overflow it.
          <pre
            role="img"
            aria-label="Portrait of the owner"
            className="shrink-0 text-[5px] leading-none sm:text-[8px]"
          >
            {print.portrait}
          </pre>
        )}
        {print.error ? (
          <p className={ACCENT}>{print.error}</p>
        ) : (
          <dl className="grid grow basis-56 grid-cols-[7rem_1fr] gap-x-4 gap-y-1.5">
            {print.rows.map((row, index) => (
              // Keyed by position: the output is append-only, so an existing row
              // never moves and a repeated label or echo cannot collide.
              <div key={index} className="contents">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd
                  className={row.tone === "accent" ? ACCENT : "text-foreground"}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  )
}

/** The screen's output: every Print, in the order it was produced. */
export function PrintList({ prints }: { prints: readonly Print[] }) {
  return (
    <>
      {prints.map((print, index) => (
        <PrintBlock key={index} print={print} />
      ))}
    </>
  )
}
