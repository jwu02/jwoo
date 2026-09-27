// The wire types of the AI-usage dashboard. The module names the feature, so
// the types inside it do not repeat it.

export interface Totals {
  costYuan: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
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
  timeSeriesByModel: ModelTimeSeries[];
}
