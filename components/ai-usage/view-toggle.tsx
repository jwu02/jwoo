import { RangeOption } from "@/components/polled/range-selector";

/** The three ways the usage breakdown can be grouped. */
export type BreakdownView = "model" | "project" | "harness";

/** The views, in display order, for the shared pill group. */
export const VIEW_OPTIONS: RangeOption<BreakdownView>[] = [
  { value: "model", label: "Model" },
  { value: "project", label: "Project" },
  { value: "harness", label: "Harness" },
];
