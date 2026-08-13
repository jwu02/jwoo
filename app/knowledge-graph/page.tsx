"use client";

import { useCallback, useEffect, useState } from "react";
import { ForceGraph } from "@/components/knowledge-graph/force-graph";
import { ErrorBanner } from "@/components/telemetry/error-banner";
import type { KnowledgeGraphResponse } from "@/lib/knowledge-graph/types";

export default function KnowledgeGraphPage() {
  const [data, setData] = useState<KnowledgeGraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/knowledge-graph");
      if (!response.ok) throw new Error("Failed to load knowledge graph");
      const json = await response.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => load(), 0);
    return () => clearTimeout(timeoutId);
  }, [load]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <div className="flex flex-1 items-center justify-center">
          Loading knowledge graph…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col p-6">
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
    <div className="flex flex-1 flex-col -mx-4 -mb-4">
      <div className="flex-1 overflow-hidden">
        <ForceGraph nodes={data.nodes} edges={data.edges} />
      </div>
    </div>
  );
}
