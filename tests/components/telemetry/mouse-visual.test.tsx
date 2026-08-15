import { render, screen, fireEvent } from "@testing-library/react";
import { MouseVisual } from "@/components/telemetry/mouse-visual";

describe("MouseVisual", () => {
  it("shows left click count on hover", () => {
    render(<MouseVisual leftClicks={42} rightClicks={7} movementMeters={1234} />);
    const leftButton = screen.getByRole("button", { name: /left button/i });
    fireEvent.mouseEnter(leftButton);
    expect(screen.getByText(/left: 42 clicks/i)).toBeInTheDocument();
  });

  it("shows right click count on hover", () => {
    render(<MouseVisual leftClicks={42} rightClicks={7} movementMeters={1234} />);
    const rightButton = screen.getByRole("button", { name: /right button/i });
    fireEvent.mouseEnter(rightButton);
    expect(screen.getByText(/right: 7 clicks/i)).toBeInTheDocument();
  });

  it("shows scroll wheel untracked message on hover", () => {
    render(<MouseVisual leftClicks={42} rightClicks={7} movementMeters={1234} />);
    const wheel = screen.getByRole("button", { name: /middle click untracked/i });
    fireEvent.mouseEnter(wheel);
    expect(
      screen.getByText(/middle click untracked, scroll distance untracked/i)
    ).toBeInTheDocument();
  });

  it("shows mouse movement distance on body hover", () => {
    render(<MouseVisual leftClicks={42} rightClicks={7} movementMeters={1234} />);
    const body = screen.getByRole("button", { name: /mouse body/i });
    fireEvent.mouseEnter(body);
    expect(screen.getByText(/mouse movement: 1,234 m/i)).toBeInTheDocument();
  });

  it("rounds movement distance to a whole integer", () => {
    render(<MouseVisual leftClicks={42} rightClicks={7} movementMeters={1234.6} />);
    const body = screen.getByRole("button", { name: /mouse body/i });
    fireEvent.mouseEnter(body);
    expect(screen.getByText(/mouse movement: 1,235 m/i)).toBeInTheDocument();
  });
});
