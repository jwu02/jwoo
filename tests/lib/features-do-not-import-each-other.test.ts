import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

// Guards the boundary this refactor exists to create: the two dashboards' libs
// are siblings, not layers. Whatever they genuinely share — the Mongo client,
// range mechanics, and the timezone alignment both pipelines stand on — sits at
// the lib root, where either may reach it and neither owns it. CONTEXT.md puts
// the same rule on the features themselves: "share infrastructure, never domain
// logic".
//
// The scan is flat — each feature's own files, no transitive walk. A crossing
// reachable only through shared infrastructure is not a crossing; reaching it
// means going down to the root, which is the move this test is asking for.

const ROOT = resolve(__dirname, "../..")

const FEATURE_LIBS = ["lib/telemetry", "lib/ai-usage"]

const CROSSINGS = [
  ["lib/telemetry", "lib/ai-usage"],
  ["lib/ai-usage", "lib/telemetry"],
]

/** Every module under a directory, at any depth. */
function modulesUnder(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) return modulesUnder(path)
    return entry.name.endsWith(".ts") ? [path] : []
  })
}

/**
 * Import specifiers as written, type-only ones included: a type crossing is the
 * coupling this refactor was about — the redundant range alias that collapsed
 * was exactly that. Nothing here is erased at build time, so unlike the
 * eager-graph guard nothing is filtered out.
 */
function importedSpecifiers(source: string): string[] {
  const specifiers: string[] = []
  const pattern = /^\s*import\s+(?:[^"']*?from\s+)?["']([^"']+)["']/gm
  for (const match of source.matchAll(pattern)) specifiers.push(match[1])
  return specifiers
}

/** Whether a specifier names the other feature's lib, by alias or by relative path. */
function reaches(fromFile: string, specifier: string, other: string): boolean {
  if (specifier === `@/${other}` || specifier.startsWith(`@/${other}/`)) return true
  // A relative hop would otherwise slip past the alias check.
  if (!specifier.startsWith(".")) return false
  const target = resolve(ROOT, dirname(fromFile), specifier)
  return target === join(ROOT, other) || target.startsWith(`${join(ROOT, other)}/`)
}

describe("feature lib module graph", () => {
  // Without this, deleting a feature's lib would leave the crossing tests below
  // vacuously green.
  it.each(FEATURE_LIBS)("%s exists and has modules to scan", (dir) => {
    expect(existsSync(join(ROOT, dir))).toBe(true)
    expect(modulesUnder(dir).length).toBeGreaterThan(0)
  })

  it.each(CROSSINGS)("%s imports nothing from %s", (dir, other) => {
    const offenders = modulesUnder(dir).flatMap((file) =>
      importedSpecifiers(readFileSync(join(ROOT, file), "utf8"))
        .filter((specifier) => reaches(file, specifier, other))
        .map((specifier) => `${file} imports "${specifier}"`)
    )

    expect(offenders).toEqual([])
  })
})
