# Knowledge Graph

## Context

The site currently has an Activity Telemetry dashboard at `/activity-telemetry`. The
user wants to add a new section that replicates Obsidian’s graph view: an
interactive force-directed graph of markdown notes where edges represent
`[[wikilink]]` connections and nodes appear over time according to their file
creation date.

Data is kept minimal: only the filename, creation date, and outgoing wikilinks are
extracted from the Obsidian vault. A local sync tool pushes this metadata into
MongoDB; the site reads it at request time, so redeployments are not required when
notes change.

## Goals

- Add a dedicated `/knowledge-graph` page linked from the sidebar and home page.
- Provide a `GET /api/knowledge-graph` endpoint that returns notes and links from
  MongoDB.
- Render an interactive, Obsidian-style force-directed graph using D3 in the
  browser.
- Animate node/edge creation chronologically by `createdAt` (auto-play on load).
- Let users scrub through time with a slider and pause/resume playback.
- Support zoom, pan, and node dragging like Obsidian.
- Fit the existing Next.js 16 + React 19 + Tailwind v4 + shadcn/ui architecture.

## Non-Goals

- Extracting note body content, modification dates, folder paths, tags, aliases, or
  any metadata beyond filename, creation date, and outgoing wikilinks.
- Treating tags as graph nodes.
- Editing notes from the graph.
- Full-text search or note preview panels.
- Server-side precomputation of graph layout.

## Design

### 1. Data model & sync tool contract

MongoDB collection: `notes`

Document schema:

```ts
{
  filename: string;   // the note's own title, e.g. "CNC Machining". Not a vault
                      // path: the sync stores the note name, so ids carry no
                      // directory prefix and no ".md" suffix. A title may still
                      // end in ".md" by coincidence (e.g. "Claude Code CLAUDE.md").
  createdAt: Date;    // file birthtime
  links: string[];    // resolved outgoing [[...]] targets, in the same
                      // title form as `filename`, e.g. ["Another Note"]
}
```

- `filename` is the unique key; the sync tool upserts by it.
- Only files present in the collection become graph nodes. If a `[[link]]` points to
  a missing file, it does not create a dangling node.
- The sync tool lives outside the site repo and writes/upserts documents into
  MongoDB.

API response shape:

```ts
interface KnowledgeGraphNode {
  id: string;        // filename
  createdAt: string; // ISO timestamp
}

interface KnowledgeGraphEdge {
  source: string;
  target: string;
}

interface KnowledgeGraphResponse {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}
```

### 2. API route

**Route:** `app/api/knowledge-graph/route.ts`

- `GET` handler fetches all documents from the `notes` collection.
- Returns `KnowledgeGraphResponse` as JSON.
- Uses `Cache-Control: no-store, max-age=0` so the graph reflects the latest sync.
- On error, returns `{ error: string }` with a 500 status.

**DB access:**

Create `lib/knowledge-graph/db.ts` that imports the cached MongoDB client from
`lib/telemetry/db.ts` and exports `getNotesCollection()`. This keeps the
knowledge-graph code separate without duplicating the connection logic.

```ts
import { getMongoClient } from "@/lib/telemetry/db";

export async function getNotesCollection() {
  const client = await getMongoClient();
  return client.db(process.env.ACTIVITY_DB_NAME).collection("notes");
}
```

### 3. Graph component architecture

New files:

```
components/knowledge-graph/
├── force-graph.tsx            // D3 force simulation + SVG rendering
└── playback-controls.tsx      // slider + play/pause
```

`app/knowledge-graph/page.tsx` is a client page that:

1. Fetches `/api/knowledge-graph` on mount.
2. Passes `nodes` and `edges` into `ForceGraph`.
3. Renders `PlaybackControls` underneath the graph.

`ForceGraph` is a client component that:

- Holds a D3 force simulation in a `useEffect`.
- Renders an SVG with `<line>` elements for edges and `<circle>` elements for
  nodes.
- Supports zoom/pan and node dragging, like Obsidian.
- Keeps a `visibleNodeIds` set; only renders nodes whose `createdAt` is ≤ the
  current playback time.
- Only renders an edge when both its source and target are visible.

`PlaybackControls`:

- A horizontal slider mapped from earliest to latest `createdAt`.
- Play/pause button.
- Playback speed is derived from the total time span and a fixed animation
  duration (30 seconds).

### 4. Playback & controls

- **Auto-play on load:** the timeline starts at the earliest note and advances
  automatically.
- **Fixed animation duration:** the full creation history plays over 30 seconds,
  regardless of how many notes exist.
- **Slider:** a horizontal range input lets the user jump to any point in the
  timeline; the graph updates instantly.
- **Play/pause button:** pauses auto-play; pressing play resumes from the current
  slider position.
- **Reset button:** jumps back to the earliest note and resumes playback.
- **End behavior:** when playback reaches the latest note, it pauses (does not
  loop).
- **Time display:** show the currently displayed date next to the controls.

`ForceGraph` receives a `currentTime` prop and re-renders visible nodes/edges
whenever it changes.

### 5. Visual design

Goal: match Obsidian’s graph view while fitting the site’s light/dark theme.

- **Background:** uses the page background (`var(--background)`), so it respects
  light/dark mode automatically.
- **Nodes:** small circles. Default color is a muted accent (`var(--primary)` or a
  chart color). Hover brightens the node.
- **Node size:** scales slightly with total degree (incoming + outgoing edges)
  so hub notes stand out.
- **Edges:** thin 1px lines at low opacity (`var(--foreground)` at ~15–20%
  opacity).
- **Labels:** hidden below `LABEL_ZOOM_THRESHOLD` to reduce clutter, where
  hovering shows a tooltip with the note's name instead. At or above it, every
  node shows its name at once. The text holds a fixed 12px at any zoom because
  the label layer lives in DOM space rather than inside the zoomed world, and
  long titles wrap onto further lines under their node.
- **Active/hover state:** hovered node gets a ring or brighter fill; connected
  edges become more opaque.
- **Playback cursor:** nodes fade in as they appear, rather than popping.

### 6. Page structure & navigation

- **New route:** `app/knowledge-graph/page.tsx`.
- **Sidebar:** add a “Knowledge Graph” entry in `components/app-sidebar.tsx`
  alongside Home and Activity Telemetry.
- **Home page:** add a second card on `app/page.tsx` linking to `/knowledge-graph`.
- **Page layout:** full-width, with the graph taking most of the viewport and the
  playback controls as a floating bar or bottom panel.
- **Page title:** “Knowledge Graph”.

## Components

### New

- `app/api/knowledge-graph/route.ts` — API route returning nodes and edges.
- `lib/knowledge-graph/types.ts` — shared types for the graph.
- `lib/knowledge-graph/db.ts` — `getNotesCollection()` helper.
- `app/knowledge-graph/page.tsx` — client page that fetches data and composes the
  graph + controls.
- `components/knowledge-graph/force-graph.tsx` — D3 force simulation and SVG
  rendering.
- `components/knowledge-graph/playback-controls.tsx` — slider and play/pause/reset.

### Modified

- `components/app-sidebar.tsx` — add Knowledge Graph navigation item.
- `app/page.tsx` — add a card linking to `/knowledge-graph`.

## Error Handling

- **Loading:** a centered spinner or skeleton while `GET /api/knowledge-graph` is
  in flight.
- **Error:** reuse the existing `ErrorBanner` pattern from telemetry; show a retry
  button that re-fetches.
- **Empty state:** if the collection has no notes, show “No notes synced yet.”
- **Disabled controls:** the playback slider and play button are disabled until
  data loads.

## Testing

- `tests/app/api/knowledge-graph/route.test.ts` — mock the notes collection and
  assert response shape + error handling.
- `tests/lib/knowledge-graph/graph-data.test.ts` — pure functions that build
  `nodes`/`edges` from raw MongoDB docs and compute visibility for a given
  playback time.
- `tests/components/knowledge-graph/playback-controls.test.tsx` — test
  play/pause/slider/reset interactions.
- `tests/components/knowledge-graph/force-graph.test.tsx` — render with a tiny
  static graph and assert the correct number of SVG circles/lines appear after
  the simulation tick.
- `npm run typecheck` and `npm test` must pass.

## Out of Scope

- Extracting note body content, modification dates, folder paths, tags, aliases,
  or word counts.
- Treating tags as graph nodes.
- Server-side precomputation or caching of force-layout positions.
- Editing notes from the graph.
- Note preview panels or full-text search.
- Linking to external URLs or non-markdown files.
- Handling Obsidian aliases, embedded files (`![[...]]`), or Markdown-style links
  (`[text](path)`).
