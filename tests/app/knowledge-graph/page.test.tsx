import { act, render, screen, waitFor } from "@testing-library/react";
import KnowledgeGraphPage from "@/app/knowledge-graph/page";

// This page owns the fetch, the countdown and the layout; the Pixi graph
// underneath has its own tests. Stubbing it keeps these tests off the canvas
// and out of the render loop — the countdown tests drive several seconds of
// animation frames apiece, and running a real graph through them is both slow
// and enough load to disturb the timing-sensitive force-graph tests running in
// a parallel worker.
// Counts renders so the countdown tests can assert that a tick which does not
// change the displayed minute leaves the graph alone.
const mockGraphRenders = { count: 0 };

jest.mock("@/components/knowledge-graph/force-graph", () => ({
  ForceGraph: ({ nodes, edges }: { nodes: unknown[]; edges: unknown[] }) => {
    mockGraphRenders.count += 1;
    return (
      <div
        data-testid="kg-graph"
        data-nodes={nodes.length}
        data-edges={edges.length}
      />
    );
  },
}));

const mockData = {
  nodes: [
    { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
    { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
  ],
  edges: [{ source: "A.md", target: "B.md" }],
};

function fetchMock(data: unknown) {
  return jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
  ) as jest.Mock;
}

// The jsdom test environment does not provide `fetch`, so default to a mock
// that returns `mockData`. Individual tests override `global.fetch` as needed
// and `afterEach` restores this default.
global.fetch = fetchMock(mockData);

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});

describe("KnowledgeGraphPage", () => {
  it("fetches and renders the graph", async () => {
    render(<KnowledgeGraphPage />);

    // The loaded branch mounts the graph (loading/error/empty branches do not,
    // so this distinguishes loaded from everything else).
    await waitFor(() => {
      expect(screen.getByTestId("kg-graph")).toBeInTheDocument();
    });

    expect(screen.getByTestId("kg-graph")).toHaveAttribute("data-nodes", "2");
    expect(global.fetch).toHaveBeenCalledWith("/api/knowledge-graph");
  });

  it("shows a loading state initially", () => {
    render(<KnowledgeGraphPage />);
    expect(screen.getByText(/Loading knowledge graph/i)).toBeInTheDocument();
  });

  it("renders an empty state when there are no notes", async () => {
    global.fetch = fetchMock({ nodes: [], edges: [] });

    render(<KnowledgeGraphPage />);

    await waitFor(() => {
      expect(screen.getByText("No notes synced yet.")).toBeInTheDocument();
    });
  });

  it("shows an error banner when the fetch fails", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    ) as jest.Mock;

    render(<KnowledgeGraphPage />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load knowledge graph")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("renders a single-node graph without NaN", async () => {
    global.fetch = fetchMock({
      nodes: [{ id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" }],
      edges: [],
    });

    render(<KnowledgeGraphPage />);

    await waitFor(() => {
      expect(screen.getByTestId("kg-graph")).toBeInTheDocument();
    });
    expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
  });
});

describe("KnowledgeGraphPage cache countdown", () => {
  const NOW = new Date("2026-09-14T06:32:00.000Z");

  // Counts down from 30 minutes; every test here starts from the same instant
  // so the tick it asserts on is deterministic.
  const payloadWithCache = {
    ...mockData,
    cachedAt: "2026-09-14T06:02:00.000Z",
    remainingSeconds: 30 * 60,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    // A frozen `now` is also the fetch url's clock: the page anchors the
    // countdown on Date.now() when the payload lands, so the system time and
    // the mock must agree or the first tick reads as elapsed time.
    jest.setSystemTime(NOW);
  });

  // The mount effect defers its fetch to a 0ms timeout.
  async function flush(milliseconds = 0) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(milliseconds);
    });
  }

  it("reports when the snapshot was cached and how long it has left", async () => {
    global.fetch = fetchMock(payloadWithCache);

    render(<KnowledgeGraphPage />);
    await flush();

    expect(screen.getByTestId("kg-cache-status")).toBeInTheDocument();
    expect(screen.getByText("Server-side Cache")).toBeInTheDocument();
    expect(screen.getByText("Expires in 30 min")).toBeInTheDocument();
    expect(screen.getByText(/Last updated /)).toBeInTheDocument();
  });

  it("holds the displayed minute until it has been spent", async () => {
    global.fetch = fetchMock(payloadWithCache);

    render(<KnowledgeGraphPage />);
    await flush();

    // A second in, the badge still reads the minute it started on.
    await flush(1000);
    expect(screen.getByText("Expires in 30 min")).toBeInTheDocument();

    await flush(59 * 1000);
    expect(screen.getByText("Expires in 29 min")).toBeInTheDocument();
  });

  // The tick is on the second so expiry is noticed promptly, but the badge
  // reads to the minute: re-rendering on every tick would reconcile every node
  // label in the graph sixty times per visible change.
  it("leaves the graph alone while the displayed minute holds", async () => {
    global.fetch = fetchMock(payloadWithCache);

    render(<KnowledgeGraphPage />);
    await flush();
    const renders = mockGraphRenders.count;

    await flush(30 * 1000);
    expect(mockGraphRenders.count).toBe(renders);

    // ...and catches up in one render once that minute is spent.
    await flush(30 * 1000);
    expect(mockGraphRenders.count).toBe(renders + 1);
  });

  it("refetches once the countdown runs out", async () => {
    global.fetch = fetchMock({ ...mockData, cachedAt: NOW.toISOString(), remainingSeconds: 2 });

    render(<KnowledgeGraphPage />);
    await flush();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await flush(3000);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // A snapshot that expires while the tab is hidden comes back to a clock that
  // jumped: the refresh is already overdue and should fire on the next tick.
  it("refetches when a skipped interval leaves the countdown overdue", async () => {
    global.fetch = fetchMock(payloadWithCache);

    render(<KnowledgeGraphPage />);
    await flush();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Stands in for a thrown-away interval: wall-clock time moves on without
    // any tick firing in between.
    jest.setSystemTime(new Date(NOW.getTime() + 45 * 60 * 1000));
    await flush(1000);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // The countdown is past zero on every tick that follows, so an unguarded
  // refresh would re-request once a second for as long as the tab stayed open.
  it("does not retry a failed refresh on every tick", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockData, cachedAt: NOW.toISOString(), remainingSeconds: 1 }),
      })
      .mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });

    render(<KnowledgeGraphPage />);
    await flush();
    await flush(2000);
    expect(global.fetch).toHaveBeenCalledTimes(2);

    await flush(5000);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // A failed refresh leaves the snapshot in place, so the countdown has to be
  // able to arrive at its own zero — otherwise the badge sits on "<1 min"
  // indefinitely, reading as a countdown that never lands.
  it("counts down to zero even when the refresh fails", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ ...mockData, cachedAt: NOW.toISOString(), remainingSeconds: 45 }),
      })
      .mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });

    render(<KnowledgeGraphPage />);
    await flush();
    expect(screen.getByText("Expires in <1 min")).toBeInTheDocument();

    await flush(45 * 1000);

    expect(screen.getByText("Expires in 0 min")).toBeInTheDocument();
  });

  it("keeps the graph on screen when the refresh fails", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockData, cachedAt: NOW.toISOString(), remainingSeconds: 1 }),
      })
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) });

    render(<KnowledgeGraphPage />);
    await flush();
    await flush(2000);

    // The stale graph is worth more than an empty page, so the failure is
    // reported beside it rather than in place of it.
    expect(screen.getByTestId("kg-graph")).toBeInTheDocument();
    expect(
      screen.getByText("Failed to load knowledge graph")
    ).toBeInTheDocument();
  });

  // An older server, or a cached response from before the fields existed,
  // leaves nothing to count down — the graph should render without the badge
  // rather than counting from NaN.
  it("renders no badge when the payload carries no cache info", async () => {
    global.fetch = fetchMock(mockData);

    render(<KnowledgeGraphPage />);
    await flush();

    expect(screen.getByTestId("kg-graph")).toBeInTheDocument();
    expect(screen.queryByTestId("kg-cache-status")).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});
