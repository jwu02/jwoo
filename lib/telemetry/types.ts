export type TelemetryRange = "24h" | "7d" | "30d" | "1y";

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
