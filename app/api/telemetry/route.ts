import { NextResponse } from "next/server";
import { getTelemetryCollection, getKeyboardHeatmapCollection } from "@/lib/telemetry/db";
import {
  fetchTotals,
  fetchKeyCounts,
  fetchTimeSeries,
} from "@/lib/telemetry/aggregation";
import { isValidTimeZone } from "@/lib/telemetry/timezone";
import { TelemetryRange, TelemetryResponse } from "@/lib/telemetry/types";

const VALID_RANGES: TelemetryRange[] = ["24h", "30d", "1y"];

function isValidRange(value: string | null): value is TelemetryRange {
  return VALID_RANGES.includes(value as TelemetryRange);
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const rangeParam = searchParams.get("range");
  // Bucket time series by the viewer's timezone so local days align with the
  // labels (which the browser already renders in local time).
  const timeZoneParam = searchParams.get("tz");
  const timeZone = isValidTimeZone(timeZoneParam) ? timeZoneParam : "UTC";

  if (!isValidRange(rangeParam)) {
    return NextResponse.json(
      { error: `Invalid range. Must be one of: ${VALID_RANGES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const telemetryCollection = getTelemetryCollection();
    const keyboardCollection = getKeyboardHeatmapCollection();
    const [totals, keys, timeSeries] = await Promise.all([
      fetchTotals(telemetryCollection),
      fetchKeyCounts(keyboardCollection),
      fetchTimeSeries(telemetryCollection, rangeParam, undefined, timeZone),
    ]);

    const response: TelemetryResponse = {
      totals,
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
