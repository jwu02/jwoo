import { act, renderHook } from "@testing-library/react";
import { usePolledJson } from "@/hooks/use-polled-json";

const POLL_INTERVAL_MS = 60_000;
const URL_A = "/api/telemetry?range=24h&tz=Europe%2FLondon";
const URL_B = "/api/telemetry?range=30d&tz=Europe%2FLondon";

const MOUNTED_AT_MS = new Date("2026-09-18T10:00:00.000Z").getTime();

type Payload = { value: number };

let fetchMock: jest.Mock;

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function fail(status: number, body: unknown) {
  return { ok: false, status, json: async () => body };
}

/** A response whose body is not JSON at all. */
function unreadable(status: number) {
  return {
    ok: false,
    status,
    json: async () => {
      throw new Error("Unexpected token < in JSON");
    },
  };
}

/** A request that stays open until something aborts it. */
function neverSettles() {
  return new Promise(() => {});
}

/** A request the test itself decides when to answer. */
function deferred() {
  let resolve: (response: unknown) => void = () => {};
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/**
 * A request that behaves like the real thing: it answers when the test says
 * so, unless it is aborted first, in which case it rejects the way a cancelled
 * fetch does.
 */
function slowResponse() {
  const d = deferred();
  const wrapper = (_url: string, init: RequestInit) =>
    new Promise((resolve, reject) => {
      init.signal?.addEventListener("abort", () => {
        const error = new Error("The operation was aborted.");
        error.name = "AbortError";
        reject(error);
      });
      d.promise.then(resolve, reject);
    });
  return { ...d, wrapper };
}

function requestedUrls(): unknown[] {
  return fetchMock.mock.calls.map((call) => call[0]);
}

function signalOf(callIndex: number): AbortSignal {
  return fetchMock.mock.calls[callIndex][1].signal;
}

/** Advance timers, then let the promises the hook awaits settle. */
async function tick(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
}

/** Let the outstanding promises settle without moving the clock. */
async function flush() {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
}

/** Render and let the deferred first load run. */
async function mount(url = URL_A) {
  const rendered = renderHook(() => usePolledJson<Payload>(url));
  await tick(0);
  return rendered;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(MOUNTED_AT_MS);
  fetchMock = jest.fn().mockResolvedValue(ok({ value: 1 }));
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("usePolledJson", () => {
  it("defers the first load by a macrotask rather than fetching during render", async () => {
    renderHook(() => usePolledJson<Payload>(URL_A));

    expect(fetchMock).not.toHaveBeenCalled();

    await tick(0);

    expect(requestedUrls()).toEqual([URL_A]);
  });

  it("reports loading until the first response lands", async () => {
    const first = deferred();
    fetchMock.mockImplementationOnce(() => first.promise);

    const { result } = renderHook(() => usePolledJson<Payload>(URL_A));
    await tick(0);

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    first.resolve(ok({ value: 7 }));
    await flush();

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual({ value: 7 });
  });

  it("hands back the parsed body", async () => {
    const { result } = await mount();

    expect(result.current.data).toEqual({ value: 1 });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("polls on the default one-minute cadence", async () => {
    await mount();

    await tick(POLL_INTERVAL_MS - 1);
    expect(requestedUrls()).toHaveLength(1);

    await tick(1);
    expect(requestedUrls()).toHaveLength(2);
  });

  it("honours a custom interval", async () => {
    renderHook(() => usePolledJson<Payload>(URL_A, { intervalMs: 5_000 }));
    await tick(0);

    await tick(4_999);
    expect(requestedUrls()).toHaveLength(1);

    await tick(1);
    expect(requestedUrls()).toHaveLength(2);
  });

  // The whole point of a poll: it replaces what is on screen, so it must not
  // put the page back into its loading state.
  it("swaps the data in place on a poll without ever showing loading", async () => {
    const { result } = await mount();
    expect(result.current.data).toEqual({ value: 1 });

    const poll = deferred();
    fetchMock.mockImplementationOnce(() => poll.promise);
    await tick(POLL_INTERVAL_MS);

    // Mid-poll: the previous data is still on screen and nothing is loading.
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual({ value: 1 });

    poll.resolve(ok({ value: 2 }));
    await flush();

    expect(result.current.data).toEqual({ value: 2 });
    expect(result.current.loading).toBe(false);
  });

  it("records the moment the data on screen arrived", async () => {
    const { result } = await mount();

    expect(result.current.lastUpdated?.getTime()).toBe(MOUNTED_AT_MS);

    await tick(POLL_INTERVAL_MS);

    expect(result.current.lastUpdated?.getTime()).toBe(
      MOUNTED_AT_MS + POLL_INTERVAL_MS
    );
  });

  it("keeps the data on screen when a poll fails, reporting the error alongside it", async () => {
    const { result } = await mount();

    fetchMock.mockResolvedValueOnce(fail(500, { error: "aggregation blew up" }));
    await tick(POLL_INTERVAL_MS);

    expect(result.current.data).toEqual({ value: 1 });
    expect(result.current.error).toBe("aggregation blew up");
    // A failed poll has nothing fresher to report, so the reading stands.
    expect(result.current.lastUpdated?.getTime()).toBe(MOUNTED_AT_MS);
  });

  it("clears the error when a later poll succeeds", async () => {
    const { result } = await mount();

    fetchMock.mockResolvedValueOnce(fail(503, { error: "no mongo" }));
    await tick(POLL_INTERVAL_MS);
    expect(result.current.error).toBe("no mongo");

    await tick(POLL_INTERVAL_MS);
    expect(result.current.error).toBeNull();
  });

  it("shapes an HTTP failure from the body's error field", async () => {
    fetchMock.mockResolvedValueOnce(fail(400, { error: "invalid range" }));
    const { result } = await mount();

    expect(result.current.error).toBe("invalid range");
    expect(result.current.loading).toBe(false);
  });

  it("falls back to the status when the body carries no error", async () => {
    fetchMock.mockResolvedValueOnce(fail(502, {}));
    const { result } = await mount();

    expect(result.current.error).toBe("HTTP 502");
  });

  it("falls back to an unknown error when the body cannot be read", async () => {
    fetchMock.mockResolvedValueOnce(unreadable(500));
    const { result } = await mount();

    expect(result.current.error).toBe("Unknown error");
  });

  it("reports a network failure's own message", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { result } = await mount();

    expect(result.current.error).toBe("Failed to fetch");
  });

  // An abort is not a failure: it is the hook cancelling its own request.
  it("says nothing when its own request is aborted", async () => {
    fetchMock.mockImplementation(() => neverSettles());
    const { result } = await mount();

    fetchMock.mockImplementationOnce(() => {
      const error = new Error("The operation was aborted.");
      error.name = "AbortError";
      return Promise.reject(error);
    });
    await tick(POLL_INTERVAL_MS);

    expect(result.current.error).toBeNull();
  });

  it("aborts the in-flight request when the url changes, and loads the new one", async () => {
    fetchMock.mockImplementation(() => neverSettles());
    const { rerender } = renderHook(
      ({ url }: { url: string }) => usePolledJson<Payload>(url),
      { initialProps: { url: URL_A } }
    );
    await tick(0);
    expect(signalOf(0).aborted).toBe(false);

    fetchMock.mockResolvedValue(ok({ value: 2 }));
    rerender({ url: URL_B });
    await tick(0);

    expect(signalOf(0).aborted).toBe(true);
    expect(requestedUrls()).toEqual([URL_A, URL_B]);
  });

  // A url change is the viewer's doing, so it loads the way a first arrival
  // does — in the foreground — rather than slipping in as a poll.
  it("loads the new url in the foreground", async () => {
    const first = slowResponse();
    const second = deferred();
    fetchMock.mockImplementationOnce(first.wrapper);
    fetchMock.mockImplementationOnce(() => second.promise);

    const { result, rerender } = renderHook(
      ({ url }: { url: string }) => usePolledJson<Payload>(url),
      { initialProps: { url: URL_A } }
    );
    await tick(0);
    expect(result.current.loading).toBe(true);

    rerender({ url: URL_B });
    // Drain the aborted request's cleanup before the new load is due, the
    // order a browser runs them in: microtasks always beat a 0ms macrotask.
    await flush();
    await tick(0);

    expect(result.current.loading).toBe(true);

    second.resolve(ok({ value: 9 }));
    await flush();

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual({ value: 9 });
  });

  // A range change starts a new cadence: the next poll must belong to the new
  // url, and must not arrive early on the old range's clock.
  it("restarts the cadence from the moment the url changed", async () => {
    const { rerender } = renderHook(
      ({ url }: { url: string }) => usePolledJson<Payload>(url),
      { initialProps: { url: URL_A } }
    );
    await tick(0);

    await tick(30_000);
    rerender({ url: URL_B });
    await tick(0);
    expect(requestedUrls()).toEqual([URL_A, URL_B]);

    // t=60s: the old cadence would have polled here.
    await tick(30_000);
    expect(requestedUrls()).toHaveLength(2);

    // t=90s: the new cadence's first poll.
    await tick(30_000);
    expect(requestedUrls()).toEqual([URL_A, URL_B, URL_B]);
  });

  // A response that outlives its own poll interval: without the newer request
  // cancelling it, it would land last and put older data back on screen.
  it("cancels a request the next one has overtaken, so it cannot land last", async () => {
    const { result } = await mount();
    expect(result.current.data).toEqual({ value: 1 });

    const slow = slowResponse();
    fetchMock.mockImplementationOnce(slow.wrapper);
    await tick(POLL_INTERVAL_MS);

    fetchMock.mockResolvedValueOnce(ok({ value: 3 }));
    await tick(POLL_INTERVAL_MS);
    expect(result.current.data).toEqual({ value: 3 });

    slow.resolve(ok({ value: 2 }));
    await flush();

    expect(result.current.data).toEqual({ value: 3 });
  });

  it("aborts the in-flight request when the page unmounts", async () => {
    fetchMock.mockImplementation(() => neverSettles());
    const { unmount } = renderHook(() => usePolledJson<Payload>(URL_A));
    await tick(0);
    expect(signalOf(0).aborted).toBe(false);

    unmount();

    expect(signalOf(0).aborted).toBe(true);
  });

  it("stops polling once unmounted", async () => {
    const { unmount } = await mount();
    expect(requestedUrls()).toHaveLength(1);

    unmount();
    await tick(POLL_INTERVAL_MS * 3);

    expect(requestedUrls()).toHaveLength(1);
  });

  it("refresh() loads the current url in the foreground and clears the error", async () => {
    fetchMock.mockResolvedValueOnce(fail(500, { error: "boom" }));
    const { result } = await mount();
    expect(result.current.error).toBe("boom");

    await act(async () => {
      result.current.refresh();
      for (let i = 0; i < 8; i += 1) await Promise.resolve();
    });

    expect(requestedUrls()).toEqual([URL_A, URL_A]);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual({ value: 1 });
  });
});
