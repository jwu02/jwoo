"use client";

import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import * as d3 from "d3";
import type { FederatedPointerEvent } from "pixi.js";
import type {
  KnowledgeGraphData,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from "@/lib/knowledge-graph/types";
import { computeNodeEmphasis } from "@/lib/knowledge-graph/emphasis";
import {
  computeDegrees,
  computeNodeTextureRadius,
  LABEL_ZOOM_THRESHOLD,
  NODE_BASE_RADIUS,
  NODE_HOVER_SCALE,
  nodeRadius,
} from "@/lib/knowledge-graph/graph-data";
import { graphPointFromClient, isDragGesture } from "@/lib/knowledge-graph/framing";
import { createCamera, type Camera } from "@/lib/knowledge-graph/camera";
import { usePixiApp } from "./use-pixi-app";

interface ForceGraphProps {
  graph: KnowledgeGraphData;
  // Told what the hover is now, so a hover the graph does not own — one the
  // note list drives — can be shown in the list too. Optional: the graph is
  // still a complete hover surface on its own.
  onHoverChange?: (noteId: string | null) => void;
  // The note the page has taken the Focus on. A change to a note flies the
  // camera to frame it with its neighbours, and the note keeps the emphasis a
  // hover would give it until the focus ends. Null is the page saying the focus
  // is over: the emphasis goes away and the camera stays exactly where the
  // dismissal found it — a dismissal is not a reason to reframe the graph.
  focusedNote?: string | null;
  // The focus is over, and not because the page said so: the visitor took the
  // camera, or a fresh graph no longer holds the note. The page is the owner of
  // the focus, so it is told rather than left believing in a note the graph is
  // no longer showing.
  onFocusClear?: () => void;
  // A node was clicked, which is the visitor asking for that note's Focus — or,
  // when the node already holds it, is the click that lets it go (reported
  // through onFocusClear like any other ending). The renderer decides which,
  // because it is the one that knows what is focused; the page still owns the
  // state, and the camera that answers this is the same flight a row's click
  // gets.
  onFocusTake?: (noteId: string) => void;
  // The graph is drawn and framed: the layout has been run to rest, the camera
  // has fitted it, and there is a picture rather than a blank box. The page
  // shows its loading state until it is told so.
  onReady?: () => void;
  // React 19 hands `ref` to a function component as an ordinary prop, so this
  // needs no forwardRef wrapper — which matters, because a wrapper would sit
  // outside the memo below and let every page render through.
  ref?: Ref<ForceGraphHandle>;
}

// What the note list drives: the renderer's hover, set from outside it. The
// list owns no hover state of its own — it says which note is hovered and the
// renderer does the rest, so the list and the graph cannot end up emphasizing
// two different notes.
export interface ForceGraphHandle {
  setHoveredNote(noteId: string | null): void;
  // The layout around the graph changed shape — the note panel collapsed or
  // opened — so the camera is put back where the viewer left it: the graph
  // point that was at the centre of the viewport, at the zoom they are
  // holding, moved to the centre of the one that replaces it.
  reanchorViewport(): void;
}

type GraphNode = KnowledgeGraphNode & d3.SimulationNodeDatum;
type GraphLink = KnowledgeGraphEdge & d3.SimulationLinkDatum<GraphNode> & { source: GraphNode; target: GraphNode };

// The subset of FederatedPointerEvent the sprite handlers touch, so the press
// and hover handlers are typed instead of duck-cast to an inline shape.
//
// A press reads only where the pointer is and which button it was: it
// deliberately has no handle on preventDefault or stopPropagation, because a
// press is meant to be inert — see startPress.
type NodePointerEvent = Pick<FederatedPointerEvent, "client" | "button">;

// Opacity a backgrounded node's sprite and its DOM label both fade to. One
// value, so a dot and its name cannot disagree about how dim "dimmed" is.
const DIMMED_ALPHA = 0.15;

// The steps the layout is run for before it is ever drawn — d3's own cooling at
// its default decay (alpha 1 toward alphaMin 0.001 by ~0.0228 a step), so the
// layout on screen is the one the timer would have arrived at, arrived at with
// nothing watching. Fixed rather than run until alpha falls below alphaMin,
// because that is the same number every time and a loop on alpha would spin
// forever on a simulation that reports a resting alpha it never moves off.
const SETTLE_STEPS = 300;
// How much of each frame those steps may take. A few hundred bare ticks are
// tens of milliseconds on a small graph and nearer a second on a large one, so
// the run is sliced by time rather than by a step count — the page stays
// responsive and the wait scales with the graph instead of with the frame rate.
const SETTLE_FRAME_BUDGET_MS = 8;

// Runs a fresh simulation to rest by hand. `simulation.tick()` steps the forces
// without firing the tick handler, so the run costs no sprite writes and no
// label positioning — the one render of the resting layout happens after it,
// and nothing of the run is ever drawn.
function settleLayout(
  simulation: { tick(): unknown },
  cancelled: () => boolean
): Promise<void> {
  return new Promise((resolve) => {
    let stepped = 0;
    const step = () => {
      if (cancelled()) return resolve();
      const until = performance.now() + SETTLE_FRAME_BUDGET_MS;
      do {
        simulation.tick();
        stepped += 1;
      } while (stepped < SETTLE_STEPS && performance.now() < until);
      if (stepped >= SETTLE_STEPS) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function cssVarToPixiColor(varName: string, PIXI: typeof import("pixi.js")): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  // A 2D canvas context accepts any CSS color (oklch, lab, hsl, hex, named…)
  // and lets us read the exact RGB it resolves to — `getComputedStyle().color`
  // serializes to `lab(...)` in modern browsers, which PIXI.Color cannot parse.
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = raw || "black";
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return (r << 16) | (g << 8) | b;
  }
  // jsdom has no 2D canvas, but it serializes computed colors as rgb(...),
  // which PIXI.Color can parse.
  const probe = document.createElement("div");
  probe.style.color = raw || "black";
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  return new PIXI.Color(rgb).toNumber();
}

function mixColors(c1: number, c2: number, t: number): number {
  const r1 = (c1 >> 16) & 255;
  const g1 = (c1 >> 8) & 255;
  const b1 = c1 & 255;
  const r2 = (c2 >> 16) & 255;
  const g2 = (c2 >> 8) & 255;
  const b2 = c2 & 255;
  const r = Math.round(r1 * (1 - t) + r2 * t);
  const g = Math.round(g1 * (1 - t) + g2 * t);
  const b = Math.round(b1 * (1 - t) + b2 * t);
  return (r << 16) | (g << 8) | b;
}

// The prop is one graph object per snapshot, and its identity is the contract:
// the page hands over a payload it never rebuilds, so comparing that one object
// is comparing snapshots. Without the memo, every re-render of the page — the
// countdown tick among them — would reconcile one DOM label per node to change
// a number in a badge. Internal state (hover, the label threshold) re-renders
// it as usual, and `memo` does not block context updates, so the theme still
// reaches it.
export const ForceGraph = memo(function ForceGraph({
  graph,
  onHoverChange,
  focusedNote,
  onFocusClear,
  onFocusTake,
  onReady,
  ref,
}: ForceGraphProps) {
  const { nodes, edges } = graph;
  const focused = focusedNote ?? null;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const app = usePixiApp(wrapperRef);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showAllLabels, setShowAllLabels] = useState(false);
  // The report is called from outside React's render cycle — from pointer
  // handlers and from the imperative setter — so it is read through a ref and
  // never re-creates the setters that call it. Written in an effect rather than
  // during render: a render React discards would otherwise leave the ref
  // holding a callback from a pass that never committed.
  const onHoverChangeRef = useRef(onHoverChange);
  useEffect(() => {
    onHoverChangeRef.current = onHoverChange;
  }, [onHoverChange]);
  // The focus is ended from outside React's render cycle too — by the zoom
  // gesture — so the report is reached the same way.
  const onFocusClearRef = useRef(onFocusClear);
  useEffect(() => {
    onFocusClearRef.current = onFocusClear;
  }, [onFocusClear]);
  // And taken by a gesture that ends outside React's cycle too — a pointerup on
  // the document, which is no longer anywhere near the render that set it.
  const onFocusTakeRef = useRef(onFocusTake);
  useEffect(() => {
    onFocusTakeRef.current = onFocusTake;
  }, [onFocusTake]);
  // And the readiness report comes from the build, which is async and reaches
  // it long after the render that set it.
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  const labelRef = useRef<HTMLDivElement>(null);
  const labelElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  // Mirrors showAllLabels for the pointer/tick/zoom callbacks. Those run outside
  // React's render cycle, and the label layer has to be positioned in the same
  // zoom event that flips the flag — before the state change commits.
  //
  // Starts false rather than derived from LABEL_ZOOM_THRESHOLD: at mount no
  // transform has been applied yet, so k is still the placeholder 1 and would
  // read as "past the threshold" at a threshold of 1 — flashing every label on
  // before the first tick frames the graph. The threshold is re-evaluated the
  // moment a transform lands, including the programmatic fit, so the flag is
  // correct within the first frame.
  const showAllLabelsRef = useRef(false);

  const graphNodes = useMemo<GraphNode[]>(() => nodes.map((node) => ({ ...node })), [nodes]);
  const graphEdges = useMemo(() => edges.map((edge) => ({ ...edge })), [edges]);
  const degrees = useMemo(() => computeDegrees(graphNodes, graphEdges), [graphNodes, graphEdges]);

  // The emphasis rule, for the label layer. applyHover computes the same map
  // from the pointer handlers, which run before React has committed the state
  // change — one rule, called from the two places that need it.
  //
  // A focus is drawn exactly as a hover is: the focused note keeps the emphasis
  // the pointer would have given it, so both read one id — the pointer's while
  // there is one, the focused note's otherwise.
  const emphasizedId = hoveredId ?? focused;
  const emphasis = useMemo(
    () => computeNodeEmphasis(graphNodes, graphEdges, emphasizedId),
    [graphNodes, graphEdges, emphasizedId]
  );

  const simulationRef = useRef<d3.Simulation<GraphNode, undefined> | null>(null);
  const nodesByIdRef = useRef<Map<string, GraphNode>>(new Map());
  const nodeRadiusRef = useRef<Map<string, number>>(new Map());
  // Radius the shared node circle texture was rasterized at; applyHover needs it
  // to compute sprite scale, and it is only known once the scene is built.
  const textureRadiusRef = useRef<number>(NODE_BASE_RADIUS);
  const incidentLinksRef = useRef<Map<string, GraphLink[]>>(new Map());
  const nodeSpritesRef = useRef<Map<string, import("pixi.js").Sprite>>(new Map());
  const linkSpritesRef = useRef<Map<GraphLink, import("pixi.js").Sprite>>(new Map());
  const worldContainerRef = useRef<import("pixi.js").Container | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  // The focus the graph is drawing, which is the prop except when the graph has
  // been told the focus is over ahead of the page: the take-over in the zoom
  // gesture clears it the moment it happens rather than a re-render later, so
  // nothing emphasizes a note the visitor has just panned away from.
  const drawnFocusRef = useRef<string | null>(null);
  const dragNodeRef = useRef<GraphNode | null>(null);
  // The press that is down right now, if one is: the node under the pointer, and
  // where the pointer landed — in graph coordinates, through the zoom transform
  // the press began in. Held for the whole gesture, because a release cannot be
  // judged a click or a drag without knowing where it came from, and cleared the
  // moment it is judged either way.
  //
  // It is also what the camera's filter is told about: a press is a camera
  // gesture's veto, and the veto has to be in place before d3 is offered the
  // gesture.
  const pressRef = useRef<{
    node: GraphNode;
    point: { x: number; y: number };
    transform: { x: number; y: number; k: number };
  } | null>(null);
  // The gesture's own detach: endGesture for a release, and its cancel for a
  // teardown that takes the node away mid-gesture.
  const pressCleanupRef = useRef<(() => void) | null>(null);
  // The camera, and the Pixi app the camera's viewport change has to resize
  // before it moves. Both are read by ref because both outlive any one render:
  // the camera is created once per mount and fires from outside React's cycle,
  // and the app arrives asynchronously after it.
  const cameraRef = useRef<Camera | null>(null);
  const appRef = useRef<import("pixi.js").Application | null>(null);
  const colorsRef = useRef({ node: 0, hover: 0, link: 0, leaf: 0 });

  // Screen position for a node's label, in wrapper coordinates. Labels live in
  // DOM space rather than inside the zoomed Pixi world, so the text stays a
  // fixed 12px however far the graph is zoomed.
  //
  // The transform is the camera's own, read live rather than mirrored into a
  // ref here: there is one copy of it, and it is the one the world is drawn
  // through. The identity stands in for the frame before the camera exists —
  // nothing is positioned before then.
  const labelScreenPosition = useCallback((node: GraphNode) => {
    const transform = cameraRef.current?.transform ?? { x: 0, y: 0, k: 1 };
    const radius = nodeRadiusRef.current.get(node.id) ?? NODE_BASE_RADIUS;
    return {
      x: (node.x ?? 0) * transform.k + transform.x,
      y: (node.y ?? 0) * transform.k + transform.y + radius + 6,
    };
  }, []);

  const positionLabel = useCallback(() => {
    const label = labelRef.current;
    const hovered = hoveredIdRef.current;
    if (!label || hovered === null) return;
    // With every label drawn, the layer already shows this node's name — the
    // tooltip would only stack the same text on top of it.
    if (showAllLabelsRef.current) return;
    const node = nodesByIdRef.current.get(hovered);
    if (!node || node.x === undefined || node.y === undefined) return;
    const { x, y } = labelScreenPosition(node);
    label.style.transform = `translate3d(${x}px, ${y}px, 0) translateX(-50%)`;
  }, [labelScreenPosition]);

  // Positions the whole label layer. Skipped while zoomed out, so the hot
  // per-tick path stays O(1) — the layout is run to rest before it is drawn and
  // opens framed to fit, which is well short of the zoom the labels appear at.
  const positionAllLabels = useCallback(() => {
    if (!showAllLabelsRef.current) return;
    const nodesById = nodesByIdRef.current;
    for (const [id, el] of labelElsRef.current) {
      const node = nodesById.get(id);
      if (!node || node.x === undefined || node.y === undefined) continue;
      const { x, y } = labelScreenPosition(node);
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translateX(-50%)`;
    }
  }, [labelScreenPosition]);

  const updateLinkSprite = useCallback(
    (sprite: import("pixi.js").Sprite, source: GraphNode, target: GraphNode) => {
      const x1 = source.x ?? 0;
      const y1 = source.y ?? 0;
      const x2 = target.x ?? 0;
      const y2 = target.y ?? 0;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 0.001;
      sprite.x = x1;
      sprite.y = y1;
      sprite.width = len;
      sprite.rotation = Math.atan2(dy, dx);
    },
    []
  );

  // Paints every sprite for one hover state. The pointer handlers call this with
  // the id they are moving to rather than reading the render-time map: they run
  // outside React's render cycle, and the sprites have to update within the same
  // gesture, before the state change commits. So it computes the emphasis itself
  // — the same function, and so the same rule, the labels are styled from.
  //
  // A hover that has just ended falls back to the focused note, which is the
  // whole of "the focus keeps its emphasis": the pointer comes and goes, the
  // focus stays on at the end of the gesture.
  const applyHover = useCallback(
    (hovered: string | null) => {
      const emphasized = hovered ?? drawnFocusRef.current;
      const states = computeNodeEmphasis(graphNodes, graphEdges, emphasized);
      const colors = colorsRef.current;
      const radii = nodeRadiusRef.current;

      for (const [id, sprite] of nodeSpritesRef.current) {
        // Sprites are built from these same nodes, so the map never misses.
        const state = states.get(id);
        if (!state) continue;
        const baseScale = (radii.get(id) ?? NODE_BASE_RADIUS) / textureRadiusRef.current;
        sprite.tint =
          state.hover === "hovered"
            ? colors.hover
            : state.role === "leaf"
              ? colors.leaf
              : colors.node;
        sprite.alpha = state.hover === "dimmed" ? DIMMED_ALPHA : 1;
        sprite.scale.set(baseScale * (state.hover === "hovered" ? NODE_HOVER_SCALE : 1));
      }

      // Links have no emphasis of their own — incident ones light up, the rest
      // fade back — and only these sprites read it, so the rule stays here.
      for (const [link, sprite] of linkSpritesRef.current) {
        const isIncident =
          emphasized !== null &&
          (link.source.id === emphasized || link.target.id === emphasized);
        sprite.tint = isIncident ? colors.hover : colors.link;
        sprite.alpha = emphasized === null ? 0.15 : isIncident ? 1 : 0.08;
      }
    },
    [graphNodes, graphEdges]
  );

  // The painter, for the callbacks that outlive any one graph: the zoom gesture
  // that ends a focus owes the sprites a repaint, and it may not be re-created
  // every time the graph is.
  const applyHoverRef = useRef(applyHover);
  useEffect(() => {
    applyHoverRef.current = applyHover;
  }, [applyHover]);

  // Moves the hover. The only way in: the sprite handlers call it from the
  // pointer, the imperative handle calls it from the note list, and a rebuild
  // calls it to clear. One entry point is what keeps the ref, React's state,
  // the painted sprites and the note list from disagreeing about what is
  // hovered — and the ref is written first because the painter and the label
  // layer read it before React has committed anything.
  const setHovered = useCallback(
    (noteId: string | null) => {
      hoveredIdRef.current = noteId;
      setHoveredId(noteId);
      applyHover(noteId);
      positionLabel();
      onHoverChangeRef.current?.(noteId);
    },
    [applyHover, positionLabel]
  );

  // The layout around the graph changed, so the viewer's centre is put back —
  // what that means, and why it is not gated the way a fit is, is the camera's
  // (see Camera.reanchor). The renderer's share is only to know when it is
  // owed: a layout that left the viewport alone — the note list's overlay,
  // which sits above the graph rather than beside it — asks for nothing, and
  // so does not call this.
  const reanchorViewport = useCallback(() => {
    cameraRef.current?.reanchor();
  }, []);

  useImperativeHandle(
    ref,
    () => ({ setHoveredNote: setHovered, reanchorViewport }),
    [setHovered, reanchorViewport]
  );

  // Ends the focus the graph is drawing, and reports it to the page that owns
  // it. Stable, so the camera can hold onto it across every rebuild: the hover,
  // the painter and the report are all reached through refs.
  //
  // The camera's claim is dropped here rather than left to the page's own
  // round-trip: this is called the moment the focus ends — by the visitor's
  // hand on the camera, and by a click releasing the note it holds — and until
  // the page has been told and rendered, a camera still claiming the note would
  // refuse a settled fit and re-fly a note that has just been let go of.
  const clearFocus = useCallback(() => {
    if (drawnFocusRef.current === null) return;
    drawnFocusRef.current = null;
    cameraRef.current?.setFocus(null);
    applyHoverRef.current(hoveredIdRef.current);
    onFocusClearRef.current?.();
  }, []);

  // A press on a node. Deliberately inert: it pins nothing, arms nothing, moves
  // no camera and heats no simulation up. What it does is remember where the
  // pointer went down, so that the release can be judged — the drag the graph
  // has always had if the hand travelled, and otherwise the same click the
  // note's own row in the list answers.
  //
  // Nothing is cancelled or stopped here, and that is load-bearing rather than
  // an omission. The browser reaches d3 through the compatibility mouse events
  // that follow this one, and d3 arms its pan from the `mousedown`: cancelling
  // the press suppresses those events entirely, which would leave the zoom
  // filter below with no camera gesture it could ever refuse.
  const startPress = useCallback(
    (event: NodePointerEvent, node: GraphNode) => {
      // The left button only. Buttons are a bitmask and pointerdown reports the
      // one that changed, so this is "an ordinary press": a right-click opens a
      // menu rather than taking a focus, and the middle button is the browser's.
      if (event.button !== 0) return;
      // One press at a time — a second pointer (or a second button) landing on
      // another node mid-gesture is not a new gesture.
      if (pressRef.current) return;

      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      // The transform is read once, at the press, and reused for the whole
      // gesture: the node has to track the pointer through the view the gesture
      // started in even if a zoom lands mid-drag, and the slop — a distance on
      // screen — is measured through the same view.
      const rect = wrapper.getBoundingClientRect();
      const transform = cameraRef.current?.transform ?? { x: 0, y: 0, k: 1 };
      pressRef.current = {
        node,
        point: graphPointFromClient(event.client.x, event.client.y, rect, transform),
        transform,
      };
      // The veto goes up with the press. The browser reaches d3 through the
      // compatibility mouse events that follow this one, and this ran first, so
      // the camera is already refusing by the time d3 asks.
      cameraRef.current?.setPressed(true);

      // Everything a drag does once it is one: the node leaves the simulation
      // for the pointer, and the links reaching it are redrawn behind it.
      const moveDragged = (point: { x: number; y: number }) => {
        const dragged = dragNodeRef.current;
        if (!dragged) return;
        dragged.fx = point.x;
        dragged.fy = point.y;
        dragged.x = point.x;
        dragged.y = point.y;

        const sprite = nodeSpritesRef.current.get(dragged.id);
        if (sprite) {
          sprite.x = point.x;
          sprite.y = point.y;
        }
        const incident = incidentLinksRef.current.get(dragged.id);
        if (incident) {
          for (const link of incident) {
            const linkSprite = linkSpritesRef.current.get(link);
            if (linkSprite) updateLinkSprite(linkSprite, link.source, link.target);
          }
        }
        positionLabel();
        positionAllLabels();

        const sim = simulationRef.current;
        if (sim && sim.alpha() < 0.1) sim.alphaTarget(0.3).restart();
      };

      const handleMove = (e: PointerEvent) => {
        const press = pressRef.current;
        if (!press) return;
        const moved = graphPointFromClient(e.clientX, e.clientY, rect, press.transform);

        if (!dragNodeRef.current) {
          // Still a click: the hand has not travelled far enough from where it
          // went down to mean anything else. Measured against the press rather
          // than against the last move, so a slow drift of a pixel at a time
          // still counts as the pointer having stayed put.
          if (!isDragGesture(press.point, moved, press.transform)) return;
          // It is a drag now, and only now does the graph come alive: a click
          // must leave a settled layout settled.
          dragNodeRef.current = press.node;
          simulationRef.current?.alphaTarget(0.3).restart();
        }
        moveDragged(moved);
      };

      // The whole of what a release means. `clicked` says the pointer never
      // travelled — the press is over without ever having been a drag.
      const endGesture = (clicked: boolean) => {
        const press = pressRef.current;
        const dragged = dragNodeRef.current;
        pressRef.current = null;
        cameraRef.current?.setPressed(false);
        dragNodeRef.current = null;
        pressCleanupRef.current = null;
        if (dragged) {
          dragged.fx = undefined;
          dragged.fy = undefined;
          simulationRef.current?.alphaTarget(0);
        }
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);
        document.removeEventListener("pointercancel", handleCancel);

        if (!clicked || !press) return;
        // The press was a click, and the graph decides what it means, because
        // the graph is what knows whether this note holds the focus: the
        // focused note's own click is the click that lets it go, and every
        // other note's takes it. The page is told either way — it owns the
        // focus, and the camera that answers a take is the page's own flight,
        // the same one a row's click gets.
        if (press.node.id === drawnFocusRef.current) clearFocus();
        else onFocusTakeRef.current?.(press.node.id);
      };

      // A press that never travelled is a click; one that has already become a
      // drag is released, not clicked.
      const handleUp = () => endGesture(dragNodeRef.current === null);
      // The browser taking the pointer away — a scroll, a context menu, the
      // window losing it. Not a click: nothing was released over the node.
      const handleCancel = () => endGesture(false);

      // Tracked so a rebuild/unmount mid-gesture can still detach the listeners;
      // the cancel path is idempotent for the no-longer-pressed case.
      pressCleanupRef.current = handleCancel;
      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
      document.addEventListener("pointercancel", handleCancel);
    },
    [updateLinkSprite, positionLabel, positionAllLabels, clearFocus]
  );

  // The camera, created once per mount and held for the life of the graph.
  // Declared above the build and focus effects because both reach it: the build
  // hands over each snapshot's layout, and the focus effect hands over the note
  // the page has taken.
  //
  // Its callbacks fire outside React's render cycle — from a wheel, a pointer,
  // a transition's frame — so everything they touch is reached through a ref or
  // is stable across every render.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const camera = createCamera(wrapper, {
      onTransformChange: (transform, by) => {
        // The world is what the camera moves, but it is Pixi's to draw — the
        // camera knows the transform, not the scene wearing it.
        const world = worldContainerRef.current;
        if (world) {
          world.position.set(transform.x, transform.y);
          world.scale.set(transform.k);
        }

        // Flip the all-labels mode only on a crossing, not on every zoom frame
        // — the ref is updated first so the positioning below happens in this
        // same event, with the labels already in place as they fade in.
        const pastThreshold = transform.k >= LABEL_ZOOM_THRESHOLD;
        if (pastThreshold !== showAllLabelsRef.current) {
          showAllLabelsRef.current = pastThreshold;
          setShowAllLabels(pastThreshold);
        }

        // The visitor's hand on the camera ends the focus wherever it is: the
        // note list must not go on claiming a note they have panned away from.
        // A transition the graph itself runs is not their hand, and must not
        // read as one.
        if (by === "gesture") clearFocus();

        positionLabel();
        positionAllLabels();
      },
      // The surface grows into the viewport before the camera moves into it.
      // Reached by ref because the Pixi app arrives asynchronously, after the
      // camera that was built without it.
      onViewportChange: () => appRef.current?.resize(),
    });

    cameraRef.current = camera;
    return () => {
      camera.destroy();
      cameraRef.current = null;
    };
  }, [clearFocus, positionLabel, positionAllLabels]);

  // The Pixi app, for the callbacks that need the surface rather than the
  // camera's copy of its size.
  useEffect(() => {
    appRef.current = app;
  }, [app]);

  // Build the Pixi scene and d3-force simulation once per data set.
  useEffect(() => {
    if (!app || graphNodes.length === 0) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const { clientWidth, clientHeight } = wrapper;
    // What there is to frame, and the viewport it is framed in — the one a
    // later layout change is measured from. The edges are the string-keyed ones
    // rather than the simulation's resolved links: the focus framing needs the
    // neighbours of a note by id, not the node objects.
    cameraRef.current?.setLayout(graphNodes, graphEdges);

    const teardownWorld = () => {
      // A gesture in the air when the world it was pressing goes away: the
      // listeners have to come off with it, and the node it was holding is
      // about to stop existing.
      pressCleanupRef.current?.();
      simulationRef.current?.stop();
      simulationRef.current = null;
      const world = worldContainerRef.current;
      if (world) {
        // On unmount, usePixiApp's cleanup destroys the Application before this
        // effect's cleanup runs. Application.destroy() nulls app.stage and has
        // already destroyed the world (children + textures) along with the
        // stage, so guard against dereferencing the nulled stage.
        if (app?.stage) {
          app.stage.removeChild(world);
          world.destroy({ children: true, texture: true });
        }
        worldContainerRef.current = null;
      }
      nodeSpritesRef.current = new Map();
      linkSpritesRef.current = new Map();
    };

    let cancelled = false;
    const build = async () => {
      const PIXI = await import("pixi.js");
      if (cancelled) return;

      const node = cssVarToPixiColor("--primary", PIXI);
      const bg = cssVarToPixiColor("--background", PIXI);
      colorsRef.current = {
        node,
        hover: cssVarToPixiColor("--claude-orange", PIXI),
        link: cssVarToPixiColor("--foreground", PIXI),
        // Leaf nodes are tinted a darker, muted shade of the node colour so
        // they read as distinct from hubs but stay in the same palette.
        leaf: mixColors(node, bg, 0.7),
      };

      // The effect cleanup tears the previous world down on rebuild; this call
      // is defensive for the async gap between a cancelled build and the next.
      teardownWorld();
      // A fresh snapshot replaces every sprite, so a hover carried over from
      // the last one would point at nodes that are gone — and would leave the
      // note list marking a row the graph no longer emphasizes.
      setHovered(null);
      dragNodeRef.current = null;
      pressRef.current = null;
      // A press the last world was in the middle of is gone with it, and the
      // camera's veto has to go with it too — a veto left standing refuses
      // every gesture there is.
      cameraRef.current?.setPressed(false);

      const world = new PIXI.Container();
      worldContainerRef.current = world;
      app.stage.addChild(world);
      // The layout is about to be run to rest in here, and the world is already
      // in the scene: shown only once that run is over, so nothing is drawn at
      // the seed positions the run is moving away from.
      world.visible = false;

      const linksContainer = new PIXI.Container();
      const nodesContainer = new PIXI.Container();
      world.addChild(linksContainer);
      world.addChild(nodesContainer);

      // The simulation mutates these in place; graphNodes/graphEdges are the
      // memoized clones of the props, so the props themselves are never touched.
      const simNodes: GraphNode[] = graphNodes;
      const nodesById = new Map(simNodes.map((node) => [node.id, node]));

      // Rasterize the shared circle at (at least) the worst-case on-screen
      // size — the largest node magnified by max zoom × hover — so sprites are
      // never scaled past native pixel detail and their edges stay smooth when
      // zoomed in.
      const textureRadius = computeNodeTextureRadius(simNodes, degrees);
      textureRadiusRef.current = textureRadius;
      const circleGraphics = new PIXI.Graphics();
      circleGraphics.circle(0, 0, textureRadius).fill(0xffffff);
      const circleTexture = app.renderer.generateTexture(circleGraphics);
      circleGraphics.destroy();
      nodesByIdRef.current = nodesById;

      const simLinks: GraphLink[] = graphEdges.map(
        (edge) =>
          ({
            source: nodesById.get(edge.source)!,
            target: nodesById.get(edge.target)!,
          }) as GraphLink
      );

      // Drag needs the links incident to one node — the hover rule builds its
      // own adjacency, so this loop only indexes links.
      const incident = new Map<string, GraphLink[]>();
      for (const link of simLinks) {
        const fromSource = incident.get(link.source.id) ?? [];
        fromSource.push(link);
        incident.set(link.source.id, fromSource);
        const fromTarget = incident.get(link.target.id) ?? [];
        fromTarget.push(link);
        incident.set(link.target.id, fromTarget);
      }
      incidentLinksRef.current = incident;

      // The resting emphasis — nothing hovered yet. Only the leaf/hub role is
      // read here, to tint the sprites as they are built.
      const restStates = computeNodeEmphasis(simNodes, graphEdges, null);

      const nodeSprites = new Map<string, import("pixi.js").Sprite>();
      const nodeRadii = new Map<string, number>();
      for (const node of simNodes) {
        const degree = degrees.get(node.id) ?? 0;
        const radius = nodeRadius(degree);
        nodeRadii.set(node.id, radius);
        const sprite = new PIXI.Sprite(circleTexture);
        sprite.label = node.id;
        sprite.anchor.set(0.5);
        sprite.eventMode = "static";
        sprite.cursor = "pointer";
        sprite.scale.set(radius / textureRadius);
        sprite.tint =
          restStates.get(node.id)!.role === "leaf"
            ? colorsRef.current.leaf
            : colorsRef.current.node;
        sprite.alpha = 1;
        nodesContainer.addChild(sprite);
        nodeSprites.set(node.id, sprite);

        sprite.on("pointerover", (e: FederatedPointerEvent) => {
          e.stopPropagation();
          if (dragNodeRef.current?.id === node.id) return;
          setHovered(node.id);
        });
        sprite.on("pointerout", (e: FederatedPointerEvent) => {
          e.stopPropagation();
          if (dragNodeRef.current?.id === node.id) return;
          setHovered(null);
        });
        sprite.on("pointerdown", (e: FederatedPointerEvent) => {
          startPress(e, node);
        });
      }
      nodeSpritesRef.current = nodeSprites;
      nodeRadiusRef.current = nodeRadii;

      const linkSprites = new Map<GraphLink, import("pixi.js").Sprite>();
      for (const link of simLinks) {
        const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        sprite.label = `${link.source.id}->${link.target.id}`;
        sprite.anchor.set(0, 0.5);
        sprite.height = 1;
        sprite.tint = colorsRef.current.link;
        sprite.alpha = 0.15;
        linksContainer.addChild(sprite);
        linkSprites.set(link, sprite);
      }
      linkSpritesRef.current = linkSprites;

      const simulation = d3
        .forceSimulation<GraphNode>(simNodes)
        .force(
          "link",
          d3.forceLink<GraphNode, GraphLink>(simLinks).id((d: GraphNode) => d.id).distance(60)
        )
        .force("charge", d3.forceManyBody().strength(-120))
        .force("center", d3.forceCenter(clientWidth / 2, clientHeight / 2))
        .force("x", d3.forceX<GraphNode>(clientWidth / 2).strength(0.06))
        .force("y", d3.forceY<GraphNode>(clientHeight / 2).strength(0.06))
        .force(
          "collide",
          d3.forceCollide<GraphNode>().radius((d: GraphNode) => nodeRadiusRef.current.get(d.id) ?? NODE_BASE_RADIUS)
        );
      simulationRef.current = simulation;
      // The timer d3 started with the simulation would otherwise run alongside
      // the run below, drawing the whole layout on every frame of it. A drag
      // restarts the simulation when it wants the forces again.
      simulation.stop();

      // Draws the layout where the simulation has it. The sprite maps are the
      // only record of what was drawn: they were built in the sim data's own
      // order, and each sprite is keyed by the node or link it stands for.
      const renderLayout = () => {
        for (const [id, sprite] of nodeSprites) {
          const node = nodesById.get(id);
          if (!node) continue;
          sprite.x = node.x ?? 0;
          sprite.y = node.y ?? 0;
        }
        for (const [link, sprite] of linkSprites) {
          updateLinkSprite(sprite, link.source, link.target);
        }
        positionLabel();
        positionAllLabels();
      };

      // A drag reheats the layout and the graph redraws where it moved to. The
      // camera is deliberately not told: it framed the layout once, and a graph
      // the forces are nudging is not a camera the viewer is moving.
      simulation.on("tick", renderLayout);

      await settleLayout(simulation, () => cancelled);
      if (cancelled) return;

      renderLayout();
      // The one framing the camera makes of its own accord, in the same turn as
      // the first draw of the layout it frames — so the graph is never seen
      // outside its frame, and never moves after it.
      cameraRef.current?.layoutReady();
      world.visible = true;
      onReadyRef.current?.();
    };

    build();

    return () => {
      cancelled = true;
      teardownWorld();
    };
  }, [app, graphNodes, graphEdges, degrees, applyHover, positionLabel, positionAllLabels, startPress, updateLinkSprite, setHovered, clearFocus]);

  // A double-click on a node is the two clicks on that note that made it, and
  // the zoom d3 would read into it is not one of them. The graph zooms where
  // the visitor double-clicked past the nodes, and focuses where they
  // double-clicked a note — one gesture, two surfaces, each with its own
  // meaning.
  //
  // Over a node is what tells the two apart, and the hover is already the
  // answer to that: a pointer that has not left the node it entered is a
  // pointer over that node, whatever the click count says.
  //
  // Capture phase because d3's own dblclick handler is on this same wrapper and
  // stops immediate propagation on the way past: a bubble-phase listener here
  // would never run at all.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const consumeDblclick = (event: MouseEvent) => {
      if (hoveredIdRef.current === null) return;
      event.preventDefault();
      event.stopPropagation();
    };

    wrapper.addEventListener("dblclick", consumeDblclick, true);
    return () => wrapper.removeEventListener("dblclick", consumeDblclick, true);
  }, []);

  // The Focus: fly the camera to frame the note with its neighbours, and hold
  // the note's emphasis for as long as the focus lasts.
  //
  // The flight itself is the camera's — what the renderer owns is the drawing
  // of the focus and the page's belief in it, and whether the graph can show
  // the note at all.
  useEffect(() => {
    // A focus the graph cannot show is no focus at all — a snapshot that no
    // longer holds the note, or a layout with no position for it. The emphasis
    // follows the graph rather than the prop, so it is never drawn for a note
    // that is not on screen, and the page is told so that the focus it believes
    // in ends rather than lingering as state nothing on the page agrees with.
    // Quietly: the camera stays where the visitor had it.
    const held =
      focused !== null && graphNodes.some((node) => node.id === focused);
    drawnFocusRef.current = held ? focused : null;
    applyHover(hoveredIdRef.current);

    if (!held && focused !== null) onFocusClearRef.current?.();

    // The camera is told either way: a note it is given is one to fly to (or,
    // for a note it has already flown to, one to leave to the settle), and a
    // dismissal is one it must not reframe for.
    cameraRef.current?.setFocus(held ? focused : null);
    // `app` is here because the flight needs positions the layout has given —
    // a row can be clicked before Pixi has loaded and the simulation has laid
    // the graph out, and the focus must be flown once it has rather than being
    // dropped on the floor.
  }, [focused, graphNodes, graphEdges, applyHover, app]);

  return (
    <div
      ref={wrapperRef}
      // `flex-1 min-w-0` rather than `w-full`: the wrapper shares its row with
      // the note list, and a fixed `width: 100%` would ignore the sibling's
      // share of it.
      //
      // The canvas is taken out of the wrapper's flow for the same reason, and
      // it is load-bearing rather than tidiness: pixi sizes it with an explicit
      // width, and a width the wrapper cannot shrink below is a wrapper the row
      // cannot shrink below — so a surface still the width of the viewport the
      // graph had a moment ago would widen the page around it instead of being
      // clipped by the box it is drawn in.
      className="relative h-full min-w-0 flex-1 overflow-hidden touch-none [&>canvas]:absolute [&>canvas]:top-0 [&>canvas]:left-0"
      data-testid="kg-graph-wrapper"
    >
      {/* One label per node, drawn from the start so crossing the zoom
          threshold only has to toggle opacity — the labels are already
          positioned by the time they fade in. Positioned in DOM space rather
          than the zoomed Pixi world, so the text holds a fixed 12px. */}
      <div
        data-testid="kg-label-layer"
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-10 transition-opacity ${
          showAllLabels ? "opacity-100" : "opacity-0"
        }`}
      >
        {nodes.map((node) => {
          const state = emphasis.get(node.id)!;
          const isHovered = state.hover === "hovered";
          return (
            <div
              key={node.id}
              data-node-id={node.id}
              ref={(el) => {
                if (el) labelElsRef.current.set(node.id, el);
                else labelElsRef.current.delete(node.id);
              }}
              // Only the opacity is React's; style.transform is written directly
              // by the positioning loop, and React leaves keys it was never
              // given alone when it reconciles this style object.
              style={{ opacity: state.hover === "dimmed" ? DIMMED_ALPHA : 1 }}
              // Titles run up to ~70 characters, which as a single line would
              // stretch several hundred pixels across the graph; the max width
              // wraps them under their node instead. The cap is in DOM pixels
              // because this layer is not zoomed.
              className={`absolute left-0 top-0 max-w-[11rem] text-center text-xs leading-tight font-medium wrap-break-word [text-shadow:0_0_3px_var(--background),0_0_3px_var(--background)] ${
                isHovered ? "text-primary" : "text-foreground/80"
              }`}
            >
              {node.id}
            </div>
          );
        })}
      </div>

      {/* Always mounted so positionLabel() (called from pointerover before any
          React commit) always finds the element; visibility is CSS-gated. */}
      <div
        ref={labelRef}
        data-testid="kg-node-label"
        aria-hidden={hoveredId === null || showAllLabels}
        // Wraps on the same terms as the zoomed-in labels: it draws the same
        // string, and as one line a long title would overflow the clipped
        // wrapper instead of staying readable.
        className={`pointer-events-none absolute left-0 top-0 z-10 max-w-[11rem] text-center text-xs leading-tight font-medium text-primary wrap-break-word transition-opacity [text-shadow:0_0_3px_var(--background),0_0_3px_var(--background)] ${
          hoveredId === null || showAllLabels ? "opacity-0" : "opacity-100"
        }`}
      >
        {hoveredId === null ? "" : hoveredId}
      </div>
    </div>
  );
});
