/**
 * @jest-environment node
 */
import { GET } from "@/app/api/ai-usage/route";

jest.mock("@/lib/telemetry/db", () => ({
  getAiUsageCollection: jest.fn(),
}));

jest.mock("@/lib/telemetry/aggregation", () => ({
  fetchAiUsageTotals: jest.fn(),
  fetchAiUsageByModel: jest.fn(),
  fetchAiUsageByProject: jest.fn(),
  fetchAiUsageByHarness: jest.fn(),
  fetchAiUsageTimeSeries: jest.fn(),
  fetchAiUsageTimeSeriesByModel: jest.fn(),
}));

import { getAiUsageCollection } from "@/lib/telemetry/db";
import {
  fetchAiUsageTotals,
  fetchAiUsageByModel,
  fetchAiUsageByProject,
  fetchAiUsageByHarness,
  fetchAiUsageTimeSeries,
  fetchAiUsageTimeSeriesByModel,
} from "@/lib/telemetry/aggregation";

const mockAiUsageCollection = {} as never;

beforeEach(() => {
  jest.clearAllMocks();
  (getAiUsageCollection as jest.Mock).mockReturnValue(mockAiUsageCollection);
});

describe("GET /api/ai-usage", () => {
  it("returns ai usage data for a valid range", async () => {
    (fetchAiUsageTotals as jest.Mock).mockResolvedValue({
      costYuan: 0.5,
      totalTokens: 100,
      promptTokens: 90,
      completionTokens: 10,
      cacheHitTokens: 60,
      cacheMissTokens: 40,
      requests: 1,
    });
    (fetchAiUsageByModel as jest.Mock).mockResolvedValue([
      { model: "deepseek-v4-flash", costYuan: 0.5, totalTokens: 100, requests: 1 },
    ]);
    (fetchAiUsageByProject as jest.Mock).mockResolvedValue([
      {
        project: "work",
        costYuan: 0.5,
        totalTokens: 100,
        requests: 1,
      },
    ]);
    (fetchAiUsageByHarness as jest.Mock).mockResolvedValue([
      {
        harness: "claude-code",
        costYuan: 0.5,
        totalTokens: 100,
        requests: 1,
      },
    ]);
    (fetchAiUsageTimeSeries as jest.Mock).mockResolvedValue([
      {
        bucket: "2026-08-18T10:00:00.000Z",
        costYuan: 0.25,
        promptTokens: 1000,
        completionTokens: 200,
        totalTokens: 1200,
      },
    ]);
    (fetchAiUsageTimeSeriesByModel as jest.Mock).mockResolvedValue([
      {
        model: "deepseek-v4-flash",
        points: [
          {
            bucket: "2026-08-18T10:00:00.000Z",
            costYuan: 0.25,
            totalTokens: 1200,
          },
        ],
      },
    ]);

    const request = new Request("http://localhost:3000/api/ai-usage?range=24h");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(fetchAiUsageTotals).toHaveBeenCalledWith(mockAiUsageCollection);
    expect(fetchAiUsageByModel).toHaveBeenCalledWith(mockAiUsageCollection);
    expect(fetchAiUsageByProject).toHaveBeenCalledWith(mockAiUsageCollection);
    expect(fetchAiUsageByHarness).toHaveBeenCalledWith(mockAiUsageCollection);
    expect(fetchAiUsageTimeSeries).toHaveBeenCalledWith(
      mockAiUsageCollection,
      "24h"
    );
    expect(fetchAiUsageTimeSeriesByModel).toHaveBeenCalledWith(
      mockAiUsageCollection,
      "24h"
    );
    expect(json).toEqual({
      totals: {
        costYuan: 0.5,
        totalTokens: 100,
        promptTokens: 90,
        completionTokens: 10,
        cacheHitTokens: 60,
        cacheMissTokens: 40,
        requests: 1,
      },
      byModel: [
        { model: "deepseek-v4-flash", costYuan: 0.5, totalTokens: 100, requests: 1 },
      ],
      byProject: [
        {
          project: "work",
          costYuan: 0.5,
          totalTokens: 100,
          requests: 1,
        },
      ],
      byHarness: [
        {
          harness: "claude-code",
          costYuan: 0.5,
          totalTokens: 100,
          requests: 1,
        },
      ],
      timeSeries: [
        {
          bucket: "2026-08-18T10:00:00.000Z",
          costYuan: 0.25,
          promptTokens: 1000,
          completionTokens: 200,
          totalTokens: 1200,
        },
      ],
      timeSeriesByModel: [
        {
          model: "deepseek-v4-flash",
          points: [
            {
              bucket: "2026-08-18T10:00:00.000Z",
              costYuan: 0.25,
              totalTokens: 1200,
            },
          ],
        },
      ],
    });
  });

  it("accepts the 30d range", async () => {
    (fetchAiUsageTotals as jest.Mock).mockResolvedValue({
      costYuan: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      cacheHitTokens: 0,
      cacheMissTokens: 0,
      requests: 0,
    });
    (fetchAiUsageByModel as jest.Mock).mockResolvedValue([]);
    (fetchAiUsageByProject as jest.Mock).mockResolvedValue([]);
    (fetchAiUsageByHarness as jest.Mock).mockResolvedValue([]);
    (fetchAiUsageTimeSeries as jest.Mock).mockResolvedValue([]);
    (fetchAiUsageTimeSeriesByModel as jest.Mock).mockResolvedValue([]);

    const request = new Request("http://localhost:3000/api/ai-usage?range=30d");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(fetchAiUsageTimeSeries).toHaveBeenCalledWith(
      mockAiUsageCollection,
      "30d"
    );
  });

  it("returns 400 for the removed 7d range", async () => {
    const request = new Request("http://localhost:3000/api/ai-usage?range=7d");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid range", async () => {
    const request = new Request("http://localhost:3000/api/ai-usage?range=invalid");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("returns 500 when aggregation throws", async () => {
    (fetchAiUsageTotals as jest.Mock).mockRejectedValue(new Error("DB error"));
    const request = new Request("http://localhost:3000/api/ai-usage?range=24h");
    const response = await GET(request);
    expect(response.status).toBe(500);
  });

  it("returns 500 when database connection is misconfigured", async () => {
    (getAiUsageCollection as jest.Mock).mockImplementation(() => {
      throw new Error("Missing MONGO_URI environment variable");
    });
    const request = new Request("http://localhost:3000/api/ai-usage?range=24h");
    const response = await GET(request);
    expect(response.status).toBe(500);
  });
});
