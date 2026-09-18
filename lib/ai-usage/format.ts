import { formatCompactNumber } from "@/lib/ui/chart-format";

// Every token count on this dashboard — tooltip rows and the breakdown table's
// Total Tokens column — reads at a fixed one decimal. The generic compact
// formatter trims the fraction instead ("2M", "550K"), which makes a whole
// count read as a different kind of number from the "2.5M" beside it and leaves
// a column of counts ragged.
export function formatTokens(value: number): string {
  return formatCompactNumber(value, 1);
}
