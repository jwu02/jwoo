import { NextResponse } from "next/server";
import { getNotesCollection } from "@/lib/knowledge-graph/db";
import { buildGraph } from "@/lib/knowledge-graph/graph-data";
import { readCache, writeCache } from "@/lib/knowledge-graph/cache";
import { buildPayload } from "@/lib/knowledge-graph/payload";
import type { KnowledgeGraphResponse } from "@/lib/knowledge-graph/types";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  try {
    // Serve the graph snapshot from the Vercel Runtime Cache while its 3-hour
    // TTL lasts. On a hit, repeat page loads skip the MongoDB query and graph
    // build entirely.
    const cached = await readCache();
    if (cached) {
      return NextResponse.json(
        buildPayload(cached.graph, cached.cachedAt, new Date()),
        { headers: NO_STORE }
      );
    }

    const collection = await getNotesCollection();
    const docs = await collection.find({}).toArray();

    const { nodes, edges } = buildGraph(docs);
    const response: KnowledgeGraphResponse = { nodes, edges };
    const now = new Date();

    // Best-effort write: a failed cache write must not fail the request — the
    // missing snapshot just means the next request rebuilds it.
    await writeCache(response, now.toISOString()).catch(() => {});

    return NextResponse.json(
      buildPayload(response, now.toISOString(), now),
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error("Knowledge graph API error:", error);
    return NextResponse.json(
      { error: "Failed to load knowledge graph" },
      { status: 500 }
    );
  }
}
