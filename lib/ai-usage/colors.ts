// Semantic colors for the AI usage charts and breakdown tables.
//
// Real `ai_usage` records carry model names like `deepseek-v4-flash` and
// `kimi-k2.7-code`. A single provider appears as several sibling models, so a
// flat one-color-per-provider rule makes them indistinguishable. Instead the
// provider's brand hue is kept, and each sibling model gets a stepped shade of
// that hue (a lightness ramp) so they read as the same family but stay
// tellable apart:
//
//   - any `deepseek-*` model / `DeepSeek Harness`  -> --ai-deepseek  (blue)
//   - any `kimi-*` model                           -> --ai-kimi      (purple)
//   - any `glm-*` model                            -> --ai-glm       (yellow)
//   - the `Claude Code` harness                    -> --claude-orange (orange)
//   - the `OpenCode` harness                       -> --ai-opencode   (white)
//
// Anything else (e.g. projects) falls back to the --chart-N slot at the
// caller's index, so unknown entities keep the previous positional behavior.
//
// All functions return *full CSS color expressions* (e.g. `var(--ai-deepseek)`,
// `color-mix(in srgb, var(--ai-deepseek) 70%, white)`) rather than bare
// variable names, because shade mixing cannot be wrapped in `var()`. Use the
// result directly as the `fill` / `backgroundColor` value.

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
  ];

function detectFamily(name: string): string | null {
  const normalized = normalizeName(name);
  const rule = FAMILY_KEYWORDS.find((r) => r.matches(normalized));
  return rule?.familyVar ?? null;
}

/** A stepped shade of `baseVar`: index 0 is the full-strength colour, and each
 *  later sibling is lightened toward white so it reads as a lighter tint over a
 *  dark card. (Mixing toward the background would go dark in the site's
 *  dark theme and blend away, so the ramp always lightens instead.) */
function shadeExpression(baseVar: string, index: number, total: number): string {
  // The first sibling is the pure brand colour; every later one lightens.
  if (total <= 1 || index === 0) return `var(${baseVar})`;
  const strongest = 100;
  const lightest = 55;
  const pct = strongest - (index * (strongest - lightest)) / (total - 1);
  return `color-mix(in srgb, var(${baseVar}) ${pct}%, white)`;
}

/**
 * Assign a color to every name in `names`. Known provider families are grouped
 * and shaded across their members (sorted stably, so a model keeps the same
 * shade regardless of the list's sort order); unknown names are omitted, so
 * callers can fall back to their own --chart-N positional logic.
 */
export function aiUsageColorMap(names: string[]): Map<string, string> {
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
      map.set(name, shadeExpression(familyVar, index, sorted.length));
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
