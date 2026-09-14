import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Toaster } from "@/components/ui/toast";
import {
  CacheToast,
  formatRemaining,
} from "@/components/knowledge-graph/cache-toast";

const cachedAt = "2026-09-14T06:32:00.000Z";

interface CacheToastTestProps {
  cachedAt: string;
  remainingSeconds: number;
}

function toastTree(props: CacheToastTestProps) {
  return (
    <>
      <Toaster />
      <CacheToast {...props} />
    </>
  );
}

// The notice is portalled by the `Toaster` the root layout mounts, and it is
// mounted in two commits on purpose: the layout's `Toaster` is up long before
// the page's notice appears. Mounting both at once would race the provider's
// subscription — a passive effect that runs after its children's — and the
// first `add` would be emitted to nobody.
function renderToast(props: CacheToastTestProps) {
  const view = render(<Toaster />);
  view.rerender(toastTree(props));
  return view;
}

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

describe("CacheToast", () => {
  it("reports when the snapshot was written and how long it has left", () => {
    renderToast({ cachedAt, remainingSeconds: 9720 });

    expect(screen.getByText("Server-side Cache")).toBeInTheDocument();
    expect(screen.getByText("Expires in 2h 42m")).toBeInTheDocument();
    expect(screen.getByText(/Last updated /)).toBeInTheDocument();
  });

  it("formats the write time in the viewer's timezone at minute precision", () => {
    renderToast({ cachedAt, remainingSeconds: 9720 });

    const expected = new Date(cachedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    expect(screen.getByText(`Last updated ${expected}`)).toBeInTheDocument();
  });

  it("renders a different stamp for a different write time", () => {
    const { unmount } = renderToast({
      cachedAt: "2026-09-14T06:32:00.000Z",
      remainingSeconds: 60,
    });
    const first = screen.getByText(/Last updated /).textContent;
    unmount();

    renderToast({ cachedAt: "2026-09-14T09:05:00.000Z", remainingSeconds: 60 });

    expect(screen.getByText(/Last updated /).textContent).not.toBe(first);
  });

  // A failed refresh leaves the page on a snapshot it could not replace. The
  // line keeps its shape and reads zero, rather than switching to a sentence.
  it("reads zero rather than changing the line's shape when it runs out", () => {
    renderToast({ cachedAt, remainingSeconds: 0 });

    expect(screen.getByText("Expires in 0 min")).toBeInTheDocument();
  });

  it("labels the last minute", () => {
    renderToast({ cachedAt, remainingSeconds: 40 });

    expect(screen.getByText("Expires in <1 min")).toBeInTheDocument();
  });
});

describe("CacheToast under React StrictMode", () => {
  // StrictMode mounts, unmounts and remounts every effect. The simulated
  // unmount retires the notice, and that teardown must not be mistaken for the
  // viewer dismissing it: in development the notice would then never appear at
  // all, however long you waited and however many times the countdown ticked.
  it("still appears after the dev-only double mount", () => {
    const view = render(
      <StrictMode>
        <Toaster />
      </StrictMode>
    );
    view.rerender(
      <StrictMode>{toastTree({ cachedAt, remainingSeconds: 9720 })}</StrictMode>
    );

    expect(screen.getByText("Server-side Cache")).toBeInTheDocument();
    expect(screen.getByText("Expires in 2h 42m")).toBeInTheDocument();
  });
});

describe("CacheToast lifetime", () => {
  // The notice is a status readout, not an announcement: it has to still be
  // there when the viewer looks up from the graph minutes later.
  it("sits there rather than auto-dismissing", () => {
    jest.useFakeTimers();
    try {
      renderToast({ cachedAt, remainingSeconds: 9720 });

      act(() => {
        jest.advanceTimersByTime(10 * 60 * 1000);
      });

      expect(screen.getByText("Server-side Cache")).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  // Each tick re-adds under the same id, so the notice is rewritten in place
  // instead of stacking a copy per minute.
  it("updates in place as the countdown moves", () => {
    const { rerender } = renderToast({ cachedAt, remainingSeconds: 9720 });

    rerender(toastTree({ cachedAt, remainingSeconds: 9660 }));

    expect(screen.getAllByText(/Expires in /)).toHaveLength(1);
    expect(screen.getByText("Expires in 2h 41m")).toBeInTheDocument();
  });

  // Closing is the viewer's decision. The countdown carries on underneath, and
  // the refresh that eventually replaces the snapshot must not reopen it.
  it("does not reopen once the viewer has closed it", () => {
    const { rerender } = renderToast({ cachedAt, remainingSeconds: 9720 });

    // Base UI holds the close button out of the accessibility tree until the
    // stack is hovered or focused, so the pointer has to arrive first — which
    // is also how a viewer reaches it.
    fireEvent.mouseEnter(screen.getByRole("region", { name: /notifications/i }));
    fireEvent.click(screen.getByRole("button", { name: /close toast/i }));
    const closed = screen.queryByText("Server-side Cache");

    rerender(
      toastTree({
        cachedAt: "2026-09-14T09:05:00.000Z",
        remainingSeconds: 9720,
      })
    );

    // Either it is gone outright, or it is still on its way out — what it must
    // not be is a live notice again.
    const after = screen.queryByText("Server-side Cache");
    expect(after).toBe(closed);
    if (after !== null) {
      expect(after.closest("[data-slot='toast']")).toHaveAttribute(
        "data-ending-style"
      );
    }
  });
});
