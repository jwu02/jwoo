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
  graphPointFromClient,
  LABEL_ZOOM_THRESHOLD,
  NODE_BASE_RADIUS,
  NODE_HOVER_SCALE,
  NODE_MAX_ZOOM,
  NODE_MIN_ZOOM,
  nodeRadius,
  type FitPlan,
  type FitTrigger,
  planFit,
} from "@/lib/knowledge-graph/graph-data";
import { usePixiApp } from "./use-pixi-app";

interface ForceGraphProps {
  graph: KnowledgeGraphData;
  // Told what the hover is now, so a hover the graph does not own — one the
  // note list drives — can be shown in the list too. Optional: the graph is
  // still a complete hover surface on its own.
  onHoverChange?: (noteId: string | null) => void;
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
}

type GraphNode = KnowledgeGraphNode & d3.SimulationNodeDatum;
type GraphLink = KnowledgeGraphEdge & d3.SimulationLinkDatum<GraphNode> & { source: GraphNode; target: GraphNode };

// The subset of FederatedPointerEvent the sprite handlers touch, so the drag
// and hover handlers are typed instead of duck-cast to an inline shape.
type NodePointerEvent = Pick<
  FederatedPointerEvent,
  "client" | "stopPropagation" | "preventDefault"
>;

// Opacity a backgrounded node's sprite and its DOM label both fade to. One
// value, so a dot and its name cannot disagree about how dim "dimmed" is.
const DIMMED_ALPHA = 0.15;

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
  ref,
}: ForceGraphProps) {
  const { nodes, edges } = graph;
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
  const emphasis = useMemo(
    () => computeNodeEmphasis(graphNodes, graphEdges, hoveredId),
    [graphNodes, graphEdges, hoveredId]
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
  const dragNodeRef = useRef<GraphNode | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const zoomTransformRef = useRef<{ x: number; y: number; k: number }>({ x: 0, y: 0, k: 1 });
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const zoomSelectionRef = useRef<d3.Selection<HTMLDivElement, unknown, null, undefined> | null>(null);
  const userInteractedRef = useRef(false);
  const colorsRef = useRef({ node: 0, hover: 0, link: 0, leaf: 0 });

  // Screen position for a node's label, in wrapper coordinates. Labels live in
  // DOM space rather than inside the zoomed Pixi world, so the text stays a
  // fixed 12px however far the graph is zoomed.
  const labelScreenPosition = useCallback((node: GraphNode) => {
    const transform = zoomTransformRef.current;
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
  // per-tick path stays O(1) — the simulation runs ~300 ticks on load, long
  // before anyone has zoomed in far enough for the labels to matter.
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
  const applyHover = useCallback(
    (hovered: string | null) => {
      const states = computeNodeEmphasis(graphNodes, graphEdges, hovered);
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
          hovered !== null && (link.source.id === hovered || link.target.id === hovered);
        sprite.tint = isIncident ? colors.hover : colors.link;
        sprite.alpha = hovered === null ? 0.15 : isIncident ? 1 : 0.08;
      }
    },
    [graphNodes, graphEdges]
  );

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

  useImperativeHandle(ref, () => ({ setHoveredNote: setHovered }), [setHovered]);

  const startDrag = useCallback(
    (event: NodePointerEvent, node: GraphNode) => {
      event.stopPropagation();
      event.preventDefault();
      if (dragNodeRef.current) return;

      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const simulation = simulationRef.current;
      if (simulation) simulation.alphaTarget(0.3).restart();

      dragNodeRef.current = node;
      // The transform is read once, at pointerdown, and reused for the whole
      // gesture: the node has to track the pointer through the view the drag
      // started in, even if a zoom lands mid-drag.
      const transform = zoomTransformRef.current;
      const grabbed = graphPointFromClient(
        event.client.x,
        event.client.y,
        rect,
        transform
      );
      node.fx = grabbed.x;
      node.fy = grabbed.y;

      const handleMove = (e: PointerEvent) => {
        const dragged = dragNodeRef.current;
        const sim = simulationRef.current;
        if (!dragged) return;
        const { x, y } = graphPointFromClient(e.clientX, e.clientY, rect, transform);
        dragged.fx = x;
        dragged.fy = y;
        dragged.x = x;
        dragged.y = y;

        const sprite = nodeSpritesRef.current.get(dragged.id);
        if (sprite) {
          sprite.x = x;
          sprite.y = y;
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

        if (sim && sim.alpha() < 0.1) sim.alphaTarget(0.3).restart();
      };

      const handleUp = () => {
        dragCleanupRef.current = null;
        const sim = simulationRef.current;
        if (sim) sim.alphaTarget(0);
        const dragged = dragNodeRef.current;
        if (dragged) {
          dragged.fx = undefined;
          dragged.fy = undefined;
        }
        dragNodeRef.current = null;
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);
      };

      // Tracked so a rebuild/unmount mid-drag can still detach the listeners;
      // handleUp() is idempotent for the not-dragging case.
      dragCleanupRef.current = handleUp;
      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
    },
    [updateLinkSprite, positionLabel, positionAllLabels]
  );

  // Build the Pixi scene and d3-force simulation once per data set.
  useEffect(() => {
    if (!app || graphNodes.length === 0) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const { clientWidth, clientHeight } = wrapper;

    const teardownWorld = () => {
      dragCleanupRef.current?.();
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
      userInteractedRef.current = false;

      const world = new PIXI.Container();
      worldContainerRef.current = world;
      app.stage.addChild(world);

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
      const nodeSpriteArr: import("pixi.js").Sprite[] = [];
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
        nodeSpriteArr.push(sprite);

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
          startDrag(e, node);
        });
      }
      nodeSpritesRef.current = nodeSprites;
      nodeRadiusRef.current = nodeRadii;

      const linkSprites = new Map<GraphLink, import("pixi.js").Sprite>();
      const linkSpriteArr: import("pixi.js").Sprite[] = [];
      for (const link of simLinks) {
        const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        sprite.label = `${link.source.id}->${link.target.id}`;
        sprite.anchor.set(0, 0.5);
        sprite.height = 1;
        sprite.tint = colorsRef.current.link;
        sprite.alpha = 0.15;
        linksContainer.addChild(sprite);
        linkSprites.set(link, sprite);
        linkSpriteArr.push(sprite);
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

      let initialFitDone = false;

      // Runs one fit plan. Nothing here decides whether a fit should happen or
      // what it should be — planFit owns that, in lib — so this only applies
      // what it is handed.
      const applyFit = (plan: FitPlan) => {
        const selection = zoomSelectionRef.current;
        const zoom = zoomBehaviorRef.current;
        if (!selection || !zoom) return;
        const { k, x, y } = plan.transform;
        const transform = d3.zoomIdentity.translate(x, y).scale(k);
        if (plan.mode === "snap") {
          selection.call(zoom.transform, transform);
        } else {
          selection.transition().duration(plan.durationMs).call(zoom.transform, transform);
        }
      };

      const fitViewport = (trigger: FitTrigger) => {
        const plan = planFit(trigger, {
          userInteracted: userInteractedRef.current,
          nodes: simNodes,
          viewportWidth: clientWidth,
          viewportHeight: clientHeight,
        });
        if (plan) applyFit(plan);
      };

      simulation.on("tick", () => {
        // Sprites are kept in arrays aligned 1:1 with the sim data, so the hot
        // per-tick path is plain index lookups instead of string-keyed Map gets.
        for (let i = 0; i < simNodes.length; i++) {
          const sprite = nodeSpriteArr[i];
          sprite.x = simNodes[i].x ?? 0;
          sprite.y = simNodes[i].y ?? 0;
        }
        for (let i = 0; i < simLinks.length; i++) {
          const link = simLinks[i];
          updateLinkSprite(linkSpriteArr[i], link.source, link.target);
        }
        positionLabel();
        positionAllLabels();

        // The graph is first seen here, so this tick is what asks for the rough
        // frame. What that frame is, and whether it moves, is planFit's business.
        if (!initialFitDone) {
          initialFitDone = true;
          fitViewport("first-tick");
        }
      });

      // "end" fires when alpha drops below alphaMin, so positions are final and
      // the settling fit frames the layout the viewer is left with.
      simulation.on("end", () => fitViewport("settled"));
    };

    build();

    return () => {
      cancelled = true;
      teardownWorld();
    };
  }, [app, graphNodes, graphEdges, degrees, applyHover, positionLabel, positionAllLabels, startDrag, updateLinkSprite, setHovered]);

  // d3-zoom drives the Pixi world container transform.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const zoom = d3
      .zoom<HTMLDivElement, unknown>()
      .scaleExtent([NODE_MIN_ZOOM, NODE_MAX_ZOOM])
      .on("zoom", (event) => {
        if (event.sourceEvent) {
          userInteractedRef.current = true;
          zoomSelectionRef.current?.interrupt();
        }
        zoomTransformRef.current = { x: event.transform.x, y: event.transform.y, k: event.transform.k };
        const world = worldContainerRef.current;
        if (world) {
          world.position.set(event.transform.x, event.transform.y);
          world.scale.set(event.transform.k);
        }

        // Flip the all-labels mode only on a crossing, not on every zoom frame —
        // the ref is updated first so the positioning below happens in this same
        // event, with the labels already in place as they fade in.
        const pastThreshold = event.transform.k >= LABEL_ZOOM_THRESHOLD;
        if (pastThreshold !== showAllLabelsRef.current) {
          showAllLabelsRef.current = pastThreshold;
          setShowAllLabels(pastThreshold);
        }

        positionLabel();
        positionAllLabels();
      });

    const selection = d3.select(wrapper).call(zoom);
    zoomBehaviorRef.current = zoom;
    zoomSelectionRef.current = selection;

    return () => {
      selection.on(".zoom", null);
      zoomBehaviorRef.current = null;
      zoomSelectionRef.current = null;
    };
  }, [positionLabel, positionAllLabels]);

  return (
    <div
      ref={wrapperRef}
      // `flex-1 min-w-0` rather than `w-full`: the wrapper shares its row with
      // the note list, and a fixed `width: 100%` would ignore the sibling's
      // share of it.
      className="relative h-full min-w-0 flex-1 overflow-hidden touch-none"
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
