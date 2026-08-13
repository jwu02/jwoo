# Knowledge Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Obsidian-style interactive knowledge graph at `/knowledge-graph` with MongoDB-backed data, D3 force simulation, and chronological node/edge playback.

**Architecture:** A new API route reads note metadata from a MongoDB `notes` collection; a client page fetches that graph data and drives a D3 force-directed SVG with playback controls. Pure graph-data helpers live under `lib/knowledge-graph/` and are unit-tested, while React components under `components/knowledge-graph/` handle rendering and interaction.

**Tech Stack:** TypeScript, React 19, Next.js 16, Tailwind CSS 4, shadcn/ui, D3, Jest, React Testing Library.

## Global Constraints

- Only `filename`, `createdAt`, and outgoing resolved wikilink target filenames are stored in MongoDB.
- Tags, folders, modification dates, aliases, and note body content are not extracted.
- Missing link targets do not create dangling nodes.
- Playback auto-starts on load; total animation duration is 30 seconds.
- Cache-Control is `no-store, max-age=0` on the API route.
- All commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## Task 1: Install D3 and type declarations

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: existing npm project.
- Produces: `d3` available for import in components; `@types/d3` available for development.

- [ ] **Step 1: Install D3**

```bash
npm install d3
```

- [ ] **Step 2: Install D3 type declarations**

```bash
npm install --save-dev @types/d3
```

- [ ] **Step 3: Verify typecheck still passes**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add d3 and @types/d3 for knowledge graph

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: Add knowledge graph types and DB helper

**Files:**
- Create: `lib/knowledge-graph/types.ts`
- Create: `lib/knowledge-graph/db.ts`

**Interfaces:**
- Consumes: `getMongoClient` from `lib/telemetry/db.ts`.
- Produces: `KnowledgeGraphNode`, `KnowledgeGraphEdge`, `KnowledgeGraphResponse`, `NoteDoc`, and `getNotesCollection()`.

- [ ] **Step 1: Write types**

Create `lib/knowledge-graph/types.ts`:

```typescript
export interface NoteDoc {
  filename: string;
  createdAt: Date;
  links: string[];
}

export interface KnowledgeGraphNode {
  id: string;
  createdAt: string;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
}

export interface KnowledgeGraphResponse {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}
```

- [ ] **Step 2: Write DB helper**

Create `lib/knowledge-graph/db.ts`:

```typescript
import { getMongoClient } from "@/lib/telemetry/db";

export async function getNotesCollection() {
  const client = await getMongoClient();
  return client.db(process.env.ACTIVITY_DB_NAME).collection<NoteDoc>("notes");
}
```

- [ ] **Step 3: Import the type in the DB helper**

Add to the top of `lib/knowledge-graph/db.ts`:

```typescript
import type { NoteDoc } from "./types";
```

- [ ] **Step 4: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/knowledge-graph/types.ts lib/knowledge-graph/db.ts
git commit -m "feat(knowledge-graph): add types and notes collection helper

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: Implement the API route

**Files:**
- Create: `app/api/knowledge-graph/route.ts`
- Create: `tests/app/api/knowledge-graph/route.test.ts`

**Interfaces:**
- Consumes: `getNotesCollection` and `KnowledgeGraphResponse` types.
- Produces: `GET /api/knowledge-graph` returning `{ nodes, edges }` JSON.

- [ ] **Step 1: Write the failing test**

Create `tests/app/api/knowledge-graph/route.test.ts`:

```typescript
import { GET } from "@/app/api/knowledge-graph/route";

jest.mock("@/lib/knowledge-graph/db", () => ({
  getNotesCollection: jest.fn(),
}));

import { getNotesCollection } from "@/lib/knowledge-graph/db";

function createRequest() {
  return new Request("http://localhost/api/knowledge-graph");
}

describe("GET /api/knowledge-graph", () => {
  it("returns nodes and edges from the notes collection", async () => {
    const toArray = jest.fn().mockResolvedValue([
      { filename: "A.md", createdAt: new Date("2024-01-01"), links: ["B.md"] },
      { filename: "B.md", createdAt: new Date("2024-01-02"), links: [] },
    ]);
    (getNotesCollection as jest.Mock).mockResolvedValue({ find: () => ({ toArray }) });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      nodes: [
        { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
        { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
      ],
      edges: [{ source: "A.md", target: "B.md" }],
    });
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
  });

  it("ignores links to missing notes", async () => {
    const toArray = jest.fn().mockResolvedValue([
      { filename: "A.md", createdAt: new Date("2024-01-01"), links: ["Missing.md"] },
    ]);
    (getNotesCollection as jest.Mock).mockResolvedValue({ find: () => ({ toArray }) });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(json.edges).toEqual([]);
  });

  it("returns 500 on database errors", async () => {
    (getNotesCollection as jest.Mock).mockRejectedValue(new Error("db down"));

    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to load knowledge graph");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/app/api/knowledge-graph/route.test.ts`
Expected: FAIL — `app/api/knowledge-graph/route.ts` does not exist or `GET` is not exported.

- [ ] **Step 3: Implement the route**

Create `app/api/knowledge-graph/route.ts`:

```typescript
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/app/api/knowledge-graph/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/knowledge-graph/route.ts tests/app/api/knowledge-graph/route.test.ts
git commit -m "feat(knowledge-graph): add API route and tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: Build graph-data utilities

**Files:**
- Create: `lib/knowledge-graph/graph-data.ts`
- Create: `tests/lib/knowledge-graph/graph-data.test.ts`

**Interfaces:**
- Consumes: `KnowledgeGraphNode`, `KnowledgeGraphEdge`, `NoteDoc` types.
- Produces: `buildGraph`, `getVisibleNodes`, `getVisibleEdges`, `computeDegrees`.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/knowledge-graph/graph-data.test.ts`:

```typescript
import {
  buildGraph,
  computeDegrees,
  getVisibleEdges,
  getVisibleNodes,
} from "@/lib/knowledge-graph/graph-data";
import type { NoteDoc } from "@/lib/knowledge-graph/types";

describe("buildGraph", () => {
  it("builds nodes and edges, dropping links to missing notes", () => {
    const docs: NoteDoc[] = [
      { filename: "A.md", createdAt: new Date("2024-01-02"), links: ["B.md", "Missing.md"] },
      { filename: "B.md", createdAt: new Date("2024-01-01"), links: ["A.md"] },
    ];

    const { nodes, edges } = buildGraph(docs);

    expect(nodes).toEqual([
      { id: "B.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "A.md", createdAt: "2024-01-02T00:00:00.000Z" },
    ]);
    expect(edges).toEqual([
      { source: "A.md", target: "B.md" },
      { source: "B.md", target: "A.md" },
    ]);
  });
});

describe("visibility", () => {
  const nodes = [
    { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
    { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
    { id: "C.md", createdAt: "2024-01-03T00:00:00.000Z" },
  ];
  const edges = [
    { source: "A.md", target: "B.md" },
    { source: "B.md", target: "C.md" },
  ];

  it("returns nodes created at or before current time", () => {
    const time = new Date("2024-01-02").getTime();
    expect(getVisibleNodes(nodes, time)).toEqual([
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
    ]);
  });

  it("returns only edges whose source and target are both visible", () => {
    const time = new Date("2024-01-02").getTime();
    expect(getVisibleEdges(edges, getVisibleNodes(nodes, time))).toEqual([
      { source: "A.md", target: "B.md" },
    ]);
  });
});

describe("computeDegrees", () => {
  it("counts incoming and outgoing edges", () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-01T00:00:00.000Z" },
    ];
    const edges = [
      { source: "A.md", target: "B.md" },
      { source: "B.md", target: "A.md" },
    ];

    expect(computeDegrees(nodes, edges)).toEqual(
      new Map([
        ["A.md", 2],
        ["B.md", 2],
      ])
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/lib/knowledge-graph/graph-data.test.ts`
Expected: FAIL — module or functions not defined.

- [ ] **Step 3: Implement the utilities**

Create `lib/knowledge-graph/graph-data.ts`:

```typescript
import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  NoteDoc,
} from "./types";

export function buildGraph(docs: NoteDoc[]) {
  const nodeIds = new Set(docs.map((doc) => doc.filename));

  const nodes: KnowledgeGraphNode[] = docs
    .map((doc) => ({
      id: doc.filename,
      createdAt: doc.createdAt.toISOString(),
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const edges: KnowledgeGraphEdge[] = docs.flatMap((doc) =>
    doc.links
      .filter((target) => nodeIds.has(target))
      .map((target) => ({ source: doc.filename, target }))
  );

  return { nodes, edges };
}

export function getVisibleNodes(
  nodes: KnowledgeGraphNode[],
  currentTime: number
): KnowledgeGraphNode[] {
  return nodes.filter((node) => new Date(node.createdAt).getTime() <= currentTime);
}

export function getVisibleEdges(
  edges: KnowledgeGraphEdge[],
  visibleNodes: KnowledgeGraphNode[]
): KnowledgeGraphEdge[] {
  const ids = new Set(visibleNodes.map((node) => node.id));
  return edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
}

export function computeDegrees(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[]
): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const node of nodes) {
    degrees.set(node.id, 0);
  }
  for (const edge of edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
  }
  return degrees;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tests/lib/knowledge-graph/graph-data.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/knowledge-graph/graph-data.ts tests/lib/knowledge-graph/graph-data.test.ts
git commit -m "feat(knowledge-graph): add graph data utilities and tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: Implement the ForceGraph component

**Files:**
- Create: `components/knowledge-graph/force-graph.tsx`
- Create: `tests/components/knowledge-graph/force-graph.test.tsx`

**Interfaces:**
- Consumes: `KnowledgeGraphNode[]`, `KnowledgeGraphEdge[]`, `currentTime: number`.
- Produces: Interactive SVG force-directed graph with zoom, pan, drag, hover tooltips.

- [ ] **Step 1: Write the failing test**

Create `tests/components/knowledge-graph/force-graph.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { ForceGraph } from "@/components/knowledge-graph/force-graph";

jest.mock("d3", () => ({
  ...jest.requireActual("d3"),
  forceSimulation: jest.fn(() => ({
    force: jest.fn().mockReturnThis(),
    nodes: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    alpha: jest.fn().mockReturnThis(),
    restart: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
  })),
  forceManyBody: jest.fn(() => jest.fn()),
  forceCenter: jest.fn(() => jest.fn()),
  forceLink: jest.fn(() => jest.fn()),
  forceCollide: jest.fn(() => jest.fn()),
  zoom: jest.fn(() => jest.fn()),
  drag: jest.fn(() => jest.fn()),
  select: jest.fn(() => ({
    selectAll: jest.fn(() => ({ data: jest.fn(() => ({ join: jest.fn() })) })),
    call: jest.fn().mockReturnThis(),
    attr: jest.fn().mockReturnThis(),
    append: jest.fn(() => ({
      attr: jest.fn().mockReturnThis(),
      call: jest.fn().mockReturnThis(),
      selectAll: jest.fn(() => ({ data: jest.fn(() => ({ join: jest.fn() })) })),
    })),
  })),
}));

describe("ForceGraph", () => {
  it("renders visible nodes and edges", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
    ];
    const edges = [{ source: "A.md", target: "B.md" }];

    const { container } = render(
      <ForceGraph nodes={nodes} edges={edges} currentTime={Date.parse("2024-01-02")} />
    );

    await waitFor(() => {
      expect(container.querySelectorAll("circle").length).toBe(2);
      expect(container.querySelectorAll("line").length).toBe(1);
    });
  });

  it("does not render nodes created after current time", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-03T00:00:00.000Z" },
    ];
    const edges: { source: string; target: string }[] = [];

    const { container } = render(
      <ForceGraph nodes={nodes} edges={edges} currentTime={Date.parse("2024-01-02")} />
    );

    await waitFor(() => {
      expect(container.querySelectorAll("circle").length).toBe(1);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/components/knowledge-graph/force-graph.test.tsx`
Expected: FAIL — `ForceGraph` not found or D3 mock issues.

- [ ] **Step 3: Implement the component**

Create `components/knowledge-graph/force-graph.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { KnowledgeGraphEdge, KnowledgeGraphNode } from "@/lib/knowledge-graph/types";
import {
  computeDegrees,
  getVisibleEdges,
  getVisibleNodes,
} from "@/lib/knowledge-graph/graph-data";

interface ForceGraphProps {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  currentTime: number;
}

export function ForceGraph({ nodes, edges, currentTime }: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<d3.SimulationNodeDatum, undefined> | null>(null);

  const visibleNodes = getVisibleNodes(nodes, currentTime);
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = getVisibleEdges(edges, visibleNodes);
  const degrees = computeDegrees(visibleNodes, visibleEdges);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    svg.selectAll("*").remove();

    const g = svg.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      });

    svg.call(zoom);

    const simulationNodes: (KnowledgeGraphNode & d3.SimulationNodeDatum)[] = visibleNodes.map(
      (node) => ({ ...node })
    );
    const simulationLinks: (KnowledgeGraphEdge & d3.SimulationLinkDatum<d3.SimulationNodeDatum>)[] =
      visibleEdges.map((edge) => ({ ...edge }));

    const simulation = d3
      .forceSimulation(simulationNodes)
      .force(
        "link",
        d3
          .forceLink(simulationLinks)
          .id((d: any) => d.id)
          .distance(80)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((d: any) => 5 + Math.sqrt(degrees.get(d.id) ?? 0) * 2));

    simulationRef.current = simulation;

    const link = g
      .append("g")
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.15)
      .selectAll("line")
      .data(simulationLinks)
      .join("line")
      .attr("stroke-width", 1);

    const node = g
      .append("g")
      .selectAll("circle")
      .data(simulationNodes)
      .join("circle")
      .attr("r", (d: any) => 4 + Math.sqrt(degrees.get(d.id) ?? 0))
      .attr("fill", "var(--primary)")
      .attr("stroke", "var(--background)")
      .attr("stroke-width", 1.5)
      .call(
        d3
          .drag<SVGCircleElement, any>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    node.append("title").text((d: any) => d.id);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
    });

    return () => {
      simulation.stop();
    };
  }, [visibleNodes, visibleEdges]);

  return (
    <svg
      ref={svgRef}
      className="h-full w-full touch-none"
      style={{ color: "var(--foreground)" }}
    />
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/components/knowledge-graph/force-graph.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/knowledge-graph/force-graph.tsx tests/components/knowledge-graph/force-graph.test.tsx
git commit -m "feat(knowledge-graph): add D3 force graph component

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: Implement the PlaybackControls component

**Files:**
- Create: `components/knowledge-graph/playback-controls.tsx`
- Create: `tests/components/knowledge-graph/playback-controls.test.tsx`

**Interfaces:**
- Consumes: `minTime`, `maxTime`, `currentTime`, `isPlaying`, `onTimeChange`, `onPlayPause`, `onReset`.
- Produces: Rendered control bar with time display, slider, play/pause, and reset buttons.

- [ ] **Step 1: Write the failing tests**

Create `tests/components/knowledge-graph/playback-controls.test.tsx`:

```typescript
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/components/knowledge-graph/playback-controls.test.tsx`
Expected: FAIL — `PlaybackControls` not found.

- [ ] **Step 3: Implement the component**

Create `components/knowledge-graph/playback-controls.tsx`:

```tsx
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tests/components/knowledge-graph/playback-controls.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/knowledge-graph/playback-controls.tsx tests/components/knowledge-graph/playback-controls.test.tsx
git commit -m "feat(knowledge-graph): add playback controls component

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 7: Implement the knowledge graph page and navigation

**Files:**
- Create: `app/knowledge-graph/page.tsx`
- Modify: `components/app-sidebar.tsx`
- Modify: `app/page.tsx`
- Create: `tests/app/knowledge-graph/page.test.tsx`

**Interfaces:**
- Consumes: `ForceGraph`, `PlaybackControls`, `/api/knowledge-graph` response shape.
- Produces: `/knowledge-graph` page with auto-playing timeline; sidebar and home links.

- [ ] **Step 1: Write the failing page test**

Create `tests/app/knowledge-graph/page.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import KnowledgeGraphPage from "@/app/knowledge-graph/page";

const mockData = {
  nodes: [
    { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
    { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
  ],
  edges: [{ source: "A.md", target: "B.md" }],
};

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(mockData),
  })
) as jest.Mock;

describe("KnowledgeGraphPage", () => {
  it("fetches and renders the graph", async () => {
    render(<KnowledgeGraphPage />);

    await waitFor(() => {
      expect(screen.getByText(/Knowledge Graph/i)).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/knowledge-graph");
  });

  it("shows a loading state initially", () => {
    render(<KnowledgeGraphPage />);
    expect(screen.getByText(/Loading knowledge graph/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/app/knowledge-graph/page.test.tsx`
Expected: FAIL — page file does not exist.

- [ ] **Step 3: Implement the page**

Create `app/knowledge-graph/page.tsx`:

```tsx
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

  currentTimeRef.current = currentTime;

  const { minTime, maxTime } = useMemo(() => {
    if (!data || data.nodes.length === 0) return { minTime: 0, maxTime: 0 };
    const times = data.nodes.map((node) => new Date(node.createdAt).getTime());
    return { minTime: Math.min(...times), maxTime: Math.max(...times) };
  }, [data]);

  useEffect(() => {
    setCurrentTime(minTime);
  }, [minTime]);

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
```

- [ ] **Step 4: Add the sidebar link**

Modify `components/app-sidebar.tsx` to add a Knowledge Graph navigation item. Locate the existing nav items and add:

```tsx
import { Circle } from "lucide-react"; // or another icon
```

Add to the navigation items array:

```tsx
{
  title: "Knowledge Graph",
  url: "/knowledge-graph",
  icon: Circle,
}
```

- [ ] **Step 5: Add the home page card**

Modify `app/page.tsx` to add a card linking to `/knowledge-graph`. Follow the existing Activity Telemetry card pattern. Add:

```tsx
import { Circle } from "lucide-react";
```

Add a second card inside the grid:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Circle className="h-5 w-5" />
      Knowledge Graph
    </CardTitle>
    <CardDescription>Explore Obsidian-style note connections.</CardDescription>
  </CardHeader>
  <CardContent>
    <Button asChild>
      <Link href="/knowledge-graph">Open graph</Link>
    </Button>
  </CardContent>
</Card>
```

- [ ] **Step 6: Run the page test**

Run: `npm test -- tests/app/knowledge-graph/page.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/knowledge-graph/page.tsx tests/app/knowledge-graph/page.test.tsx components/app-sidebar.tsx app/page.tsx
git commit -m "feat(knowledge-graph): add page, sidebar link, and home card

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 8: Final verification

**Files:**
- All touched files.

- [ ] **Step 1: Run the full test suite, typecheck, and lint**

Run:
```bash
npm test
npm run typecheck
npm run lint
```
Expected: PASS for all three.

- [ ] **Step 2: Build and visually verify**

Run:
```bash
npm run build
npm run dev
```

Open `/knowledge-graph` and verify:
- The graph fetches data from `/api/knowledge-graph`.
- Nodes appear automatically in creation order.
- Edges appear once both endpoints exist.
- The slider scrubs through time and updates the graph.
- Play/pause and reset buttons work.
- Nodes can be dragged, and the view can be zoomed/panned.
- Hovering a node shows its filename.
- The sidebar and home page link to `/knowledge-graph`.

- [ ] **Step 3: Final commit if fixes were needed**

If no fixes were needed, no additional commit is required. If fixes were made, commit them with a descriptive message ending with the standard co-author trailer.

---

## Self-Review

**Spec coverage:**
- `/knowledge-graph` page → Task 7.
- `GET /api/knowledge-graph` → Task 3.
- D3 force-directed graph → Task 5.
- Chronological playback with slider → Tasks 5, 6, and 7.
- Auto-play on load → Task 7.
- Zoom/pan/drag → Task 5.
- Minimal data model (filename, createdAt, links) → Tasks 2 and 3.
- Sidebar and home links → Task 7.
- Loading/error/empty states → Task 7.
- Tests → Each task.

**Placeholder scan:**
- No TBD/TODO placeholders.
- Each step includes concrete code or commands.
- No vague "add appropriate error handling" steps.

**Type consistency:**
- `KnowledgeGraphNode`, `KnowledgeGraphEdge`, `KnowledgeGraphResponse`, and `NoteDoc` are defined in Task 2 and used consistently in Tasks 3, 4, 5, and 7.
- `PlaybackControlsProps` interface matches the props passed in Task 7.
