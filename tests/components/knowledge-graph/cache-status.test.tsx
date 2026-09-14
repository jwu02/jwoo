import { render, screen } from "@testing-library/react";
import {
  CacheStatus,
  formatRemaining,
} from "@/components/knowledge-graph/cache-status";

const cachedAt = "2026-09-14T06:32:00.000Z";

describe("formatRemaining", () => {
  it("counts whole minutes inside the last hour", () => {
    expect(formatRemaining(60)).toBe("1 min");
    expect(formatRemaining(21 * 60)).toBe("21 min");
    expect(formatRemaining(59 * 60)).toBe("59 min");
  });

  // The last minute before the hour rolls over: rounding up to 60 minutes is
  // what takes it into the hours branch.
  it("switches to hours and minutes once there is an hour left", () => {
    expect(formatRemaining(59 * 60 + 1)).toBe("1h 0m");
    expect(formatRemaining(60 * 60)).toBe("1h 0m");
    expect(formatRemaining(2 * 60 * 60 + 42 * 60)).toBe("2h 42m");
    expect(formatRemaining(3 * 60 * 60)).toBe("3h 0m");
  });

  // The page recomputes the remainder from wall-clock elapsed time, so this
  // arrives fractional and drifting; it must not render as "0.2 min".
  it("rounds partial minutes up so the countdown reaches zero only at zero", () => {
    expect(formatRemaining(9 * 60 + 5)).toBe("10 min");
    expect(formatRemaining(60.5)).toBe("2 min");
  });

  // Rounding up would call 40 seconds "1 min" and then jump to expired.
  it("labels the last minute rather than rounding it up", () => {
    expect(formatRemaining(59)).toBe("<1 min");
    expect(formatRemaining(40)).toBe("<1 min");
    expect(formatRemaining(12.4)).toBe("<1 min");
    expect(formatRemaining(0.2)).toBe("<1 min");
  });

  it("reports zero, and nothing below it, only once the snapshot has run out", () => {
    expect(formatRemaining(0)).toBe("0 min");
    expect(formatRemaining(-30)).toBe("0 min");
  });
});

describe("CacheStatus", () => {
  it("reports when the snapshot was written and how long it has left", () => {
    render(<CacheStatus cachedAt={cachedAt} remainingSeconds={9720} />);

    expect(screen.getByText("Server-side Cache")).toBeInTheDocument();
    expect(screen.getByText("Expires in 2h 42m")).toBeInTheDocument();
    expect(screen.getByText(/Last updated /)).toBeInTheDocument();
  });

  it("formats the write time in the viewer's timezone at minute precision", () => {
    render(<CacheStatus cachedAt={cachedAt} remainingSeconds={9720} />);

    const expected = new Date(cachedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    expect(screen.getByText(`Last updated ${expected}`)).toBeInTheDocument();
  });

  it("renders a different stamp for a different write time", () => {
    const { unmount } = render(
      <CacheStatus cachedAt="2026-09-14T06:32:00.000Z" remainingSeconds={60} />
    );
    const first = screen.getByText(/Last updated /).textContent;
    unmount();

    render(
      <CacheStatus cachedAt="2026-09-14T09:05:00.000Z" remainingSeconds={60} />
    );

    expect(screen.getByText(/Last updated /).textContent).not.toBe(first);
  });

  // A failed refresh leaves the page on a snapshot it could not replace. The
  // line keeps its shape and reads zero, rather than switching to a sentence.
  it("reads zero rather than changing the line's shape when it runs out", () => {
    render(<CacheStatus cachedAt={cachedAt} remainingSeconds={0} />);

    expect(screen.getByText("Expires in 0 min")).toBeInTheDocument();
  });

  it("labels the last minute", () => {
    render(<CacheStatus cachedAt={cachedAt} remainingSeconds={40} />);

    expect(screen.getByText("Expires in <1 min")).toBeInTheDocument();
  });
});
