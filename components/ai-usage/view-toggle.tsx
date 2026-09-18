import { pillButtonClass, pillGroupClass } from "@/lib/ui/pill-toggle";

export type BreakdownView = "model" | "project" | "harness";

interface ViewToggleProps {
  value: BreakdownView;
  onChange: (view: BreakdownView) => void;
}

const OPTIONS: { value: BreakdownView; label: string }[] = [
  { value: "model", label: "Model" },
  { value: "project", label: "Project" },
  { value: "harness", label: "Harness" },
];

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className={pillGroupClass}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={pillButtonClass(value === option.value)}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
