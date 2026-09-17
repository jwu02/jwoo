"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ForceGraph } from "@/components/knowledge-graph/force-graph";
import { CacheToast } from "@/components/knowledge-graph/cache-toast";
import { useCacheClock } from "@/components/knowledge-graph/use-cache-clock";
import { ErrorBanner } from "@/components/telemetry/error-banner";
import type { KnowledgeGraphSnapshot } from "@/lib/knowledge-graph/types";

export default function KnowledgeGraphPage() {
  const [data, setData] = useState<KnowledgeGraphSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    // A refresh landing while the previous one is still open would race it and
    // let the older response win.
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const response = await fetch("/api/knowledge-graph");
      if (!response.ok) throw new Error("Failed to load knowledge graph");
      setData(await response.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => load(), 0);
    return () => clearTimeout(timeoutId);
  }, [load]);

  // The countdown is the only thing that asks for a fresh snapshot; the page
  // does not poll, because a snapshot's life is measured in hours.
  const countdown = useCacheClock(data, load);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <div className="flex flex-1 items-center justify-center">
          Loading knowledge graph…
        </div>
      </div>
    );
  }

  // Only fatal when there is nothing to show. Once a graph is on screen, a
  // failed refresh reports itself alongside the stale graph rather than
  // replacing it.
  if (error && !data) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col p-4 md:p-6">
        <ErrorBanner message={error} onRetry={load} />
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          No notes synced yet.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col md:-mx-4 md:-mb-4">
      {error && (
        <div className="px-4 pt-4 md:px-6">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      )}
      <div className="relative flex-1 overflow-hidden">
        <ForceGraph graph={data} />
        {countdown && <CacheToast {...countdown} />}
      </div>
    </div>
  );
}
