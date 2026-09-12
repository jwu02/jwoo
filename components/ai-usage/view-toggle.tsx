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
    <div className="inline-flex rounded-full border border-border bg-card p-1">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`cursor-pointer rounded-full px-3 py-1 text-sm font-medium outline-none transition-colors ${
            value === option.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
