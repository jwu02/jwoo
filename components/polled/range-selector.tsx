import { Range } from "@/lib/ranges";
import { pillButtonClass, pillGroupClass } from "@/lib/ui/pill-toggle";

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
