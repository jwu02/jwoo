// The wire types of the AI-usage dashboard. The module names the feature, so
// the types inside it do not repeat it.

export interface Totals {
  costYuan: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  // Null means no record carries the field, so the total is unknown rather
  // than zero; records predating the field will never carry it.
  toolCalls: number | null;
  skillInvocations: number | null;
}

export interface ByModel {
  model: string;
  costYuan: number;
  totalTokens: number;
}

export interface ByProject {
  project: string;
  costYuan: number;
  totalTokens: number;
}

export interface ByHarness {
  harness: string;
  costYuan: number;
  totalTokens: number;
}

/** One skill's count over the range. The metric is invocations and nothing
 *  else: a record's cost is the record's, and it can list several skills, so a
 *  per-skill cost would either double-count or be an invented split. */
export interface BySkill {
  skill: string;
  invocations: number;
}

interface ModelTimeSeriesPoint {
  bucket: string; // ISO date string
  costYuan: number;
  totalTokens: number;
}

export interface ModelTimeSeries {
  model: string;
  points: ModelTimeSeriesPoint[];
}

export interface Response {
  totals: Totals;
  byModel: ByModel[];
  byProject: ByProject[];
  byHarness: ByHarness[];
  bySkill: BySkill[];
  timeSeriesByModel: ModelTimeSeries[];
}
