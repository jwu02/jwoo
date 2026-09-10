import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { MouseVisual } from "@/components/telemetry/mouse-visual";

// The mouse scene loads the WebGL canvas behind ssr:false dynamic imports,
// which jsdom lacks. Stub next/dynamic (and the three modules it could reach) so
// importing the wrapper is safe; the a11y layer and tooltip render independently
// of the canvas, so the WebGL-independent behaviour is what these tests cover.
jest.mock("next/dynamic", () => () => {
  const NoOp = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return NoOp;
});

jest.mock("@react-three/fiber", () => ({
  Canvas: () => null,
}));

jest.mock("@react-three/drei", () => ({
  useCursor: () => undefined,
  useGLTF: () => ({ scene: null }),
}));

describe("MouseVisual", () => {
  afterEach(() => jest.restoreAllMocks());

  // jsdom has no WebGL, so isWebGLAvailable() throws a "not-implemented" console
  // warning on getContext. Force it false (the realistic jsdom path) so MouseScene
  // takes its fallback — which is exactly what these tests exercise (a11y + tooltip
  // without a canvas).
  beforeEach(() => {
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  it("renders one focusable sr-only button per region (left/right/wheel/body)", () => {
    render(<MouseVisual leftClicks={42} rightClicks={7} movementMeters={1234} />);
    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /left button/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /right button/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /middle click untracked/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mouse body/i })).toBeInTheDocument();
  });

  it("shows left click count on focus", () => {
    render(<MouseVisual leftClicks={42} rightClicks={7} movementMeters={1234} />);
    fireEvent.focus(screen.getByRole("button", { name: /left button/i }));
    expect(screen.getByText("Left: 42 clicks")).toBeInTheDocument();
  });

  it("shows right click count on focus", () => {
    render(<MouseVisual leftClicks={42} rightClicks={7} movementMeters={1234} />);
    fireEvent.focus(screen.getByRole("button", { name: /right button/i }));
    expect(screen.getByText("Right: 7 clicks")).toBeInTheDocument();
  });

  it("shows scroll wheel untracked message on focus", () => {
    render(<MouseVisual leftClicks={42} rightClicks={7} movementMeters={1234} />);
    fireEvent.focus(screen.getByRole("button", { name: /middle click untracked/i }));
    expect(
      screen.getByText("Middle click untracked, Scroll distance untracked"),
    ).toBeInTheDocument();
  });

  it("shows mouse movement distance on body focus", () => {
    render(<MouseVisual leftClicks={42} rightClicks={7} movementMeters={1234} />);
    fireEvent.focus(screen.getByRole("button", { name: /mouse body/i }));
    expect(screen.getByText("Mouse movement: 1,234 m")).toBeInTheDocument();
  });

  it("rounds movement distance to a whole integer", () => {
    render(<MouseVisual leftClicks={42} rightClicks={7} movementMeters={1234.6} />);
    fireEvent.focus(screen.getByRole("button", { name: /mouse body/i }));
    expect(screen.getByText("Mouse movement: 1,235 m")).toBeInTheDocument();
  });

  it("clears the tooltip on blur", () => {
    render(<MouseVisual leftClicks={42} rightClicks={7} movementMeters={1234} />);
    const button = screen.getByRole("button", { name: /left button/i });
    fireEvent.focus(button);
    expect(screen.getByText("Left: 42 clicks")).toBeInTheDocument();
    fireEvent.blur(button);
    expect(screen.queryByText("Left: 42 clicks")).not.toBeInTheDocument();
  });
});
