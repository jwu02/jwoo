import { AiUsageRange, Range, TelemetryRange } from "@/lib/telemetry/types";

export interface RangeOption<T extends Range> {
  value: T;
  label: string;
}

export const TELEMETRY_RANGE_OPTIONS: RangeOption<TelemetryRange>[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "1y", label: "1y" },
];

export const AI_USAGE_RANGE_OPTIONS: RangeOption<AiUsageRange>[] = [
  { value: "24h", label: "24h" },
  { value: "30d", label: "30d" },
  { value: "1y", label: "1y" },
];

interface RangeSelectorProps<T extends Range> {
  value: T;
  onChange: (range: T) => void;
  options: RangeOption<T>[];
}

export function RangeSelector<T extends Range>({
  value,
  onChange,
  options,
}: RangeSelectorProps<T>) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3 py-1 text-sm font-medium outline-none transition-colors ${
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
