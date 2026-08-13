import { NextResponse } from "next/server";
import { getNotesCollection } from "@/lib/knowledge-graph/db";
import type { KnowledgeGraphResponse } from "@/lib/knowledge-graph/types";

export async function GET(_request: Request) {
  try {
    const collection = await getNotesCollection();
    const docs = await collection.find({}).toArray();

    const nodeIds = new Set(docs.map((doc) => doc.filename));

    const nodes = docs.map((doc) => ({
      id: doc.filename,
      createdAt: doc.createdAt.toISOString(),
    }));

    const edges = docs.flatMap((doc) =>
      doc.links
        .filter((target) => nodeIds.has(target))
        .map((target) => ({ source: doc.filename, target }))
    );

    const response: KnowledgeGraphResponse = { nodes, edges };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load knowledge graph" },
      { status: 500 }
    );
  }
}
