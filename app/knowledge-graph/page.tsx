"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ForceGraph } from "@/components/knowledge-graph/force-graph";
import { PlaybackControls } from "@/components/knowledge-graph/playback-controls";
import { ErrorBanner } from "@/components/telemetry/error-banner";
import type { KnowledgeGraphResponse } from "@/lib/knowledge-graph/types";

const PLAYBACK_DURATION_MS = 30_000;

export default function KnowledgeGraphPage() {
  const [data, setData] = useState<KnowledgeGraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const currentTimeRef = useRef(currentTime);

  const { minTime, maxTime } = useMemo(() => {
    if (!data || data.nodes.length === 0) return { minTime: 0, maxTime: 0 };
    const times = data.nodes.map((node) => new Date(node.createdAt).getTime());
    return { minTime: Math.min(...times), maxTime: Math.max(...times) };
  }, [data]);

  // Keep the ref in sync with the latest currentTime for the animation loop.
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Reset the timeline to the start whenever the graph data set changes.
  const [prevMinTime, setPrevMinTime] = useState(minTime);
  if (prevMinTime !== minTime) {
    setPrevMinTime(minTime);
    setCurrentTime(minTime);
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/knowledge-graph");
        if (!response.ok) throw new Error("Failed to load knowledge graph");
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (!isPlaying || minTime === 0 || maxTime === 0) return;

    function tick(now: number) {
      if (startTimeRef.current === null) {
        startTimeRef.current = now - (currentTimeRef.current - minTime);
      }

      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / PLAYBACK_DURATION_MS, 1);
      const nextTime = minTime + progress * (maxTime - minTime);
      setCurrentTime(nextTime);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(tick);
      } else {
        setIsPlaying(false);
      }
    }

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, minTime, maxTime]);

  function handleTimeChange(time: number) {
    startTimeRef.current = null;
    setCurrentTime(time);
  }

  function handlePlayPause() {
    if (currentTimeRef.current >= maxTime) {
      setCurrentTime(minTime);
    }
    startTimeRef.current = null;
    setIsPlaying((prev) => !prev);
  }

  function handleReset() {
    startTimeRef.current = null;
    setCurrentTime(minTime);
    setIsPlaying(true);
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <h1 className="px-6 pt-6 text-2xl font-bold">Knowledge Graph</h1>
        <div className="flex flex-1 items-center justify-center">
          Loading knowledge graph…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col p-6">
        <h1 className="mb-4 text-2xl font-bold">Knowledge Graph</h1>
        <ErrorBanner message={error} />
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <h1 className="px-6 pt-6 text-2xl font-bold">Knowledge Graph</h1>
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          No notes synced yet.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <h1 className="px-6 pt-6 text-2xl font-bold">Knowledge Graph</h1>
      <div className="flex-1 overflow-hidden px-6 pb-2">
        <ForceGraph nodes={data.nodes} edges={data.edges} currentTime={currentTime} />
      </div>
      <div className="border-t border-border p-4">
        <PlaybackControls
          minTime={minTime}
          maxTime={maxTime}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onTimeChange={handleTimeChange}
          onPlayPause={handlePlayPause}
          onReset={handleReset}
        />
      </div>
    </div>
  );
}
