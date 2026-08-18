import { NextResponse } from "next/server";
import { getAiUsageCollection } from "@/lib/telemetry/db";
import {
  fetchAiUsageTotals,
  fetchAiUsageByModel,
  fetchAiUsageTimeSeries,
  fetchAiUsageTimeSeriesByModel,
} from "@/lib/telemetry/aggregation";
import { AiUsageRange, AiUsageResponse } from "@/lib/telemetry/types";

const VALID_RANGES: AiUsageRange[] = ["24h", "30d", "1y"];

function isValidRange(value: string | null): value is AiUsageRange {
  return VALID_RANGES.includes(value as AiUsageRange);
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
    const aiUsageCollection = getAiUsageCollection();
    const [totals, byModel, timeSeries, timeSeriesByModel] = await Promise.all([
      fetchAiUsageTotals(aiUsageCollection),
      fetchAiUsageByModel(aiUsageCollection),
      fetchAiUsageTimeSeries(aiUsageCollection, rangeParam),
      fetchAiUsageTimeSeriesByModel(aiUsageCollection, rangeParam),
    ]);

    const response: AiUsageResponse = {
      totals,
      byModel,
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
