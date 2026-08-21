export type TelemetryRange = "24h" | "30d" | "1y";
export type AiUsageRange = "24h" | "30d" | "1y";
export type Range = TelemetryRange | AiUsageRange;

export interface TelemetryTotals {
  leftClicks: number;
  rightClicks: number;
  movementMeters: number;
  totalKeyPresses: number;
}

export interface KeyCounts {
  [label: string]: number;
}

export interface TimeSeriesPoint {
  bucket: string; // ISO date string
  leftClicks: number;
  rightClicks: number;
  movementMeters: number;
  keyPresses: number;
}

export interface TelemetryResponse {
  totals: TelemetryTotals;
  keys: KeyCounts;
  timeSeries: TimeSeriesPoint[];
}

export interface AiUsageTotals {
  costYuan: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  requests: number;
}

export interface AiUsageByModel {
  model: string;
  costYuan: number;
  totalTokens: number;
  requests: number;
}

export interface AiUsageByProject {
  project: string;
  costYuan: number;
  totalTokens: number;
  requests: number;
}

export interface AiUsageByHarness {
  harness: string;
  costYuan: number;
  totalTokens: number;
  requests: number;
}

export interface AiUsageTimeSeriesPoint {
  bucket: string; // ISO date string
  costYuan: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiUsageModelTimeSeriesPoint {
  bucket: string; // ISO date string
  costYuan: number;
  totalTokens: number;
}

export interface AiUsageModelTimeSeries {
  model: string;
  points: AiUsageModelTimeSeriesPoint[];
}

export interface AiUsageResponse {
  totals: AiUsageTotals;
  byModel: AiUsageByModel[];
  byProject: AiUsageByProject[];
  byHarness: AiUsageByHarness[];
  timeSeries: AiUsageTimeSeriesPoint[];
  timeSeriesByModel: AiUsageModelTimeSeries[];
}
