import { NextResponse } from "next/server";
import { loadSnapshot } from "@/lib/knowledge-graph/snapshot";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  try {
    // The graph's cache, its source query and its expiry are all the snapshot
    // module's business; the route only decides what a failure looks like.
    const snapshot = await loadSnapshot();
    return NextResponse.json(snapshot, { headers: NO_STORE });
  } catch (error) {
    console.error("Knowledge graph API error:", error);
    return NextResponse.json(
      { error: "Failed to load knowledge graph" },
      { status: 500 }
    );
  }
}
