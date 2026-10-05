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

// Packages that pull a WebGL stack in, one renderer at a time. `three-stdlib`
// and the R3F ecosystem are reached through three's roots, so matching the roots
// is enough; a page is held to every renderer's list, not only its own.
const RENDERER_PACKAGES = [
  "three",
  "@react-three/fiber",
  "@react-three/drei",
  "pixi.js",
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
  it.each(PAGE_ENTRIES)("%s reaches no renderer statically", (entry) => {
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
          RENDERER_PACKAGES.some(
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
    // chunk.
    expect(offenders).toEqual([])
  })
})
