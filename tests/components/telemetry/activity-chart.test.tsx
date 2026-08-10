import { render, screen, fireEvent } from "@testing-library/react";
import { ActivityChart } from "@/components/telemetry/activity-chart";
import { TimeSeriesPoint } from "@/lib/telemetry/types";

function buildData(): TimeSeriesPoint[] {
  return Array.from({ length: 4 }, (_, i) => ({
    bucket: new Date(Date.UTC(2025, 7, 9, i * 6)).toISOString(),
    leftClicks: i * 10,
    rightClicks: i * 5,
    keyPresses: i * 20,
    movementMeters: i * 100,
  }));
}

describe("ActivityChart", () => {
  it("renders a legend item for each series", () => {
    render(<ActivityChart data={buildData()} range="24h" />);

    expect(screen.getByRole("button", { name: /Hide Left Clicks/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hide Right Clicks/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hide Key Presses/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hide Distance \(m\)/i })).toBeInTheDocument();
  });

  it("hides a series when its legend item is clicked", () => {
    render(<ActivityChart data={buildData()} range="24h" />);

    const leftClicksButton = screen.getByRole("button", { name: /Hide Left Clicks/i });
    fireEvent.click(leftClicksButton);

    expect(screen.getByRole("button", { name: /Show Left Clicks/i })).toBeInTheDocument();
  });

  it("shows a hidden series when its legend item is clicked again", () => {
    render(<ActivityChart data={buildData()} range="24h" />);

    const leftClicksButton = screen.getByRole("button", { name: /Hide Left Clicks/i });
    fireEvent.click(leftClicksButton);
    fireEvent.click(screen.getByRole("button", { name: /Show Left Clicks/i }));

    expect(screen.getByRole("button", { name: /Hide Left Clicks/i })).toBeInTheDocument();
  });

  it("keeps hidden series hidden when the range changes", () => {
    const { rerender } = render(<ActivityChart data={buildData()} range="24h" />);

    fireEvent.click(screen.getByRole("button", { name: /Hide Key Presses/i }));

    rerender(<ActivityChart data={buildData()} range="7d" />);

    expect(screen.getByRole("button", { name: /Show Key Presses/i })).toBeInTheDocument();
  });

  it("renders hidden legend items with reduced opacity", () => {
    render(<ActivityChart data={buildData()} range="24h" />);

    fireEvent.click(screen.getByRole("button", { name: /Hide Right Clicks/i }));

    expect(screen.getByRole("button", { name: /Show Right Clicks/i })).toHaveClass("opacity-50");
  });

  it("sets aria-pressed true for hidden series and false for visible series", () => {
    render(<ActivityChart data={buildData()} range="24h" />);

    const distanceButton = screen.getByRole("button", { name: /Hide Distance \(m\)/i });
    expect(distanceButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(distanceButton);

    expect(screen.getByRole("button", { name: /Show Distance \(m\)/i })).toHaveAttribute("aria-pressed", "true");
  });
});
