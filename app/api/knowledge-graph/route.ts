import { NextResponse } from "next/server";
import { getNotesCollection } from "@/lib/knowledge-graph/db";
import { buildGraph } from "@/lib/knowledge-graph/graph-data";
import type { KnowledgeGraphResponse } from "@/lib/knowledge-graph/types";

export async function GET() {
  try {
    const collection = await getNotesCollection();
    const docs = await collection.find({}).toArray();

    const { nodes, edges } = buildGraph(docs);
    const response: KnowledgeGraphResponse = { nodes, edges };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Knowledge graph API error:", error);
    return NextResponse.json(
      { error: "Failed to load knowledge graph" },
      { status: 500 }
    );
  }
}
