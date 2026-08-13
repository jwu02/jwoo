import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import KnowledgeGraphPage from "@/app/knowledge-graph/page";

const PLAYBACK_DURATION_MS = 30_000;

const mockData = {
  nodes: [
    { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
    { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
  ],
  edges: [{ source: "A.md", target: "B.md" }],
};

// Two-day span (Jan 1 -> Jan 3) so the midpoint lands on a distinct day.
const twoDayData = {
  nodes: [
    { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
    { id: "B.md", createdAt: "2024-01-03T00:00:00.000Z" },
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
const originalRaf = global.requestAnimationFrame;
const originalCaf = global.cancelAnimationFrame;

afterEach(() => {
  global.fetch = originalFetch;
  global.requestAnimationFrame = originalRaf;
  global.cancelAnimationFrame = originalCaf;
});

/**
 * Replace requestAnimationFrame with a controllable mock so the playback
 * timeline can be advanced deterministically frame by frame.
 */
function mockRaf() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 0;

  const raf = jest.fn((cb: FrameRequestCallback) => {
    callbacks.set(++nextId, cb);
    return nextId;
  });
  const caf = jest.fn((id: number) => {
    callbacks.delete(id);
  });

  global.requestAnimationFrame = raf as unknown as typeof requestAnimationFrame;
  global.cancelAnimationFrame = caf as unknown as typeof cancelAnimationFrame;

  return {
    raf,
    caf,
    frame(time: number) {
      const pending = [...callbacks.values()];
      callbacks.clear();
      for (const cb of pending) cb(time);
    },
  };
}

describe("KnowledgeGraphPage", () => {
  it("fetches and renders the graph", async () => {
    render(<KnowledgeGraphPage />);

    await waitFor(() => {
      // Unique to the loaded branch: PlaybackControls renders a Pause button
      // while the timeline auto-plays (the h1 "Knowledge Graph" appears in
      // every branch, so it cannot distinguish loaded from loading/error).
      expect(
        screen.getByRole("button", { name: /pause/i })
      ).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/knowledge-graph");
  });

  it("shows a loading state initially", () => {
    render(<KnowledgeGraphPage />);
    expect(screen.getByText(/Loading knowledge graph/i)).toBeInTheDocument();
  });

  it("does not produce NaN for a single-node graph", async () => {
    global.fetch = fetchMock({
      nodes: [{ id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" }],
      edges: [],
    });

    const { container } = render(<KnowledgeGraphPage />);

    // Wait for the loaded state. A degenerate timeline has nothing to
    // animate, so playback is paused (Play button, no "Invalid Date") and the
    // single node is still shown at its creation time.
    await waitFor(() => {
      expect(screen.getByText("Jan 1, 2024")).toBeInTheDocument();
      expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /pause/i })
      ).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(container.querySelectorAll("circle").length).toBe(1);
    });
  });

  it("pauses playback when the timeline reaches maxTime", async () => {
    const raf = mockRaf();
    global.fetch = fetchMock(twoDayData);

    render(<KnowledgeGraphPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
    });

    // First frame anchors the start of the timeline; second frame lands on the
    // end of the 30s animation.
    act(() => raf.frame(0));
    act(() => raf.frame(PLAYBACK_DURATION_MS));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /pause/i })
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText("Jan 3, 2024")).toBeInTheDocument();
  });

  it("resets to minTime and resumes playback", async () => {
    const raf = mockRaf();
    global.fetch = fetchMock(twoDayData);

    render(<KnowledgeGraphPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
    });

    // Play through to the end so playback stops.
    act(() => raf.frame(0));
    act(() => raf.frame(PLAYBACK_DURATION_MS));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
    });

    // Reset jumps back to the earliest note and resumes playback.
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
      expect(screen.getByText("Jan 1, 2024")).toBeInTheDocument();
    });
  });

  it("resumes from the paused position without jumping to the end", async () => {
    const raf = mockRaf();
    global.fetch = fetchMock(twoDayData);

    render(<KnowledgeGraphPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
    });

    // Advance to the midpoint of the two-day span.
    act(() => raf.frame(0));
    act(() => raf.frame(PLAYBACK_DURATION_MS / 2));
    await waitFor(() => expect(screen.getByText("Jan 2, 2024")).toBeInTheDocument());

    // Pause, then resume.
    fireEvent.click(screen.getByRole("button", { name: /pause/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /play/i }));

    // Advancing a full duration from the resume point must continue from the
    // midpoint, not skip to the end.
    act(() => raf.frame(PLAYBACK_DURATION_MS));
    expect(screen.getByText("Jan 2, 2024")).toBeInTheDocument();
    expect(screen.queryByText("Jan 3, 2024")).not.toBeInTheDocument();
  });

  it("scrubbing while playing does not jump to the end", async () => {
    const raf = mockRaf();
    global.fetch = fetchMock(twoDayData);

    render(<KnowledgeGraphPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
    });

    const slider = screen.getByRole("slider");
    const midTime = Date.parse("2024-01-02T00:00:00.000Z");

    // Scrub to the midpoint while the timeline is still playing.
    fireEvent.change(slider, { target: { value: String(midTime) } });
    await waitFor(() => expect(screen.getByText("Jan 2, 2024")).toBeInTheDocument());

    // The next frame continues from the scrub position, not the end.
    act(() => raf.frame(PLAYBACK_DURATION_MS));
    expect(screen.getByText("Jan 2, 2024")).toBeInTheDocument();
    expect(screen.queryByText("Jan 3, 2024")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
  });
});
