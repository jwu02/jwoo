// Semantic colors for the AI usage charts and breakdowns.
//
// Real `ai_usage` records carry model names like `deepseek-v4-flash` and
// `kimi-k2.7-code`. A single provider appears as several sibling models, so a
// flat one-color-per-provider rule makes them indistinguishable. Instead the
// provider's brand hue is kept, and each sibling model gets a stepped shade of
// that hue (a lightness ramp) so they read as the same family but stay
// tellable apart. The direction of that ramp follows the appearance: later
// siblings lighten toward white over a dark card and darken toward black over a
// light one, so they stay distinguishable in either.
//
//   - any `deepseek-*` model / `DeepSeek Harness`  -> --ai-deepseek  (blue)
//   - any `kimi-*` model                           -> --ai-kimi      (purple)
//   - any `glm-*` model                            -> --ai-glm       (yellow)
//   - the `Claude Code` harness                    -> --claude-orange (orange)
//   - the `OpenCode` harness                       -> --ai-opencode   (white)
//   - the `Pi` harness                             -> --ai-pi        (steel blue)
//
// Anything else (e.g. projects) falls back to the --chart-N slot at the
// caller's index, so unknown entities keep the previous positional behavior.
//
// All functions return *full CSS color expressions* (e.g. `var(--ai-deepseek)`,
// `color-mix(in srgb, var(--ai-deepseek) 70%, white)`) rather than bare
// variable names, because shade mixing cannot be wrapped in `var()`. Use the
// result directly as the `fill` / `backgroundColor` value.

import type { Appearance } from "@/lib/appearance"

/** Lowercase and collapse every separator run (whitespace, -, _, ., /) into a
 *  single space so "deepseek-v4-flash", "Claude Code" and "open-code" all
 *  match their keyword cleanly. */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[\s\-_./]+/g, " ");
}

const FAMILY_KEYWORDS: { familyVar: string; matches: (n: string) => boolean }[] =
  [
    { familyVar: "--ai-deepseek", matches: (n) => n.includes("deepseek") },
    { familyVar: "--ai-kimi", matches: (n) => n.includes("kimi") },
    { familyVar: "--ai-glm", matches: (n) => n.includes("glm") },
    { familyVar: "--claude-orange", matches: (n) => n.includes("claude") },
    {
      familyVar: "--ai-opencode",
      matches: (n) => n.includes("opencode") || n.includes("open code"),
    },
    // Exact match: "pi" as a substring would also catch "pipeline", "api", …
    { familyVar: "--ai-pi", matches: (n) => n === "pi" },
  ];

function detectFamily(name: string): string | null {
  const normalized = normalizeName(name);
  const rule = FAMILY_KEYWORDS.find((r) => r.matches(normalized));
  return rule?.familyVar ?? null;
}

/** A stepped shade of `baseVar`: index 0 is the full-strength colour, and each
 *  later sibling steps away from it toward the appearance's own extreme — white
 *  over a dark card, black over a light one — so the siblings stay
 *  distinguishable instead of mixing into the card behind them. */
function shadeExpression(
  baseVar: string,
  index: number,
  total: number,
  appearance: Appearance,
): string {
  // The first sibling is the pure brand colour; every later one takes more of
  // the mix colour.
  if (total <= 1 || index === 0) return `var(${baseVar})`;
  const strongest = 100;
  const weaklyShaded = 55;
  const pct = strongest - (index * (strongest - weaklyShaded)) / (total - 1);
  const mix = appearance === "dark" ? "white" : "black";
  return `color-mix(in srgb, var(${baseVar}) ${pct}%, ${mix})`;
}

/**
 * The combined `Others` segment is not a category, so it wears no brand hue and
 * no `--chart-N` slot: a neutral grey is the one colour that reads as "no
 * identity of its own". A reader must never mistake it for a model or project.
 */
export const AI_USAGE_OTHERS_COLOR = "var(--muted-foreground)";

/**
 * Assign a color to every name in `names`, in the given appearance. Known
 * provider families are grouped and shaded across their members (sorted stably,
 * so a model keeps the same shade regardless of the list's sort order); unknown
 * names are omitted, so callers can fall back to their own --chart-N positional
 * logic.
 */
export function aiUsageColorMap(
  names: string[],
  appearance: Appearance,
): Map<string, string> {
  const groups = new Map<string, { familyVar: string; members: string[] }>();

  for (const name of names) {
    const familyVar = detectFamily(name);
    if (!familyVar) continue;
    const group = groups.get(familyVar) ?? { familyVar, members: [] };
    group.members.push(name);
    groups.set(familyVar, group);
  }

  const map = new Map<string, string>();
  for (const { familyVar, members } of groups.values()) {
    const sorted = [...members].sort((a, b) => a.localeCompare(b));
    sorted.forEach((name, index) => {
      map.set(name, shadeExpression(familyVar, index, sorted.length, appearance));
    });
  }
  return map;
}

/**
 * The unshaded (full-strength) color for a single entity. Used where a family
 * only shows one member, or for the base name; siblings should be colored via
 * {@link aiUsageColorMap} instead so they get distinct shades.
 *
 * @param name           The model / harness / project label.
 * @param fallbackIndex  Position used for the --chart-N fallback.
 */
export function aiUsageColorVar(name: string, fallbackIndex: number): string {
  const familyVar = detectFamily(name);
  if (familyVar) return `var(${familyVar})`;
  return `var(--chart-${(fallbackIndex % 5) + 1})`;
}
