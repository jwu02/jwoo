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

/** What a Command leaves on the screen: the invocation echoed above its rows. */
export interface Print {
  echo: string
  rows: readonly PrintRow[]
  /** The not-found line an unknown invocation leaves instead of rows: the
   * machine's own error, never a Command's. The wiring ticket's renderer draws
   * it in the Print's accent. */
  error?: string
}

/** One Print: its Echo, then its rows. The rows are a definition list, so a
 * screen reader reads each label and value as a pair. */
function PrintBlock({ print }: { print: Print }) {
  return (
    <div className="mb-6 last:mb-0">
      {/* The Echo: the invocation, prefixed by the pastiched machine's prompt —
          Terminal chrome rather than a Command's data. */}
      <p className="text-muted-foreground">
        jwoo@localhost ~ <span className={ACCENT}>%</span>{" "}
        <span className="text-foreground">{print.echo}</span>
      </p>
      <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1.5 pl-0.5">
        {print.rows.map((row, index) => (
          // Keyed by position: the output is append-only, so an existing row
          // never moves and a repeated label or echo cannot collide.
          <div key={index} className="contents">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className={row.tone === "accent" ? ACCENT : "text-foreground"}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
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
