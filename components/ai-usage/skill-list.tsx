import { BySkill } from "@/lib/ai-usage/types";
import { foldSkillTail } from "@/lib/ai-usage/skills";
import { OTHERS_SEGMENT } from "@/lib/ai-usage/breakdown";
import { AI_USAGE_OTHERS_COLOR } from "@/lib/ai-usage/colors";
import { formatNumber } from "@/lib/ui/chart-format";

interface SkillListProps {
  rows: BySkill[];
}

/** The one colour every named skill's bar wears. Skills are invoked across
 *  harnesses and share no provider family, so a brand hue would be a claim the
 *  data does not make; the rank is the encoding, not the colour. */
const SKILL_BAR_COLOR = "var(--chart-1)";

export function SkillList({ rows }: SkillListProps) {
  const folded = foldSkillTail(rows);

  if (folded.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No skills invoked in this range.
      </p>
    );
  }

  // Bars are drawn against the largest row on screen, which is not necessarily
  // the first: the folded `Others` row can outweigh the smallest named rows.
  const most = Math.max(...folded.map((row) => row.invocations));

  return (
    <ul className="space-y-3 rounded-xl bg-card p-4">
      {folded.map((row) => (
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
                // The combined row wears the same neutral as the donuts'
                // `Others`: it is not a skill, and must not read as one.
                backgroundColor:
                  row.skill === OTHERS_SEGMENT
                    ? AI_USAGE_OTHERS_COLOR
                    : SKILL_BAR_COLOR,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
