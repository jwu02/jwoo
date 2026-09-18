import { NextResponse } from "next/server";
import { getAiUsageCollection } from "@/lib/db";
import {
  fetchTotals,
  fetchByModel,
  fetchByProject,
  fetchByHarness,
  fetchTimeSeries,
  fetchTimeSeriesByModel,
} from "@/lib/ai-usage/aggregation";
import { isValidTimeZone } from "@/lib/timezone";
import { Range } from "@/lib/ranges";
import { Response } from "@/lib/ai-usage/types";

const VALID_RANGES: Range[] = ["24h", "30d", "1y"];

function isValidRange(value: string | null): value is Range {
  return VALID_RANGES.includes(value as Range);
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
    const aiUsageCollection = getAiUsageCollection();
    const [
      totals,
      byModel,
      byProject,
      byHarness,
      timeSeries,
      timeSeriesByModel,
    ] = await Promise.all([
      fetchTotals(aiUsageCollection),
      fetchByModel(aiUsageCollection),
      fetchByProject(aiUsageCollection),
      fetchByHarness(aiUsageCollection),
      fetchTimeSeries(aiUsageCollection, rangeParam, undefined, timeZone),
      fetchTimeSeriesByModel(aiUsageCollection, rangeParam, undefined, timeZone),
    ]);

    const response: Response = {
      totals,
      byModel,
      byProject,
      byHarness,
      timeSeries,
      timeSeriesByModel,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("AI usage API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI usage data" },
      { status: 500 }
    );
  }
}
