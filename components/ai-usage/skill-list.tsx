import { BySkill } from "@/lib/ai-usage/types";
import { topSkills } from "@/lib/ai-usage/skills";
import { formatNumber } from "@/lib/ui/chart-format";

interface SkillListProps {
  rows: BySkill[];
}

/** The one colour every bar wears. Skills are invoked across harnesses and
 *  share no provider family, so a brand hue would be a claim the data does
 *  not make; the rank is the encoding, not the colour. */
const SKILL_BAR_COLOR = "var(--chart-1)";

export function SkillList({ rows }: SkillListProps) {
  const shown = topSkills(rows);

  if (shown.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No skills invoked in this range.
      </p>
    );
  }

  // Bars are drawn against the largest row on screen.
  const most = Math.max(...shown.map((row) => row.invocations));

  return (
    <ul className="space-y-3 rounded-xl bg-card p-4">
      {shown.map((row) => (
        <li key={row.skill}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{row.skill}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatNumber(row.invocations)}
            </span>
          </div>
          {/* Decoration: the row above carries the skill's name and its count
              as text, so nothing here is load-bearing for a screen reader. */}
          <div className="mt-1 h-1.5 w-full rounded-sm bg-muted" aria-hidden>
            <div
              data-skill-bar={row.skill}
              className="h-full rounded-sm"
              style={{
                width: `${(row.invocations / most) * 100}%`,
                backgroundColor: SKILL_BAR_COLOR,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
