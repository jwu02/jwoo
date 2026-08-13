"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { FederatedPointerEvent } from "pixi.js";
import type { KnowledgeGraphEdge, KnowledgeGraphNode } from "@/lib/knowledge-graph/types";
import {
  computeDegrees,
  computeFitTransform,
  computeRoughInitialTransform,
} from "@/lib/knowledge-graph/graph-data";
import { usePixiApp } from "./use-pixi-app";

interface ForceGraphProps {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

type GraphNode = KnowledgeGraphNode & d3.SimulationNodeDatum;
type GraphLink = KnowledgeGraphEdge & d3.SimulationLinkDatum<GraphNode> & { source: GraphNode; target: GraphNode };

const NODE_BASE_RADIUS = 4;
const CIRCLE_TEXTURE_RADIUS = 8;

// Single source of truth for the degree → radius mapping (node size, collide
// radius, label offset) so retuning the size model touches one place.
function nodeRadius(degree: number): number {
  return NODE_BASE_RADIUS + Math.sqrt(degree);
}

// The subset of FederatedPointerEvent the sprite handlers touch, so the drag
// and hover handlers are typed instead of duck-cast to an inline shape.
type NodePointerEvent = Pick<
  FederatedPointerEvent,
  "client" | "stopPropagation" | "preventDefault"
>;

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

export function ForceGraph({ nodes, edges }: ForceGraphProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const app = usePixiApp(wrapperRef);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const labelRef = useRef<HTMLDivElement>(null);

  const graphNodes = useMemo<GraphNode[]>(() => nodes.map((node) => ({ ...node })), [nodes]);
  const graphEdges = useMemo(() => edges.map((edge) => ({ ...edge })), [edges]);
  const degrees = useMemo(() => computeDegrees(graphNodes, graphEdges), [graphNodes, graphEdges]);

  const simulationRef = useRef<d3.Simulation<GraphNode, undefined> | null>(null);
  const nodesByIdRef = useRef<Map<string, GraphNode>>(new Map());
  const degreesRef = useRef<Map<string, number>>(degrees);
  const nodeRadiusRef = useRef<Map<string, number>>(new Map());
  const adjacencyRef = useRef<Map<string, Set<string>>>(new Map());
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
  const colorsRef = useRef({ node: 0, edge: 0, hover: 0, link: 0, bg: 0 });

  useEffect(() => {
    degreesRef.current = degrees;
  }, [degrees]);

  const positionLabel = useCallback(() => {
    const label = labelRef.current;
    const hovered = hoveredIdRef.current;
    if (!label || hovered === null) return;
    const node = nodesByIdRef.current.get(hovered);
    if (!node || node.x === undefined || node.y === undefined) return;
    const transform = zoomTransformRef.current;
    const screenX = node.x * transform.k + transform.x;
    const screenY = node.y * transform.k + transform.y;
    const radius = nodeRadiusRef.current.get(hovered) ?? NODE_BASE_RADIUS;
    label.style.transform = `translate3d(${screenX}px, ${screenY + radius + 6}px, 0) translateX(-50%)`;
  }, []);

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

  const applyHover = useCallback(() => {
    const hovered = hoveredIdRef.current;
    const nodeSprites = nodeSpritesRef.current;
    const linkSprites = linkSpritesRef.current;
    const adjacency = adjacencyRef.current;
    const colors = colorsRef.current;
    const degreeMap = degreesRef.current;
    const radii = nodeRadiusRef.current;
    // Every node is seeded a Set in the index, so the lookups below never miss.
    const neighborIds = hovered !== null ? adjacency.get(hovered) : undefined;

    for (const [id, sprite] of nodeSprites) {
      const isHovered = id === hovered;
      const isDimmed = hovered !== null && !isHovered && !neighborIds?.has(id);
      const degree = degreeMap.get(id) ?? 0;
      const baseScale = (radii.get(id) ?? NODE_BASE_RADIUS) / CIRCLE_TEXTURE_RADIUS;
      sprite.tint = isHovered ? colors.hover : degree === 1 ? colors.edge : colors.node;
      sprite.alpha = isDimmed ? 0.15 : 1;
      sprite.scale.set(baseScale * (isHovered ? 1.3 : 1));
    }

    for (const [link, sprite] of linkSprites) {
      const isIncident =
        hovered !== null && (link.source.id === hovered || link.target.id === hovered);
      sprite.tint = isIncident ? colors.hover : colors.link;
      sprite.alpha = hovered === null ? 0.15 : isIncident ? 1 : 0.08;
    }
  }, []);

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
      const t = zoomTransformRef.current;
      const toGraphX = (clientX: number) => (clientX - rect.left - t.x) / t.k;
      const toGraphY = (clientY: number) => (clientY - rect.top - t.y) / t.k;
      node.fx = toGraphX(event.client.x);
      node.fy = toGraphY(event.client.y);

      const handleMove = (e: PointerEvent) => {
        const dragged = dragNodeRef.current;
        const sim = simulationRef.current;
        if (!dragged) return;
        const gx = toGraphX(e.clientX);
        const gy = toGraphY(e.clientY);
        dragged.fx = gx;
        dragged.fy = gy;
        dragged.x = gx;
        dragged.y = gy;

        const sprite = nodeSpritesRef.current.get(dragged.id);
        if (sprite) {
          sprite.x = gx;
          sprite.y = gy;
        }
        const incident = incidentLinksRef.current.get(dragged.id);
        if (incident) {
          for (const link of incident) {
            const linkSprite = linkSpritesRef.current.get(link);
            if (linkSprite) updateLinkSprite(linkSprite, link.source, link.target);
          }
        }
        positionLabel();

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
    [updateLinkSprite, positionLabel]
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
        bg,
        edge: mixColors(node, bg, 0.4),
      };

      // The effect cleanup tears the previous world down on rebuild; this call
      // is defensive for the async gap between a cancelled build and the next.
      teardownWorld();
      hoveredIdRef.current = null;
      setHoveredId(null);
      dragNodeRef.current = null;
      userInteractedRef.current = false;

      const world = new PIXI.Container();
      worldContainerRef.current = world;
      app.stage.addChild(world);

      const linksContainer = new PIXI.Container();
      const nodesContainer = new PIXI.Container();
      world.addChild(linksContainer);
      world.addChild(nodesContainer);

      const circleGraphics = new PIXI.Graphics();
      circleGraphics.circle(0, 0, CIRCLE_TEXTURE_RADIUS).fill(0xffffff);
      const circleTexture = app.renderer.generateTexture(circleGraphics);
      circleGraphics.destroy();

      // The simulation mutates these in place; graphNodes/graphEdges are the
      // memoized clones of the props, so the props themselves are never touched.
      const simNodes: GraphNode[] = graphNodes;
      const nodesById = new Map(simNodes.map((node) => [node.id, node]));
      nodesByIdRef.current = nodesById;

      const simLinks: GraphLink[] = graphEdges.map(
        (edge) =>
          ({
            source: nodesById.get(edge.source)!,
            target: nodesById.get(edge.target)!,
          }) as GraphLink
      );

      const adjacency = new Map<string, Set<string>>();
      const incident = new Map<string, GraphLink[]>();
      for (const node of simNodes) adjacency.set(node.id, new Set());
      for (const link of simLinks) {
        adjacency.get(link.source.id)!.add(link.target.id);
        adjacency.get(link.target.id)!.add(link.source.id);
        const fromSource = incident.get(link.source.id) ?? [];
        fromSource.push(link);
        incident.set(link.source.id, fromSource);
        const fromTarget = incident.get(link.target.id) ?? [];
        fromTarget.push(link);
        incident.set(link.target.id, fromTarget);
      }
      adjacencyRef.current = adjacency;
      incidentLinksRef.current = incident;

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
        sprite.scale.set(radius / CIRCLE_TEXTURE_RADIUS);
        sprite.tint = degree === 1 ? colorsRef.current.edge : colorsRef.current.node;
        sprite.alpha = 1;
        nodesContainer.addChild(sprite);
        nodeSprites.set(node.id, sprite);
        nodeSpriteArr.push(sprite);

        sprite.on("pointerover", (e: FederatedPointerEvent) => {
          e.stopPropagation();
          if (dragNodeRef.current?.id === node.id) return;
          hoveredIdRef.current = node.id;
          setHoveredId(node.id);
          applyHover();
          positionLabel();
        });
        sprite.on("pointerout", (e: FederatedPointerEvent) => {
          e.stopPropagation();
          if (dragNodeRef.current?.id === node.id) return;
          hoveredIdRef.current = null;
          setHoveredId(null);
          applyHover();
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
      const fitView = () => {
        const fit = computeFitTransform(simNodes, clientWidth, clientHeight, 60);
        const t = d3.zoomIdentity.translate(fit.x, fit.y).scale(fit.k);
        if (!userInteractedRef.current && zoomSelectionRef.current && zoomBehaviorRef.current) {
          zoomSelectionRef.current.transition().duration(500).call(zoomBehaviorRef.current.transform, t);
        }
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

        // Snap to a rough initial frame on the first tick. d3 seeded every node
        // with a phyllotaxis position when the simulation was constructed, so
        // center on the seeded centroid right away. It is intentionally loose —
        // the layout is about to change, so a rough frame is enough; the precise
        // fit runs once the simulation settles.
        if (!initialFitDone) {
          initialFitDone = true;
          const rough = computeRoughInitialTransform(simNodes, clientWidth, clientHeight);
          const t = d3.zoomIdentity.translate(rough.x, rough.y).scale(rough.k);
          if (!userInteractedRef.current && zoomSelectionRef.current && zoomBehaviorRef.current) {
            zoomSelectionRef.current.call(zoomBehaviorRef.current.transform, t);
          }
        }
      });

      // Re-fit once the layout has fully settled. The first fit framed the
      // initial circle, which the forces then spread beyond; "end" fires when
      // alpha drops below alphaMin (positions are final), so this corrective
      // fit guarantees the resting layout is fully in view.
      simulation.on("end", fitView);
    };

    build();

    return () => {
      cancelled = true;
      teardownWorld();
    };
  }, [app, graphNodes, graphEdges, degrees, applyHover, positionLabel, startDrag, updateLinkSprite]);

  // d3-zoom drives the Pixi world container transform.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const zoom = d3
      .zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.1, 4])
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
        positionLabel();
      });

    const selection = d3.select(wrapper).call(zoom);
    zoomBehaviorRef.current = zoom;
    zoomSelectionRef.current = selection;

    return () => {
      selection.on(".zoom", null);
      zoomBehaviorRef.current = null;
      zoomSelectionRef.current = null;
    };
  }, [positionLabel]);

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full overflow-hidden touch-none"
      data-testid="kg-graph-wrapper"
    >
      {/* Always mounted so positionLabel() (called from pointerover before any
          React commit) always finds the element; visibility is CSS-gated. */}
      <div
        ref={labelRef}
        data-testid="kg-node-label"
        aria-hidden={hoveredId === null}
        className={`pointer-events-none absolute left-0 top-0 z-10 whitespace-nowrap text-xs font-medium text-primary transition-opacity [text-shadow:0_0_3px_var(--background),0_0_3px_var(--background)] ${
          hoveredId === null ? "opacity-0" : "opacity-100"
        }`}
      >
        {hoveredId}
      </div>
    </div>
  );
}
