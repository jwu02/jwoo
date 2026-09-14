import { render, screen } from "@testing-library/react";
import {
  CacheStatus,
  formatRemaining,
} from "@/components/knowledge-graph/cache-status";

const cachedAt = "2026-09-14T06:32:00.000Z";

describe("formatRemaining", () => {
  it("shows seconds alone under a minute", () => {
    expect(formatRemaining(0)).toBe("0s");
    expect(formatRemaining(45)).toBe("45s");
  });

  it("adds minutes once there is one", () => {
    expect(formatRemaining(60)).toBe("1m 0s");
    expect(formatRemaining(9 * 60 + 5)).toBe("9m 5s");
  });

  it("adds hours once there is one, down to the second", () => {
    expect(formatRemaining(60 * 60)).toBe("1h 0m 0s");
    expect(formatRemaining(2 * 60 * 60 + 42 * 60 + 12)).toBe("2h 42m 12s");
  });

  // The page recomputes the remainder from wall-clock elapsed time, so this
  // arrives fractional and drifting; it must not render as "12.4s".
  it("rounds fractional seconds up so the countdown reaches zero only at zero", () => {
    expect(formatRemaining(12.4)).toBe("13s");
    expect(formatRemaining(0.2)).toBe("1s");
  });

  it("never counts backwards past zero", () => {
    expect(formatRemaining(-30)).toBe("0s");
  });
});

describe("CacheStatus", () => {
  it("reports when the snapshot was written and how long it has left", () => {
    render(<CacheStatus cachedAt={cachedAt} remainingSeconds={9732} />);

    expect(screen.getByText(/refreshes in 2h 42m 12s/)).toBeInTheDocument();
    expect(screen.getByText(/Cached /)).toBeInTheDocument();
  });

  it("formats the write time in the viewer's timezone at minute precision", () => {
    render(<CacheStatus cachedAt={cachedAt} remainingSeconds={9732} />);

    const expected = new Date(cachedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    expect(screen.getByText(`Cached ${expected}`)).toBeInTheDocument();
  });

  it("renders a different stamp for a different write time", () => {
    const { unmount } = render(
      <CacheStatus cachedAt="2026-09-14T06:32:00.000Z" remainingSeconds={60} />
    );
    const first = screen.getByText(/Cached /).textContent;
    unmount();

    render(
      <CacheStatus cachedAt="2026-09-14T09:05:00.000Z" remainingSeconds={60} />
    );

    expect(screen.getByText(/Cached /).textContent).not.toBe(first);
  });

  // A failed refresh leaves the page on a snapshot it could not replace; saying
  // "refreshes in 0s" forever would misreport that as a countdown still running.
  it("says the refresh is due rather than counting to zero", () => {
    render(<CacheStatus cachedAt={cachedAt} remainingSeconds={0} />);

    expect(screen.getByText("refresh due")).toBeInTheDocument();
  });
});
