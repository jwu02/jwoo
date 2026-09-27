import { act, renderHook } from "@testing-library/react";
import { useCacheClock } from "@/components/knowledge-graph/use-cache-clock";
import type { KnowledgeGraphSnapshot } from "@/lib/knowledge-graph/types";

const NOW = new Date("2026-09-14T06:32:00.000Z").getTime();
const WRITTEN_AT = "2026-09-14T06:02:00.000Z";

// The server said this many seconds were left when it answered.
function snapshot(remainingSeconds = 30 * 60): KnowledgeGraphSnapshot {
  return { nodes: [], edges: [], cachedAt: WRITTEN_AT, remainingSeconds };
}

// One snapshot identity per mount, the way the page holds it in state: the hook
// re-anchors on the object, so a fresh one per render would be a new reading.
function renderClock(graph = snapshot(1800)) {
  return renderHook(() => useCacheClock(graph, onExpire));
}

// Let wall-clock time and the ticks covering it pass together, the way an open
// tab runs.
async function advance(milliseconds: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });
}

let onExpire: jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  onExpire = jest.fn();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useCacheClock", () => {
  it("reports the server's own reading before any time has passed", () => {
    const { result } = renderClock();

    expect(result.current).toEqual({
      cachedAt: WRITTEN_AT,
      remainingSeconds: 1800,
    });
  });

  it("takes observed time off that reading once a minute has been spent", async () => {
    const { result } = renderClock();

    await advance(60 * 1000);

    expect(result.current?.remainingSeconds).toBe(1740);
  });

  // The displayed minute is the only thing a tick may re-render for: the graph
  // beside it reconciles every node label on each one.
  it("leaves the reading alone until the minute it shows has been spent", async () => {
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useCacheClock(snapshot(), onExpire);
    });

    await advance(30 * 1000);
    const held = renders;

    await advance(30 * 1000);

    expect(renders).toBe(held + 1);
  });

  it("asks for a fresh snapshot once the window runs out", async () => {
    renderClock(snapshot(2));

    await advance(3000);

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  // The countdown is past zero on every tick that follows, so an unguarded
  // refresh would re-request once a second for as long as the tab stayed open.
  it("asks only once, however many ticks pass afterwards", async () => {
    renderClock(snapshot(2));

    await advance(3000);
    await advance(5000);

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  // A backgrounded tab has its timers throttled, so the reading after a jump is
  // the only one that matters — a decremented counter would land minutes out,
  // and the expiry it skipped has to fire on the next tick rather than never.
  it("catches up in one step after a jump no tick covered", async () => {
    const { result } = renderClock();

    jest.setSystemTime(new Date(NOW + 45 * 60 * 1000));
    await advance(1000);

    expect(result.current?.remainingSeconds).toBeLessThan(0);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  // A refresh that lands mid-count is a different reading, measured from its
  // own arrival rather than inheriting the reading it replaced.
  it("re-anchors the countdown on a snapshot that arrives mid-count", async () => {
    const { result, rerender } = renderHook(
      ({ graph }: { graph: KnowledgeGraphSnapshot }) =>
        useCacheClock(graph, onExpire),
      { initialProps: { graph: snapshot() } }
    );
    await advance(90 * 1000);

    rerender({ graph: snapshot() });

    expect(result.current?.remainingSeconds).toBe(1800);
  });

  // An older server, or a cached response from before the fields existed,
  // leaves nothing to count from — and nothing to count from must not reach the
  // notice as NaN.
  it("counts nothing when the snapshot carries no cache info", () => {
    const { result } = renderHook(() =>
      useCacheClock(
        { nodes: [], edges: [] } as unknown as KnowledgeGraphSnapshot,
        onExpire
      )
    );

    expect(result.current).toBeNull();
  });

  it("stops ticking once it is unmounted", async () => {
    const { unmount } = renderClock(snapshot(2));

    unmount();
    await advance(5000);

    expect(onExpire).not.toHaveBeenCalled();
  });
});
