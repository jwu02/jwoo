import { pillButtonClass, pillGroupClass } from "@/lib/ui/pill-toggle";

export interface RangeOption<T extends string> {
  value: T;
  label: string;
}

interface RangeSelectorProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: RangeOption<T>[];
}

/** A pill group for any small set of mutually exclusive string values —
 *  time ranges on the polling dashboards, breakdown views on AI usage. */
export function RangeSelector<T extends string>({
  value,
  onChange,
  options,
}: RangeSelectorProps<T>) {
  return (
    <div className={pillGroupClass}>
      {options.map((option) => (
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
