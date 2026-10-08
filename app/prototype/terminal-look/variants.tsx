"use client"

/**
 * PROTOTYPE — throwaway. jwoo issue #60, "The Terminal's look".
 *
 * Four radically different answers to "what does the Terminal look like",
 * switched from the floating bar (?variant=os|phosphor|ansi|workbench). Same
 * fixture content in every variant — a prompt, /whoami, /socials, /help — so
 * the difference being judged is the chrome, the palette and how /whoami's
 * output is shaped, not the copy.
 *
 * Read the answer, steal the parts that won, then let this file die. Nothing
 * here is production code: no registry, no data fetching, no error handling.
 */

const PROFILE = {
  handle: "tony",
  host: "jwoo",
  name: "Tony Wu",
  age: "24",
  company: "Kevala",
  role: "Software Engineer",
  /** Read server-side from Vercel's geo headers in the real app. */
  location: "Sydney, Australia",
}

const SOCIALS = [
  { label: "GitHub", value: "github.com/jwu02" },
  { label: "Email", value: "tony@jwu02.dev" },
  { label: "LinkedIn", value: "linkedin.com/in/jwu02" },
]

const COMMANDS = [
  { name: "/help", description: "List the commands" },
  { name: "/whoami", description: "Who you are, and who I am" },
  { name: "/socials", description: "Where to find me" },
  { name: "/clear", description: "Wipe the screen" },
]

/** Neofetch-style art: a terminal drawn in the terminal. */
const ART = [
  "   ┌──────────────┐",
  "   │ ● ● ●        │",
  "   ├──────────────┤",
  "   │ ~ $ whoami   │",
  "   │ tony         │",
  "   │ ~ $ socials  │",
  "   │ ▓▓▓▓▓▓▓▓▓▓▓▓ │",
  "   └──────────────┘",
]

/** The full ANSI 16, mapped onto the site's dark palette. */
const ANSI = {
  black: "#1c1c22",
  red: "#e06c75",
  green: "#98c379",
  yellow: "#e5c07b",
  blue: "#61afef",
  magenta: "#c678dd",
  cyan: "#56b6c2",
  white: "#dcdfe4",
  dim: "#5c6370",
}

const CRT = {
  bg: "#04070a",
  ink: "#7df9aa",
  dim: "#2e7a52",
  bright: "#d8ffe8",
}

const PROTO_CSS = `
.tp-scan::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(to bottom,
    rgba(0,0,0,0.32) 0 1px, transparent 1px 3px);
}
.tp-vignette::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(115% 115% at 50% 45%, transparent 52%, rgba(0,0,0,0.7));
}
.tp-flicker { animation: tp-flicker 5s steps(90) infinite; }
@keyframes tp-flicker {
  0%, 96% { opacity: 1 }
  96.5% { opacity: 0.78 }
  97% { opacity: 1 }
  98.5% { opacity: 0.88 }
  99% { opacity: 1 }
}
.tp-caret { animation: tp-caret 1.05s steps(1) infinite; }
@keyframes tp-caret { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0 } }
@media (prefers-reduced-motion: reduce) {
  .tp-flicker, .tp-caret { animation: none }
}
`

export function TerminalVariant({ variantKey }: { variantKey: string }) {
  return (
    <>
      <style>{PROTO_CSS}</style>
      {variantKey === "phosphor" ? (
        <PhosphorCRT />
      ) : variantKey === "ansi" ? (
        <GlassAnsi />
      ) : variantKey === "workbench" ? (
        <Workbench />
      ) : (
        <OsPane />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ *
 * A — OS Pane: the terminal is just another application surface.
 * Glass inherited from the Shell, two tones plus the site's one accent,
 * type at OS size, /whoami as a definition list. No ASCII art, no CRT.
 * ------------------------------------------------------------------ */

function VariantAMark() {
  return (
    <>
      <span className="text-muted-foreground">
        {PROFILE.handle}@{PROFILE.host}
      </span>{" "}
      <span className="text-muted-foreground">~</span>{" "}
      <span style={{ color: "var(--claude-orange)" }}>%</span>{" "}
    </>
  )
}

function OsPane() {
  return (
    <div className="flex h-full min-h-0 flex-col font-mono text-[13.5px] leading-relaxed">
      <div className="min-h-0 flex-1 overflow-auto px-5 py-5 md:px-8 md:py-7">
        <VariantAMark /> <span className="text-foreground">/whoami</span>
        <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1.5 pl-0.5">
          {[
            ["Name", PROFILE.name],
            ["Age", PROFILE.age],
            ["Role", PROFILE.role],
            ["Company", PROFILE.company],
            ["You are in", PROFILE.location],
          ].map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6">
          <VariantAMark /> <span className="text-foreground">/socials</span>
          <ul className="mt-3 space-y-1.5 pl-0.5">
            {SOCIALS.map((s) => (
              <li key={s.label}>
                <span className="text-muted-foreground">{s.label}</span>
                <span className="text-muted-foreground/60"> · </span>
                <span style={{ color: "var(--claude-orange)" }}>{s.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* An OS text field, not a terminal prompt: rounded, translucent,
          focus ring borrowed from the rest of the shell. */}
      <div className="shrink-0 px-4 pb-4 md:px-6 md:pb-6">
        <div className="flex items-center gap-2 rounded-xl border border-foreground/12 bg-foreground/5 px-3.5 py-2.5 font-os text-sm text-foreground shadow-inner transition focus-within:border-foreground/25 focus-within:bg-foreground/8">
          <span className="text-muted-foreground">/</span>
          <input
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground/70"
            placeholder="Type a command…"
            aria-label="Terminal input"
          />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * B — Phosphor CRT: the OS frame is fought, not hugged. Black glass,
 * green phosphor, scanlines, vignette, flicker, square edges, and
 * /whoami as a neofetch block with ASCII art.
 * ------------------------------------------------------------------ */

function PhosphorCRT() {
  const glow = { textShadow: `0 0 6px ${CRT.ink}88` }
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#04070a] font-mono text-[13px] leading-relaxed">
      <div className="tp-vignette pointer-events-none absolute inset-0 z-20" />
      <div className="tp-scan pointer-events-none absolute inset-0 z-20" />

      <div
        className="tp-flicker relative z-10 min-h-0 flex-1 overflow-auto px-5 py-5 md:px-8 md:py-7"
        style={{ color: CRT.ink, ...glow }}
      >
        <div>
          <span style={{ color: CRT.dim }}>
            {PROFILE.handle}@{PROFILE.host}
          </span>
          <span style={{ color: CRT.dim }}>:~$ </span>
          <span style={{ color: CRT.bright }}>/whoami</span>
        </div>

        <div className="mt-3 flex gap-6">
          <pre
            className="hidden shrink-0 text-[12px] leading-[1.35] sm:block"
            aria-hidden
          >
            {ART.join("\n")}
          </pre>
          <div className="min-w-0">
            <div style={{ color: CRT.bright }}>
              {PROFILE.handle}@{PROFILE.host}
            </div>
            <div style={{ color: CRT.dim }}>──────────────────────────</div>
            <dl className="mt-1 space-y-0.5">
              {[
                ["Host", "jwoo.dev — personal site"],
                ["User", PROFILE.name],
                ["Age", PROFILE.age],
                ["Company", PROFILE.company],
                ["Role", PROFILE.role],
                ["You", PROFILE.location],
                ["Shell", "/bin/portfolio"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="inline" style={{ color: CRT.ink }}>
                    {label}
                  </dt>
                  <span style={{ color: CRT.dim }}>: </span>
                  <dd className="inline" style={{ color: CRT.bright }}>
                    {value}
                  </dd>
                </div>
              ))}
              <div>
                <dt className="inline" style={{ color: CRT.ink }}>
                  Socials
                </dt>
                <span style={{ color: CRT.dim }}>: </span>
                <dd className="inline">
                  {SOCIALS.map((s, i) => (
                    <span key={s.label}>
                      {i > 0 && <span style={{ color: CRT.dim }}> · </span>}
                      <span style={{ color: CRT.bright }}>{s.value}</span>
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-6">
          <span style={{ color: CRT.dim }}>
            {PROFILE.handle}@{PROFILE.host}
          </span>
          <span style={{ color: CRT.dim }}>:~$ </span>
          <span style={{ color: CRT.bright }}>/help</span>
          <div className="mt-1 space-y-0.5">
            {COMMANDS.map((c) => (
              <div key={c.name}>
                <span style={{ color: CRT.bright }}>
                  {c.name.padEnd(10, " ")}
                </span>
                <span style={{ color: CRT.dim }}>{c.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bare prompt, square, phosphor — no field, no rounding. */}
      <div
        className="relative z-10 flex shrink-0 items-center gap-2 border-t px-5 py-3 md:px-8"
        style={{ borderColor: `${CRT.dim}55`, ...glow }}
      >
        <span style={{ color: CRT.dim }}>
          {PROFILE.handle}@{PROFILE.host}:~$
        </span>
        <input
          className="w-full bg-transparent caret-transparent outline-none"
          style={{ color: CRT.bright }}
          placeholder=""
          aria-label="Terminal input"
        />
        <span
          className="tp-caret -ml-2 inline-block h-[1.05em] w-[0.6em]"
          style={{ background: CRT.ink }}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * C — Glass + ANSI: the OS pane and its type stay, but the output
 * speaks ANSI. A titlebar in the Dock's voice, a 16-colour palette, and
 * /whoami as a neofetch block. The middle of the road, on purpose.
 * ------------------------------------------------------------------ */

function AnsiLine({
  command,
  children,
}: {
  command: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <span style={{ color: ANSI.green }}>
        {PROFILE.handle}@{PROFILE.host}
      </span>
      <span style={{ color: ANSI.white }}>:</span>
      <span style={{ color: ANSI.blue }}>~</span>
      <span style={{ color: ANSI.white }}>$ </span>
      <span style={{ color: ANSI.white }}>{command}</span>
      {children}
    </div>
  )
}

function GlassAnsi() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* The OS titlebar: SF Pro, the Shell's voice, over a terminal body. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-foreground/10 px-4 py-2.5 font-os text-[13px] text-muted-foreground">
        <span className="flex gap-1.5" aria-hidden>
          <span
            className="size-3 rounded-full"
            style={{ background: ANSI.red }}
          />
          <span
            className="size-3 rounded-full"
            style={{ background: ANSI.yellow }}
          />
          <span
            className="size-3 rounded-full"
            style={{ background: ANSI.green }}
          />
        </span>
        <span className="ml-2">
          terminal — {PROFILE.handle}@{PROFILE.host}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-5 py-5 font-mono text-[13.5px] leading-relaxed md:px-7">
        <AnsiLine command="/whoami">
          <div className="mt-2 flex gap-6">
            <pre
              className="hidden shrink-0 text-[12px] leading-[1.35] sm:block"
              style={{ color: ANSI.magenta }}
              aria-hidden
            >
              {ART.join("\n")}
            </pre>
            <dl className="min-w-0 space-y-1">
              {[
                ["User", PROFILE.name],
                ["Age", PROFILE.age],
                ["Company", PROFILE.company],
                ["Role", PROFILE.role],
                ["You", PROFILE.location],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="inline" style={{ color: ANSI.yellow }}>
                    {label}
                  </dt>
                  <dd className="inline">
                    <span style={{ color: ANSI.dim }}>: </span>
                    <span style={{ color: ANSI.cyan }}>{value}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </AnsiLine>

        <AnsiLine command="/socials">
          <ul className="mt-1 space-y-0.5">
            {SOCIALS.map((s) => (
              <li key={s.label}>
                <span style={{ color: ANSI.yellow }}>{s.label}</span>
                <span style={{ color: ANSI.dim }}> › </span>
                <span
                  className="underline decoration-dotted"
                  style={{ color: ANSI.blue }}
                >
                  {s.value}
                </span>
              </li>
            ))}
          </ul>
        </AnsiLine>

        <AnsiLine command="/help">
          <div className="mt-1 grid grid-cols-[6.5rem_1fr] gap-x-4">
            {COMMANDS.map((c) => (
              <div key={c.name} className="contents">
                <span style={{ color: ANSI.green }}>{c.name}</span>
                <span style={{ color: ANSI.dim }}>{c.description}</span>
              </div>
            ))}
          </div>
        </AnsiLine>
      </div>

      <div className="shrink-0 border-t border-foreground/10 px-5 py-3 font-mono text-[13.5px] md:px-7">
        <div className="flex items-center gap-2">
          <span style={{ color: ANSI.green }}>
            {PROFILE.handle}@{PROFILE.host}
          </span>
          <span style={{ color: ANSI.white }}>:</span>
          <span style={{ color: ANSI.blue }}>~</span>
          <span style={{ color: ANSI.white }}>$</span>
          <input
            className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground/60"
            placeholder="help"
            aria-label="Terminal input"
          />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * D — Workbench: the terminal is a layout, not a scrollback. Output in
 * the main column, a persistent rail carrying the command list and the
 * visitor card, one input bar across the bottom. Chrome is OS, palette
 * is two-tone, /whoami never repeats itself in the scrollback.
 * ------------------------------------------------------------------ */

function Workbench() {
  return (
    <div className="flex h-full min-h-0 flex-col font-mono text-[13px]">
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-auto px-5 py-5 md:px-7">
          <VariantAMark /> <span className="text-foreground">/whoami</span>
          <p className="mt-3 max-w-prose pl-0.5 text-muted-foreground">
            Hi — I&apos;m{" "}
            <span className="text-foreground">{PROFILE.name}</span>, a{" "}
            <span className="text-foreground">
              {PROFILE.role.toLowerCase()}
            </span>{" "}
            at <span className="text-foreground">{PROFILE.company}</span>.
            You&apos;re reading from{" "}
            <span className="text-foreground">{PROFILE.location}</span>. The
            card on the right stays put; this column is just history.
          </p>
          <div className="mt-6">
            <VariantAMark /> <span className="text-foreground">/socials</span>
            <div className="mt-3 pl-0.5">
              {SOCIALS.map((s) => (
                <div key={s.label} className="flex gap-4">
                  <span className="w-24 text-muted-foreground">{s.label}</span>
                  <span style={{ color: "var(--claude-orange)" }}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 text-muted-foreground">
            <VariantAMark /> <span>clear</span>
            <div className="pl-0.5 text-muted-foreground/60">
              (history wiped; the rail is untouched)
            </div>
          </div>
        </div>

        {/* The rail: the four commands and who is asking, always in view. */}
        <aside className="hidden w-64 shrink-0 flex-col gap-6 overflow-auto border-l border-foreground/10 px-5 py-5 md:flex">
          <section>
            <h2 className="font-os text-[11px] tracking-widest text-muted-foreground uppercase">
              Commands
            </h2>
            <dl className="mt-3 space-y-2">
              {COMMANDS.map((c) => (
                <div key={c.name}>
                  <dt className="text-foreground">{c.name}</dt>
                  <dd className="text-muted-foreground/80">{c.description}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section>
            <h2 className="font-os text-[11px] tracking-widest text-muted-foreground uppercase">
              Visitor
            </h2>
            <p className="mt-3 text-muted-foreground">
              <span className="text-foreground">{PROFILE.location}</span>
              <br />
              via Vercel geo headers
            </p>
          </section>
        </aside>
      </div>

      <div className="shrink-0 border-t border-foreground/10 px-5 py-3 md:px-7">
        <div className="flex items-center gap-2">
          <VariantAMark />
          <input
            className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground/60"
            placeholder="try /whoami"
            aria-label="Terminal input"
          />
        </div>
      </div>
    </div>
  )
}
