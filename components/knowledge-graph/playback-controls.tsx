"use client";

import { Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlaybackControlsProps {
  minTime: number;
  maxTime: number;
  currentTime: number;
  isPlaying: boolean;
  onTimeChange: (time: number) => void;
  onPlayPause: () => void;
  onReset: () => void;
}

export function PlaybackControls({
  minTime,
  maxTime,
  currentTime,
  isPlaying,
  onTimeChange,
  onPlayPause,
  onReset,
}: PlaybackControlsProps) {
  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-background/80 p-3 backdrop-blur">
      <Button variant="outline" size="icon" onClick={onPlayPause} aria-label={isPlaying ? "Pause" : "Play"}>
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Button variant="outline" size="icon" onClick={onReset} aria-label="Reset">
        <RotateCcw className="h-4 w-4" />
      </Button>
      <div className="min-w-[100px] text-sm tabular-nums">{formatDate(currentTime)}</div>
      <input
        type="range"
        min={minTime}
        max={maxTime}
        value={currentTime}
        onChange={(event) => onTimeChange(Number(event.target.value))}
        className="flex-1 accent-primary"
      />
    </div>
  );
}
