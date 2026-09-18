import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ActivityTelemetryPage from "@/app/activity-telemetry/page";

// The three 3D and charting children are the page's layout, not its data
// contract, and each mounts a renderer this test has no business driving.
jest.mock("@/components/telemetry/keyboard-heatmap", () => ({
  KeyboardHeatmap: () => <div data-testid="keyboard-heatmap" />,
}));
jest.mock("@/components/telemetry/mouse-visual", () => ({
  MouseVisual: () => <div data-testid="mouse-visual" />,
}));
jest.mock("@/components/telemetry/activity-chart", () => ({
  ActivityChart: () => <div data-testid="activity-chart" />,
}));

const response = {
  totals: {
    leftClicks: 120,
    rightClicks: 30,
    movementMeters: 450,
    totalKeyPresses: 5400,
  },
  keys: { KeyA: 12 },
  timeSeries: [],
};

let fetchMock: jest.Mock;
const realFetch = global.fetch;

function requestedUrls(): string[] {
  return fetchMock.mock.calls.map((call) => call[0] as string);
}

beforeEach(() => {
  fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => response,
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
});

describe("ActivityTelemetryPage", () => {
  it("renders the fetched totals", async () => {
    render(<ActivityTelemetryPage />);

    expect(await screen.findByText("5,400")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("450")).toBeInTheDocument();
  });

  it("asks for the default range in the viewer's timezone", async () => {
    render(<ActivityTelemetryPage />);

    await screen.findByText("5,400");

    expect(requestedUrls()).toHaveLength(1);
    expect(requestedUrls()[0]).toContain("range=24h");
    expect(requestedUrls()[0]).toContain("tz=");
  });

  it("reports when the data on screen arrived", async () => {
    render(<ActivityTelemetryPage />);

    expect(await screen.findByText(/^Last updated:/)).toBeInTheDocument();
  });

  it("requests the chosen range when the range changes", async () => {
    render(<ActivityTelemetryPage />);
    await screen.findByText("5,400");

    fireEvent.click(screen.getByRole("button", { name: "30d" }));

    await waitFor(() => expect(requestedUrls()).toHaveLength(2));
    expect(requestedUrls()[1]).toContain("range=30d");
  });
});
