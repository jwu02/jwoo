import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import {
  fetchTotals,
  fetchKeyCounts,
  fetchTimeSeries,
} from "@/lib/telemetry/aggregation";
import { isValidTimeZone } from "@/lib/timezone";
import { isValidRange, RANGE_NAMES } from "@/lib/ranges";
import { TelemetryResponse } from "@/lib/telemetry/types";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const rangeParam = searchParams.get("range");
  // Bucket time series by the viewer's timezone so local days align with the
  // labels (which the browser already renders in local time).
  const timeZoneParam = searchParams.get("tz");
  const timeZone = isValidTimeZone(timeZoneParam) ? timeZoneParam : "UTC";

  if (!isValidRange(rangeParam)) {
    return NextResponse.json(
      {
        error: `Invalid range. Must be one of: ${RANGE_NAMES}`,
      },
      { status: 400 }
    );
  }

  try {
    const telemetryCollection = getCollection("telemetry");
    const keyboardCollection = getCollection("keyboard_heatmap");
    const [totals, keys, timeSeries] = await Promise.all([
      // The totals follow the range; the key counts deliberately do not (ADR
      // 0008 — the heatmap is the page's one lifetime panel).
      fetchTotals(telemetryCollection, rangeParam),
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
