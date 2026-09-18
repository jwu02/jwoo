import { Range } from "@/lib/ranges";

export interface RangeOption<T extends Range> {
  value: T;
  label: string;
}

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
    <div className="inline-flex rounded-full border border-border bg-card p-1">
      {options.map((option) => (
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
