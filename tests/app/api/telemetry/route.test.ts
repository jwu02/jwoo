/**
 * @jest-environment node
 */
import { GET } from "@/app/api/telemetry/route";

jest.mock("@/lib/telemetry/db", () => ({
  getTelemetryCollection: jest.fn(),
}));

jest.mock("@/lib/telemetry/aggregation", () => ({
  fetchTotals: jest.fn(),
  fetchKeyCounts: jest.fn(),
  fetchTimeSeries: jest.fn(),
}));

import { getTelemetryCollection } from "@/lib/telemetry/db";
import { fetchTotals, fetchKeyCounts, fetchTimeSeries } from "@/lib/telemetry/aggregation";

const mockCollection = {} as never;

beforeEach(() => {
  jest.clearAllMocks();
  (getTelemetryCollection as jest.Mock).mockReturnValue(mockCollection);
});

describe("GET /api/telemetry", () => {
  it("returns telemetry data for a valid range", async () => {
    (fetchTotals as jest.Mock).mockResolvedValue({
      leftClicks: 10,
      rightClicks: 2,
      movementMeters: 1.5,
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
    expect(json).toEqual({
      totals: {
        leftClicks: 10,
        rightClicks: 2,
        movementMeters: 1.5,
        totalKeyPresses: 10,
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
