import { Range } from "@/lib/ranges";

/** The ranges this dashboard offers, in selector order. */
export const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "30d", label: "30d" },
  { value: "1y", label: "1y" },
];
