/**
 * @jest-environment node
 */
import { GET } from "@/app/api/telemetry/route";

jest.mock("@/lib/telemetry/db", () => ({
  getTelemetryCollection: jest.fn(),
  getKeyboardHeatmapCollection: jest.fn(),
}));

jest.mock("@/lib/telemetry/aggregation", () => ({
  fetchTotals: jest.fn(),
  fetchKeyCounts: jest.fn(),
  fetchTimeSeries: jest.fn(),
}));

import { getTelemetryCollection, getKeyboardHeatmapCollection } from "@/lib/telemetry/db";
import { fetchTotals, fetchKeyCounts, fetchTimeSeries } from "@/lib/telemetry/aggregation";

const mockTelemetryCollection = {} as never;
const mockKeyboardCollection = {} as never;

beforeEach(() => {
  jest.clearAllMocks();
  (getTelemetryCollection as jest.Mock).mockReturnValue(mockTelemetryCollection);
  (getKeyboardHeatmapCollection as jest.Mock).mockReturnValue(mockKeyboardCollection);
});

describe("GET /api/telemetry", () => {
  it("returns telemetry data for a valid range", async () => {
    (fetchTotals as jest.Mock).mockResolvedValue({
      leftClicks: 10,
      rightClicks: 2,
      movementMeters: 1.5,
      totalKeyPresses: 25,
    });
    (fetchKeyCounts as jest.Mock).mockResolvedValue({ A: 3, Space: 7 });
    (fetchTimeSeries as jest.Mock).mockResolvedValue([
      {
        bucket: "2026-08-09T10:00:00.000Z",
        leftClicks: 1,
        rightClicks: 0,
        movementMeters: 0.5,
        keyPresses: 5,
      },
    ]);

    const request = new Request("http://localhost:3000/api/telemetry?range=24h");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(fetchTotals).toHaveBeenCalledWith(mockTelemetryCollection);
    expect(fetchKeyCounts).toHaveBeenCalledWith(mockKeyboardCollection);
    expect(fetchTimeSeries).toHaveBeenCalledWith(
      mockTelemetryCollection,
      "24h",
      undefined,
      "UTC"
    );
    expect(json).toEqual({
      totals: {
        leftClicks: 10,
        rightClicks: 2,
        movementMeters: 1.5,
        totalKeyPresses: 25,
      },
      keys: { A: 3, Space: 7 },
      timeSeries: [
        {
          bucket: "2026-08-09T10:00:00.000Z",
          leftClicks: 1,
          rightClicks: 0,
          movementMeters: 0.5,
          keyPresses: 5,
        },
      ],
    });
  });

  it("passes the viewer timezone to fetchTimeSeries", async () => {
    (fetchTotals as jest.Mock).mockResolvedValue({
      leftClicks: 0,
      rightClicks: 0,
      movementMeters: 0,
      totalKeyPresses: 0,
    });
    (fetchKeyCounts as jest.Mock).mockResolvedValue({});
    (fetchTimeSeries as jest.Mock).mockResolvedValue([]);

    const request = new Request(
      "http://localhost:3000/api/telemetry?range=30d&tz=Asia%2FShanghai"
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(fetchTimeSeries).toHaveBeenCalledWith(
      mockTelemetryCollection,
      "30d",
      undefined,
      "Asia/Shanghai"
    );
  });

  it("falls back to UTC for an invalid timezone", async () => {
    (fetchTotals as jest.Mock).mockResolvedValue({
      leftClicks: 0,
      rightClicks: 0,
      movementMeters: 0,
      totalKeyPresses: 0,
    });
    (fetchKeyCounts as jest.Mock).mockResolvedValue({});
    (fetchTimeSeries as jest.Mock).mockResolvedValue([]);

    const request = new Request(
      "http://localhost:3000/api/telemetry?range=30d&tz=Not%2FAZone"
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(fetchTimeSeries).toHaveBeenCalledWith(
      mockTelemetryCollection,
      "30d",
      undefined,
      "UTC"
    );
  });

  it("returns 400 for an invalid range", async () => {
    const request = new Request("http://localhost:3000/api/telemetry?range=invalid");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("returns 500 when aggregation throws", async () => {
    (fetchTotals as jest.Mock).mockRejectedValue(new Error("DB error"));
    const request = new Request("http://localhost:3000/api/telemetry?range=24h");
    const response = await GET(request);
    expect(response.status).toBe(500);
  });

  it("returns 500 when database connection is misconfigured", async () => {
    (getTelemetryCollection as jest.Mock).mockImplementation(() => {
      throw new Error("Missing MONGO_URI environment variable");
    });
    const request = new Request("http://localhost:3000/api/telemetry?range=24h");
    const response = await GET(request);
    expect(response.status).toBe(500);
  });
});
