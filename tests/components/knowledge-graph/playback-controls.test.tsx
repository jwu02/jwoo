import { render, screen, fireEvent } from "@testing-library/react";
import { PlaybackControls } from "@/components/knowledge-graph/playback-controls";

describe("PlaybackControls", () => {
  const minTime = Date.parse("2024-01-01T00:00:00.000Z");
  const maxTime = Date.parse("2024-01-03T00:00:00.000Z");

  it("displays the current time", () => {
    render(
      <PlaybackControls
        minTime={minTime}
        maxTime={maxTime}
        currentTime={minTime}
        isPlaying={false}
        onTimeChange={jest.fn()}
        onPlayPause={jest.fn()}
        onReset={jest.fn()}
      />
    );
    expect(screen.getByText(/2024/)).toBeInTheDocument();
  });

  it("calls onPlayPause when the play button is clicked", () => {
    const onPlayPause = jest.fn();
    render(
      <PlaybackControls
        minTime={minTime}
        maxTime={maxTime}
        currentTime={minTime}
        isPlaying={false}
        onPlayPause={onPlayPause}
        onTimeChange={jest.fn()}
        onReset={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(onPlayPause).toHaveBeenCalled();
  });

  it("calls onTimeChange when the slider changes", () => {
    const onTimeChange = jest.fn();
    render(
      <PlaybackControls
        minTime={minTime}
        maxTime={maxTime}
        currentTime={minTime}
        isPlaying={false}
        onTimeChange={onTimeChange}
        onPlayPause={jest.fn()}
        onReset={jest.fn()}
      />
    );
    fireEvent.change(screen.getByRole("slider"), { target: { value: String(maxTime) } });
    expect(onTimeChange).toHaveBeenCalledWith(maxTime);
  });

  it("calls onReset when the reset button is clicked", () => {
    const onReset = jest.fn();
    render(
      <PlaybackControls
        minTime={minTime}
        maxTime={maxTime}
        currentTime={maxTime}
        isPlaying={false}
        onTimeChange={jest.fn()}
        onPlayPause={jest.fn()}
        onReset={onReset}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(onReset).toHaveBeenCalled();
  });
});
