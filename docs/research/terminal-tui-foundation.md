# Research: Rendering foundation for the Terminal app — Ink vs xterm.js vs hand-rolled DOM (jwoo issue #59)

**Ticket:** https://github.com/jwu02/jwoo/issues/59 — "can Ink (vadimdemedes/ink) run in a web browser in a maintained, supported way — or is it Node-only in practice — and what should the new Terminal application be built on: Ink, xterm.js, or hand-rolled terminal-styled DOM?"
**Researched against:** vadimdemedes/ink repo (readme@master, `src/render.ts`, `src/components/App.tsx`, issues #213 and #1003), npm registry metadata (`ink@8.0.0`, `@xterm/xterm@6.0.0`, `@xterm/addon-fit@0.11.0`, `ink-web@0.2.0`, `terminal-in-react@4.3.1`, `react-terminal@1.4.5`), xtermjs.org + xterm.js repo README and releases, bundlephobia size API, MDN `inputmode`, and the repo's own `package.json` / `CONTEXT.md`. Primary sources only: every load-bearing claim below was verified by fetching the owning source directly. Note on method: the search-provider APIs available to this session were unconfigured (no API keys), so no secondhand summaries were used or needed; `source_check` was skipped in favor of direct primary-source inspection, and that limitation is disclosed here.

---

## Answer

**Build the Terminal app on hand-rolled terminal-styled DOM (React + Tailwind, no new runtime dependencies).**

- **Ink is Node-only in practice.** Its README frames the runtime as Node ("An Ink app is a Node.js process"), its npm package declares `engines: { node: ">=22" }` and ships ESM-only, and its public entry (`src/render.ts`) imports `node:stream` and `node:process` and defaults `stdout`/`stdin`/`stderr` to `process.stdout`/`process.stdin`/`process.stderr`, typed as `NodeJS.WritableStream`/`NodeJS.ReadableStream` ([Ink readme@master](https://github.com/vadimdemedes/ink/blob/master/readme.md), [src/render.ts](https://github.com/vadimdemedes/ink/blob/master/src/render.ts), [npm `ink@8.0.0`](https://registry.npmjs.org/ink/latest)). The maintainer closed the long-running "Browser support" issue (#213) as **not planned** in February 2026, pointing people to the third-party `ink-web` project ([vadimdemedes/ink#213](https://github.com/vadimdemedes/ink/issues/213)).
- **xterm.js is browser-native and well maintained** (v6.0.0 shipped 2025-12-22; zero-dependency core; used by VS Code) ([xterm.js README](https://github.com/xtermjs/xterm.js#readme), [releases](https://github.com/xtermjs/xterm.js/releases)), but it is a VT/ANSI terminal *emulator* whose value — VT sequence parsing, a cell-grid buffer, scrollback, stream-based input — is built for hosting real terminal byte streams. For a decorative, print-only app with four authored commands it adds ≈82 KB gzip, an out-of-Tailwind theming model, and an input architecture that fights the persistent bottom input bar ([bundlephobia `@xterm/xterm@6.0.0`](https://bundlephobia.com/package/@xterm/xterm)).
- **Hand-rolled DOM** gives the mobile floor for free (a real `<input>` summons the software keyboard — [MDN `inputmode`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode)), keeps all styling in Tailwind/CSS as CONTEXT.md's visual language requires, costs zero bundle, and the only machinery we must write is an append-only output list, autoscroll, a prefix-matching command popup, and (cosmetically) a block-caret look.

The one browser-Ink path that exists — [`ink-web`](https://github.com/cjroth/ink-web) — is real and active but young (first release Nov 2025, v0.2.x, single maintainer), pins `ink ^6.0.0` while Ink's shipped latest is 8.0.0, and works by rendering Ink *through xterm.js anyway* — so it stacks both dependency trees and inherits every xterm.js downside ([ink-web README](https://github.com/cjroth/ink-web), [npm `ink-web@0.2.0`](https://registry.npmjs.org/ink-web/latest)). Nothing in the survey beats hand-rolled DOM for this app.

---

## Findings

### 1. Ink's own design contract is "a Node process"

1. **Claim:** Ink positions itself as a CLI renderer, and its lifecycle is defined against Node. **Sources:** [Ink readme@master](https://github.com/vadimdemedes/ink/blob/master/readme.md). **Support:** direct evidence. **Confidence:** high.
   - Tagline: "React for CLIs. Build and test your CLI output using components." / "Ink provides the same component-based UI building experience that React offers in the browser, but for command-line apps."
   - App Lifecycle section: "An Ink app is a Node.js process, so it stays alive only while there is active work in the event loop (timers, pending promises, `useInput` listening on `stdin`, etc.)."
   - Caveat to avoid misreading: the readme's "Ink requires the same Babel setup as you would do for regular React-based apps in the browser" is about *JSX tooling parity*, not about executing in a browser. (Interpretation of the tooling section in context.)

2. **Claim:** Ink's public entry point hard-depends on Node built-ins and TTY semantics. **Sources:** [src/render.ts@master](https://github.com/vadimdemedes/ink/blob/master/src/render.ts), [src/components/App.tsx@master](https://github.com/vadimdemedes/ink/blob/master/src/components/App.tsx). **Support:** direct evidence (quoted from source). **Confidence:** high.
   - `render.ts` opens with `import {Stream, type Writable} from 'node:stream';` and `import process from 'node:process';`, and destructures the defaults `stdout = process.stdout`, `stdin = process.stdin`, `stderr = process.stderr`. Option types are `NodeJS.WritableStream` / `NodeJS.ReadableStream`, and `getOptions()` does a `stdout instanceof Stream` check — a Node class identity test that cannot succeed on a browser polyfill shim without mimicking `node:stream` internals (that last clause is researcher inference; the imports/types/defaults are verbatim source).
   - `App.tsx` imports `EventEmitter` from `'node:events'`, drives input by attaching a `'readable'` listener to a Node stream and calling `rawModeStdin.setRawMode(true/false)`, writes bracketed-paste escapes directly to `stdout` (`stdout.write('\u{1B}[?2004h')`), checks `stdout.isTTY`, and throws `'Raw mode is not supported on the current process.stdin, which Ink uses as input stream by default.'` when raw mode is unavailable.

3. **Claim:** The shipped package declares a Node engine, ESM-only delivery, Node-leaning dependencies, and a React peer range the site doesn't satisfy. **Sources:** [npm registry `ink@8.0.0`](https://registry.npmjs.org/ink/latest). **Support:** direct evidence. **Confidence:** high.
   - `"engines": { "node": ">=22" }`, `"type": "module"`.
   - Runtime dependencies include `yoga-layout ~3.2.1` (the Flexbox layout engine), `react-reconciler ^0.34.0`, `chalk ^6.0.1`, `ansi-escapes ^7.3.0`, `terminal-size ^4.0.1`, `patch-console ^2.0.0`, `cli-cursor ^4.0.0`, `signal-exit ^3.0.7` — affordances of a Node process (TTY size, console patching, cursor hide/show, signal handling).
   - `peerDependencies: react >=19.3.0`; the site pins `react 19.2.4` (repo `package.json`), so even a hypothetical browser build of Ink 8 would raise a peer conflict. (Compatibility consequence is researcher inference; both version numbers are direct evidence.)

4. **Claim:** If Ink did run in a browser it would be the heaviest of the three options. **Sources:** [bundlephobia `ink@8.0.0`](https://bundlephobia.com/api/size?package=ink). **Support:** direct measurement (bundlephobia bundles the dependency tree into its size figure). **Confidence:** medium (third-party measurement tool).
   - ≈397 KB minified / ≈136 KB gzip, `dependencyCount: 23`; the two largest deps are `react-reconciler` (≈129 KB) and `yoga-layout` (≈128 KB) — before React itself, and the bundle still can't execute in a browser per §1–§2.

### 2. Ink's issue-tracker record: browser support was requested in 2019 and closed "not planned" in 2026

1. **Claim:** Running Ink in a browser has always required patching; the failures are exactly the Node surface named in §1. **Sources:** [vadimdemedes/ink#213](https://github.com/vadimdemedes/ink/issues/213). **Support:** direct evidence (issue text and comments). **Confidence:** high.
   - Issue author (2019): "First point of failure is, that `readline` doesn't exist in the browser", then "Removing readline gives the next error: `stdin` not defined."
   - vadimdemedes (2019): "I was planning to make Ink work in the browser soon as well to create some interactive demos for its website." — a plan that never materialized; every later attempt in the thread is a fork/patch.
   - Closure by sindresorhus, 2026-02-08, `state_reason: not_planned`: "Closing as there has been no movement on this and I don't personally see the strong urge for browser support. And there is https://github.com/cjroth/ink-web".

2. **Claim:** As of late 2026 Ink's public entry still pulls Node-only code, and browser use remains unofficial. **Sources:** [vadimdemedes/ink#1003](https://github.com/vadimdemedes/ink/issues/1003) (opened 2026-09-18, still open). **Support:** direct evidence. **Confidence:** high.
   - "importing Ink's public entry also pulls in Node process, stream, filesystem, and lifecycle code even when streams are supplied." The issue asks for a small "browser/custom host entry" that omits process defaults, signal handling, raw-mode lifecycle, and console patching; there is no maintainer commitment recorded on the issue.

### 3. The Ink-in-browser escape hatch: `ink-web` (and the older forks)

1. **Claim:** The one maintained way to run Ink in a browser is `ink-web`, which works by targeting xterm.js. **Sources:** [cjroth/ink-web README](https://github.com/cjroth/ink-web). **Support:** direct evidence. **Confidence:** high.
   - "A drop-in browser runtime for Ink. It renders Ink components into an xterm.js terminal in the browser." Components import from `ink` as normal, and a bundler alias redirects `ink` → `ink-web` at build time (`turbopack: { resolveAlias: { ink: "ink-web" } }`); exports include `ink-web`, `ink-web/css`, `ink-web/core`, `ink-web/next` (a Next.js helper), `ink-web/vite`.

2. **Claim:** `ink-web` is young, single-maintainer, and lags Ink's release train. **Sources:** [npm registry `ink-web@0.2.0`](https://registry.npmjs.org/ink-web/latest), [npm registry `ink-web` (version history)](https://registry.npmjs.org/ink-web), [cjroth/ink-web README compatibility table](https://github.com/cjroth/ink-web#compatibility). **Support:** direct evidence; dating is derived from npm registry publish timestamps (interpretation of metadata, not a stated source fact). **Confidence:** high for the version facts, medium for the derived dates.
   - Placeholder `0.0.0` published ≈ Nov 11 2025; first real package `0.1.0` ≈ Nov 22 2025; latest `0.2.0` ≈ early Mar 2026. Maintainer: one (`cjroth` / `chrisroth`).
   - `0.2.0` `peerDependencies`: `ink: ^6.0.0`, `@xterm/xterm: >=5.0.0`, `react: ^19.0.0`, `react-reconciler: ^0.33.0`, `scheduler: ^0.27.0`, `vite: >=7.0.0`; dependency `@xterm/addon-fit ^0.11.0`. Ink's shipped latest is **8.0.0** (npm), so the browser path currently trails Ink by two majors; the README compatibility table caps at "ink 6.5–6.8+".
   - Notable detail: `ink-web@0.2.0` devDependencies include `next ^16.1.6` and `@xterm/xterm ^6.0.0` — its Next integration targets the same Next 16 generation as this site, but its README table still says "xterm.js 5.x" (flagged under Contradictions).

3. **Claim:** Adopting `ink-web` means carrying both stacks and keeping xterm.js's rendering model anyway. **Sources:** [cjroth/ink-web README](https://github.com/cjroth/ink-web) + dependency facts in §1/§4. **Support:** researcher inference from the direct evidence that ink-web renders "into an xterm.js terminal" and peers against `ink`, `react-reconciler`, `scheduler`, `@xterm/xterm`. **Confidence:** high.
   - The client bundle would stack ink + `react-reconciler` + Yoga (WASM) + xterm.js + ink-web itself (≈136 KB gzip for ink and ≈82 KB gzip for xterm before ink-web and React), to produce output that this app authors by hand as four print-only commands.

4. **Claim:** Older Ink-in-browser forks are stale. **Sources:** [timsuchanek/ink-browser repo](https://github.com/timsuchanek/ink-browser) (patches `ink+2.3.0.patch`, `chalk+2.4.2.patch`; Create-React-App skeleton; 2019 demo), referenced from [#213](https://github.com/vadimdemedes/ink/issues/213). **Support:** direct evidence. **Confidence:** high. Researcher inference: pinned to 2019-era Ink 2.x, it is a historical artifact, not a candidate.

### 4. xterm.js: maintained and browser-native, but it is an emulator we don't need

1. **Claim:** xterm.js is the industry-standard in-browser terminal emulator, with a zero-dependency core. **Sources:** [xterm.js README](https://github.com/xtermjs/xterm.js#readme). **Support:** direct evidence. **Confidence:** high.
   - "Xterm.js is a frontend component that enables applications to bring fully-featured terminals to their users in the browser. It's used by popular projects such as VS Code (and its forks), Tabby and Hyper."
   - "Self-contained: The core library has zero dependencies." And the scope note: "Xterm.js is not `bash`. Xterm.js can be connected to processes like `bash` and let you interact with them (provide input, receive output) through a library like node-pty." — i.e., its design centers on hosting an external byte stream.

2. **Claim:** Maintenance status is strong, with a real (but churning) release train. **Sources:** [xterm.js releases](https://github.com/xtermjs/xterm.js/releases), [npm `@xterm/xterm@6.0.0`](https://registry.npmjs.org/@xterm/xterm/latest). **Support:** direct evidence. **Confidence:** high.
   - Releases: 5.4.0 (2025-03-01, migration to the `@xterm/*` scope — "the old `xterm` and `xterm-*` packages are now deprecated"), 5.5.0 (2025-04-05), 6.0.0 (2025-12-22; npm publish metadata confirms 2025).
   - 6.0.0 is a breaking-heavy release: canvas renderer removed ("we recommend using either the DOM renderer or WebGL"), viewport/scroll bar reworked ("the viewport/scroll bar works very differently now"), `windowsMode` removed. Researcher inference: healthy project, but a minor-version-pinned, changelog-watched dependency — more caretaking than a decorative app wants.

3. **Claim:** Cost and shape of the dependency. **Sources:** [bundlephobia `@xterm/xterm@6.0.0`](https://bundlephobia.com/api/size?package=@xterm/xterm), [npm `@xterm/xterm@6.0.0`](https://registry.npmjs.org/@xterm/xterm/latest), [npm `@xterm/addon-fit@0.11.0`](https://registry.npmjs.org/@xterm/addon-fit/latest). **Support:** direct evidence (bundlephobia measurement; registry metadata). **Confidence:** high on numbers, per-tool caveat as in §1.4.
   - ≈330 KB minified / ≈82 KB gzip, `dependencyCount: 0`; the package ships `lib/xterm.js` / `lib/xterm.mjs` plus `css/xterm.css` (a mandatory stylesheet — package `"style"` field). `@xterm/addon-fit` (0.11.0, released at the same commit as 6.0.0) is the usual companion for element-fit sizing.

4. **Claim:** There is no official React integration; usage is imperative. **Sources:** [xterm.js README Getting Started](https://github.com/xtermjs/xterm.js#getting-started), [xtermjs.org docs index](https://xtermjs.org/docs/) (guides list has no React binding). **Support:** direct evidence. **Confidence:** high.
   - Documented usage is `const term = new Terminal(); term.open(el); term.write('Hello from \x1B[1;3;31mxterm.js\x1B[0m $ ')` with output wiring like `pty.onData(data => term.write(data)); term.onData(data => pty.write(data));`. Researcher inference: on this site it would mean a client component owning a `useRef` + `useEffect` lifecycle, imperative `write()` calls, and manual disposal.

5. **Claim:** xterm.js fits a real-shell app, and misfits this one on styling, popup, and input architecture. **Sources:** [xterm.js README (features, browser support)](https://github.com/xtermjs/xterm.js#readme), [releases 6.0.0 (#5263, #5024)](https://github.com/xtermjs/xterm.js/releases), [MDN `inputmode`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode), repo `CONTEXT.md`. **Support:** mixture — the underlined facts are direct evidence; the fit judgments are labeled interpretation. **Confidence:** medium-high.
   - Theming: colors go through the `ITheme` options object and the shipped `xterm.css`, i.e. a JS palette plus its own stylesheet — not Tailwind classes. Direct evidence: README's theming/API description, package `style: css/xterm.css`. Interpretation: the site's glass/OS visual language (CONTEXT.md: applications rendered as places inside one system) can't be expressed inside the emulator's opaque cell grid; glass would have to wrap it, not style it.
   - Styled output: text styling is authored as ANSI escape sequences inside strings written to the terminal (README example `\x1B[1;3;31m…\x1B[0m`). Interpretation: for hand-authored v1 output that is a templating detour with no payoff, since nothing streams bytes at us.
   - Input: keyboard events flow through xterm's own hidden textarea and out of `onData` — direct evidence in the 6.0.0 release notes ("#5263 Make textarea readonly when disableStdin is set", "#5024 Fix duplicate input for some IMEs"). Interpretation: the persistent bottom input bar would have to drive focus into xterm's hidden textarea to summon the mobile keyboard (the same MDN-documented focus→virtual-keyboard path, one hop removed), and the `/` command popup would be a DOM overlay positioned over the emulator with manual focus/keyboard bridging.
   - Unused capability: VT parsing, scrollback of raw streams, mouse events, alternate screen (README features list) — all dead weight for print-only output. Interpretation.

### 5. Hand-rolled terminal-styled DOM: what you write, what you get free

1. **Claim:** The whole foundation already exists in the repo's stack. **Sources:** repo `package.json` (next 16.2.6, react 19.2.4, react-dom 19.2.4, tailwindcss ^4, typescript ^5). **Support:** direct evidence. **Confidence:** high. The app is a client component (standard `'use client'` boundary); no additional runtime dependency is required.

2. **Claim:** The mobile floor — tap input, software keyboard, output scrolls above — is native browser behavior with a real editable element. **Sources:** [MDN `inputmode`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode). **Support:** direct evidence for the mechanism. **Confidence:** high.
   - `inputmode` exists precisely to pick the virtual keyboard for an editable element; `none` is documented as "No virtual keyboard. For when the page implements its own keyboard input control." — i.e., the default for a real `<input>`/`<textarea>` is that the virtual keyboard appears. Companion attribute `enterkeyhint` labels the return/submit key (MDN links it for the "Search"-labeled key case). Researcher inference: an `inputmode="search"` + `enterkeyhint="enter"` bottom bar plus a separately scrollable output `<div>` above it covers the mobile floor with zero shimming.

3. **Claim:** The v1 feature list maps to small, boring pieces. **Sources:** ticket scope (four print-only commands, `/` popup with descriptions, persistent bottom input bar) + repo CONTEXT.md. **Support:** researcher inference from the requirements against the browser platform. **Confidence:** high.
   - Output: an append-only list of styled line/span records rendered as DOM; `/clear` truncates it; autoscroll pins to the bottom unless the visitor scrolled up.
   - `/` popup: plain React state — filter the command registry by prefix, render descriptions as a DOM list; keyboard matching on the same controlled `<input>`.
   - Aesthetic: monospace stack, blinking-block caret after the last printed line if wanted — a CSS animation, not terminal machinery.
   - Theming: every color/glass surface is a Tailwind class, which is what CONTEXT.md's visual language requires; the app is one more "application" surface in the OS shell.

4. **Claim:** The costs are bounded and known. **Sources:** the v1 scope; no external source owns these. **Support:** researcher inference. **Confidence:** medium-high.
   - We own: text wrapping (CSS handles it; only long unbroken tokens need care), selection styling, focus/blur handoff between output area and input bar, and any v2 wants (scrollback limits, history via arrow keys) — none of which require an ANSI parser or a layout engine.
   - Accessibility is standard DOM (roles, labels, live region for new output) rather than an emulator's accessibility layer. Interpretation.

### 6. Decision matrix and what each choice means for the three downstream tickets

Direct evidence for the cells comes from §1–§5; the matrix assembly and the "easy/hard" judgments are researcher inference.

| | Ink (direct) | Ink via `ink-web` | xterm.js | Hand-rolled DOM |
|---|---|---|---|---|
| Runs in browser | No — Node entry, engines ≥22, closed issue #213 | Yes — via alias + xterm.js | Yes — its home turf | Yes |
| Maintained/supported for browser use | n/a | Young 0.2.x, 1 maintainer, lags ink majors (ink 8 vs `^6`) | Strong (VS Code, 6.0.0 Dec 2025) | We own it (small surface) |
| Added bundle (gzip) | n/a (won't load) | ≈136 KB (ink) + ≈82 KB (xterm) + ink-web + React reconciler/Yoga WASM | ≈82 KB + `xterm.css` (+fit addon) | 0 |
| Theming in Tailwind/CSS | n/a | No — xterm `ITheme` + `xterm.css` | No — `ITheme` + `xterm.css` | Yes — natively |
| Mobile keyboard via bottom input bar | n/a | Hard — input must enter xterm's hidden textarea | Medium/hard — hidden textarea focus bridge, `onData` stream | Easy — real `<input>`, `inputmode`/`enterkeyhint` |
| `/` command popup with descriptions | n/a | DOM overlay over emulator + focus bridging | DOM overlay over emulator + focus bridging | Trivial React state |
| Print-only styled output | n/a | Ink components → cell grid → xterm | ANSI escape strings via `term.write` | Styled spans — the output *is* the DOM |
| What it makes easy later | — | Faithful demos of real Ink CLIs | Hosting real VT/PTY streams, ANSI playback (asciinema-style) | Anything the site can style; no VT/PTY path |

**Downstream tickets:**
- **Look (glass/OS language):** hand-rolled makes every surface a Tailwind class — the glass panel, selection colors, popup sheet. xterm.js (and therefore any Ink-via-ink-web route) pins the visible surface to the emulator's cell grid and its own stylesheet; the site can wrap it but not style it. *(Inference from the theming facts in §4.5/§5.)*
- **Input bar & mobile:** hand-rolled keeps input as an ordinary controlled input with IME, composition, autofill and the virtual keyboard all handled by the platform; xterm routes keys through `onData` and a hidden textarea, so the popup, the bar and the keyboard each need bridging. *(§4.5, §5.2.)*
- **Command registry:** hand-rolled = the registry is plain TypeScript rendered as DOM; no serialization step. xterm = registry output must be emitted as ANSI-styled `write()` calls. Ink = registry output is nice JSX (`<Text color="green">`), but only reachable through the young `ink-web` layer. *(§3, §4, §5.)*

**Reversal path** *(inference)*: if v2 ever wants real terminal content — playing back recorded CLI sessions or hosting a live stream — an xterm.js surface can be added *inside* the same application shell as a swap-in renderer for the output region, without touching the command registry or input bar design; nothing in the hand-rolled v1 forecloses it.

---

## Contradictions

1. **Ink's readme tooling sentence vs its runtime.** The readme says Ink requires "the same Babel setup as you would do for regular React-based apps in the browser," which superficially sounds like browser support; in context it compares JSX toolchains only, while the same document defines the app as "a Node.js process" and the source imports `node:stream`/`node:process`. Resolution: tooling sentence is about transpilation, not execution. ([Ink readme@master](https://github.com/vadimdemedes/ink/blob/master/readme.md))
2. **`ink-web` README compatibility table vs its own npm metadata.** The README table says ink-web 0.1.17+ pairs with "xterm.js 5.x", but `ink-web@0.2.0` devDependencies use `@xterm/xterm ^6.0.0` and its peer range is `@xterm/xterm >=5.0.0`. The README table appears stale relative to the package. ([cjroth/ink-web README](https://github.com/cjroth/ink-web), [npm `ink-web@0.2.0`](https://registry.npmjs.org/ink-web/latest)) — unresolved upstream; both recorded here.
3. **Dependency counts.** bundlephobia reports `dependencyCount: 23` for ink@8.0.0 while the npm registry lists ≈28 dependency names (bundlephobia merges/dedupes transitive and utility packages differently). Sizes cited from bundlephobia, names cited from the registry. ([bundlephobia](https://bundlephobia.com/api/size?package=ink), [npm](https://registry.npmjs.org/ink/latest))
4. **2019 browser plan vs 2026 closure.** vadimdemedes wrote in 2019 that browser support was planned "soon"; the issue was closed in 2026 as not planned with no movement. Not a live dispute — recorded as the documented trajectory. ([#213](https://github.com/vadimdemedes/ink/issues/213))

## Missing evidence

- Ink has no docs page that *states* a browser-support policy either way. The Node-only conclusion rests on three independent primary signals (engines/ESM metadata, Node imports and `process.*` defaults in the entry source, and the closed #213) rather than one explicit statement.
- No hands-on device testing was done of xterm.js's hidden-textarea keyboard behavior on mobile, or of `ink-web`'s runtime maturity (SSR behavior, IME edge cases, its `/next` helper under Turbopack). The decision doesn't hinge on these — xterm.js and ink-web lose on theming and bundle grounds before mobile behavior is reached — but both are implementation-time risks if either path were chosen.
- `react-terminal@1.4.5` (a decorative React terminal component; deps `react ^19`, `ua-parser-js`; last npm publish ≈ Jan 2025 per registry timestamps) was checked only at the registry level, not code-audited. Deprioritized because it ships its own styling system, which is exactly what the site doesn't want, and hand-rolling makes it redundant.
- The local Next.js 16.2.6 bundled docs (`node_modules/next/dist/docs/`) were not located (no index file at the guessed path), and no Next-specific API is load-bearing in this decision; per the repo's AGENTS.md, implementers should read the local Next docs before writing the actual client component.

## Sources

**Kept (primary, load-bearing):**
- [Ink readme@master](https://github.com/vadimdemedes/ink/blob/master/readme.md) — positioning ("React for CLIs"), "An Ink app is a Node.js process", component/hook surface.
- [Ink `src/render.ts`](https://github.com/vadimdemedes/ink/blob/master/src/render.ts) — `node:stream`/`node:process` imports, `process.stdout/stdin/stderr` defaults, `NodeJS.*` stream types.
- [Ink `src/components/App.tsx`](https://github.com/vadimdemedes/ink/blob/master/src/components/App.tsx) — `node:events` import, raw-mode TTY handling, `stdout.isTTY`, bracketed-paste escapes.
- [npm registry `ink@8.0.0`](https://registry.npmjs.org/ink/latest) — engines, ESM, dependency list, `react >=19.3.0` peer.
- [vadimdemedes/ink#213 "Browser support"](https://github.com/vadimdemedes/ink/issues/213) — the browser-support request (2019), maintainer comments, closure as not planned (2026-02-08).
- [vadimdemedes/ink#1003 "Small browser/custom host entry"](https://github.com/vadimdemedes/ink/issues/1003) — current (open) confirmation that Ink's public entry pulls Node code.
- [cjroth/ink-web README](https://github.com/cjroth/ink-web) — the browser Ink runtime: xterm.js-based, bundler alias, `/next` export, compatibility table, `ink-ui`.
- [npm registry `ink-web@0.2.0`](https://registry.npmjs.org/ink-web/latest) and [version history](https://registry.npmjs.org/ink-web) — peer ranges (`ink ^6.0.0`, `@xterm/xterm >=5.0.0`), maintainer, publish cadence.
- [xterm.js README](https://github.com/xtermjs/xterm.js#readme) — what xterm.js is/isn't, zero-dependency core, imperative API, theming/stylesheet, browser support.
- [xterm.js releases](https://github.com/xtermjs/xterm.js/releases) — 6.0.0 (2025-12-22) and 5.4.0/5.5.0 (2025), `@xterm/*` scope migration, canvas-renderer removal, textarea/IME fixes (#5263, #5024).
- [npm `@xterm/xterm@6.0.0`](https://registry.npmjs.org/@xterm/xterm/latest), [npm `@xterm/addon-fit@0.11.0`](https://registry.npmjs.org/@xterm/addon-fit/latest) — package shape, `css/xterm.css`, addon freshness.
- [bundlephobia `@xterm/xterm`](https://bundlephobia.com/api/size?package=@xterm/xterm) and [bundlephobia `ink`](https://bundlephobia.com/api/size?package=ink) — size measurements (82 KB vs 136 KB gzip).
- [MDN `inputmode`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode) — virtual-keyboard behavior of editable elements and `inputmode`/`enterkeyhint` tuning.
- Repo files: `package.json` (next 16.2.6 / react 19.2.4 / Tailwind 4 / three + pixi + d3 already carried), `CONTEXT.md` (OS shell/application/visual-language model).
- [npm `terminal-in-react@4.3.1`](https://registry.npmjs.org/terminal-in-react/latest), [npm `react-terminal@1.4.5`](https://registry.npmjs.org/react-terminal/latest), [timsuchanek/ink-browser](https://github.com/timsuchanek/ink-browser) — the alternatives sweep, with staleness data.

**Rejected / deprioritized:**
- Blog posts and "build a terminal in React" tutorials — secondary write-ups; every claim here traces to the owning source instead.
- GitHub API repo-metadata endpoints — rate-limited mid-session; equivalent facts taken from npm registry and repo HTML pages.
- `node_modules/next/dist/docs/index.mdx` (local Next 16 docs) — file not found at the guessed path; no Next API was needed for this decision (noted in Missing evidence).
