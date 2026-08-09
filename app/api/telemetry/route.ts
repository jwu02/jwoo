import { NextResponse } from "next/server";
import { getTelemetryCollection } from "@/lib/telemetry/db";
import {
  fetchTotals,
  fetchKeyCounts,
  fetchTimeSeries,
} from "@/lib/telemetry/aggregation";
import { TelemetryRange, TelemetryResponse } from "@/lib/telemetry/types";

const VALID_RANGES: TelemetryRange[] = ["24h", "7d", "30d", "1y"];

function isValidRange(value: string | null): value is TelemetryRange {
  return VALID_RANGES.includes(value as TelemetryRange);
}

function sumKeyCounts(keys: Record<string, number>): number {
  return Object.values(keys).reduce((sum, count) => sum + count, 0);
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const rangeParam = searchParams.get("range");

  if (!isValidRange(rangeParam)) {
    return NextResponse.json(
      { error: `Invalid range. Must be one of: ${VALID_RANGES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const collection = getTelemetryCollection();
    const [totals, keys, timeSeries] = await Promise.all([
      fetchTotals(collection),
      fetchKeyCounts(collection),
      fetchTimeSeries(collection, rangeParam),
    ]);

    const response: TelemetryResponse = {
      totals: {
        ...totals,
        totalKeyPresses: sumKeyCounts(keys),
      },
      keys,
      timeSeries,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Telemetry API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch telemetry data" },
      { status: 500 }
    );
  }
}
