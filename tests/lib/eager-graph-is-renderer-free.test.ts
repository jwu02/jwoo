import { readFileSync, existsSync, readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

// Guards the invariant in ADR 0001: no renderer may be reachable through static
// imports from a page, so the server never evaluates one and it stays out of the
// first client chunk. Scenes reach their canvas through `() => import(...)`
// behind SceneGate, which is a deliberate boundary — this walks only static
// imports and stops at dynamic ones.

const ROOT = resolve(__dirname, "../..")

/**
 * Every route in the app tree, plus the shell every route renders inside —
 * discovered rather than listed, so a page is guarded the day it appears.
 */
function routeEntries(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return routeEntries(path)
    return entry.name === "page.tsx" ? [path] : []
  })
}

const PAGE_ENTRIES = [
  ...routeEntries(join(ROOT, "app")),
  join(ROOT, "app/layout.tsx"),
].map((path) => path.replace(`${ROOT}/`, ""))

/**
 * Modules no route reaches, and which must still keep the boundary themselves:
 * kevala's runtime, which the consent screen loads with a dynamic import
 * (ADR-0009) and which builds the module Worker. The worker's `new URL(...)`
 * never appears in an import statement, so this entry is the only way the walk
 * can see a static `import "./kevala-worker"` beside it — the mistake that
 * would put transformers.js back in the eager graph.
 */
const LAZY_ENTRIES = ["lib/tetris/kevala-runtime.ts"]

const GUARDED_ENTRIES = [...PAGE_ENTRIES, ...LAZY_ENTRIES]

// What a route's first chunk must never pull in: the renderers, one WebGL stack
// at a time, and the ML runtime kevala scores with (ADR-0001, ADR-0009).
// `three-stdlib` and the R3F ecosystem are reached through three's roots, so
// matching the roots is enough; a page is held to every renderer's list, not
// only its own. transformers.js reaches onnxruntime-web through its own root,
// so both are named.
const FORBIDDEN_PACKAGES = [
  "three",
  "@react-three/fiber",
  "@react-three/drei",
  "pixi.js",
  "@huggingface/transformers",
  "onnxruntime-web",
]

/** Static import specifiers, and type-only imports are erased so they don't count. */
function staticImports(source: string): string[] {
  const specifiers: string[] = []
  // `import ... from "x"` / `import "x"` — but not `import type`, and not the
  // `import("x")` call form, which is the boundary this test stops at.
  const pattern = /^\s*import\s+(?!type\s)(?:[^"']*?from\s+)?["']([^"']+)["']/gm
  for (const match of source.matchAll(pattern)) specifiers.push(match[1])
  return specifiers
}

function resolveSpecifier(fromFile: string, specifier: string): string | null {
  let base: string
  if (specifier.startsWith("@/")) base = join(ROOT, specifier.slice(2))
  else if (specifier.startsWith("."))
    base = resolve(dirname(fromFile), specifier)
  else return null // a package

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

describe("eager module graph", () => {
  it.each(GUARDED_ENTRIES)(
    "%s reaches no renderer or ML runtime statically",
    (entry) => {
      const entryPath = join(ROOT, entry)
      expect(existsSync(entryPath)).toBe(true)

      const seen = new Set<string>()
      const offenders: string[] = []
      const queue = [entryPath]

      while (queue.length > 0) {
        const file = queue.pop()!
        if (seen.has(file)) continue
        seen.add(file)

        for (const specifier of staticImports(readFileSync(file, "utf8"))) {
          if (
            FORBIDDEN_PACKAGES.some(
              (pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`)
            )
          ) {
            offenders.push(
              `${file.replace(`${ROOT}/`, "")} imports "${specifier}"`
            )
            continue
          }
          const resolved = resolveSpecifier(file, specifier)
          if (resolved) queue.push(resolved)
        }
      }

      // A page that eagerly pulls a renderer defeats the client-only canvas: the
      // server would evaluate the WebGL stack, and it would land in the first
      // chunk. A boundary module that statically reaches one defeats the same
      // thing one layer down.
      expect(offenders).toEqual([])
    }
  )
})
