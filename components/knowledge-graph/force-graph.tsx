"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { KnowledgeGraphEdge, KnowledgeGraphNode } from "@/lib/knowledge-graph/types";
import {
  computeDegrees,
  computeFitTransform,
  getVisibleEdges,
  getVisibleNodes,
} from "@/lib/knowledge-graph/graph-data";

interface ForceGraphProps {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  currentTime: number;
}

type GraphNode = KnowledgeGraphNode & d3.SimulationNodeDatum;
type GraphLink = KnowledgeGraphEdge & d3.SimulationLinkDatum<GraphNode>;
type ResolvedGraphLink = KnowledgeGraphEdge & { source: GraphNode; target: GraphNode };

const NODE_BASE_RADIUS = 4;
const LABEL_GAP = 6;

export function ForceGraph({ nodes, edges, currentTime }: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, undefined> | null>(null);
  const nodesByIdRef = useRef<Map<string, GraphNode>>(new Map());
  const degreesRef = useRef<Map<string, number>>(new Map());
  const lastSignatureRef = useRef<string | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const zoomTransformRef = useRef<{ x: number; y: number; k: number }>({ x: 0, y: 0, k: 1 });
  const nodeSelectionRef = useRef<
    d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown> | null
  >(null);
  const linkSelectionRef = useRef<
    d3.Selection<SVGLineElement, ResolvedGraphLink, SVGGElement, unknown> | null
  >(null);
  // Precomputed collide radii (by node id) so the collide force doesn't do a
  // Map lookup + Math.sqrt per node on every tick.
  const collideRadiusRef = useRef<Map<string, number>>(new Map());
  // Node id -> incident links, and "source->target" key -> its <line> element.
  // Let the drag handler move the grabbed node's links in O(degree) without
  // scanning the whole edge set on every pointer move.
  const incidentEdgesRef = useRef<Map<string, ResolvedGraphLink[]>>(new Map());
  const linkElementsRef = useRef<Map<string, SVGLineElement>>(new Map());

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const visibleNodes = useMemo(
    () => getVisibleNodes(nodes, currentTime),
    [nodes, currentTime]
  );
  const visibleEdges = useMemo(
    () => getVisibleEdges(edges, visibleNodes),
    [edges, visibleNodes]
  );
  const degrees = useMemo(
    () => computeDegrees(visibleNodes, visibleEdges),
    [visibleNodes, visibleEdges]
  );

  // Highlight the hovered node and its incident links in the accent colour.
  // Nodes directly connected to it stay undimmed so the neighbourhood reads as
  // context; unrelated nodes and edges fade out (Obsidian-style). Reads only
  // refs, so it is stable and safe to call from d3 event handlers and joins.
  const applyHover = useCallback(() => {
    const hovered = hoveredIdRef.current;
    const nodes = nodeSelectionRef.current;
    const links = linkSelectionRef.current;
    if (!nodes || !links) return;

    const neighbors = new Set<string>();
    if (hovered !== null) {
      for (const d of links.data()) {
        if (d.source.id === hovered) neighbors.add(d.target.id);
        if (d.target.id === hovered) neighbors.add(d.source.id);
      }
    }

    nodes
      .classed("kg-node--hovered", (d: GraphNode) => d.id === hovered)
      .classed(
        "kg-node--dimmed",
        (d: GraphNode) => hovered !== null && d.id !== hovered && !neighbors.has(d.id)
      );

    links
      .classed(
        "kg-link--hovered",
        (d: ResolvedGraphLink) =>
          hovered !== null && (d.source.id === hovered || d.target.id === hovered)
      )
      .classed(
        "kg-link--dimmed",
        (d: ResolvedGraphLink) =>
          hovered !== null && d.source.id !== hovered && d.target.id !== hovered
      );
  }, []);

  // Place the HTML filename label just under the hovered node, converting the
  // node's graph coords to screen coords via the current zoom transform.
  const positionLabel = useCallback(() => {
    const label = labelRef.current;
    const hovered = hoveredIdRef.current;
    if (!label || hovered === null) return;
    const node = nodesByIdRef.current.get(hovered);
    if (!node || node.x === undefined || node.y === undefined) return;
    const transform = zoomTransformRef.current;
    const screenX = node.x * transform.k + transform.x;
    const screenY = node.y * transform.k + transform.y;
    const radius = NODE_BASE_RADIUS + Math.sqrt(degreesRef.current.get(hovered) ?? 0);
    label.style.left = `${screenX}px`;
    label.style.top = `${screenY + radius + LABEL_GAP}px`;
  }, []);

  // Position the label once it has mounted so it appears under the node
  // immediately on hover; ticks and zoom keep it pinned afterwards.
  useEffect(() => {
    positionLabel();
  }, [hoveredId, positionLabel]);

  // Build the SVG shell, zoom, and force simulation once per graph data set.
  // The simulation lays out the full graph so node positions stay stable while
  // `currentTime` advances; node/edge visibility is toggled by the effect below
  // instead of wiping (`svg.selectAll("*").remove()`) and rebuilding the graph.
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    // Fits the camera to the whole graph once the layout settles. Local to
    // this effect, so it resets (refits) only when a new data set rebuilds the
    // simulation — never during playback or drag.
    let fitDone = false;

    svg.selectAll("*").remove();

    const g = svg.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        // A user-driven zoom (wheel/pinch/pan) carries a sourceEvent and
        // cancels the initial fit transition so it can't fight the gesture.
        if (event.sourceEvent) svg.interrupt();
        zoomTransformRef.current = {
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k,
        };
        g.attr("transform", event.transform.toString());
        positionLabel();
      });

    svg.call(zoom);

    const simulationNodes: GraphNode[] = nodes.map((node) => ({ ...node }));
    const simulationLinks: GraphLink[] = edges.map((edge) => ({ ...edge }));

    nodesByIdRef.current = new Map(simulationNodes.map((node) => [node.id, node]));

    const simulation = d3
      .forceSimulation(simulationNodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(simulationLinks)
          .id((d: GraphNode) => d.id)
          .distance(60)
      )
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX<GraphNode>(width / 2).strength(0.06))
      .force("y", d3.forceY<GraphNode>(height / 2).strength(0.06))
      .force(
        "collide",
        d3.forceCollide<GraphNode>().radius(
          (d: GraphNode) => collideRadiusRef.current.get(d.id) ?? 5
        )
      );

    simulationRef.current = simulation;

    const linkGroup = g.append("g");
    const nodeGroup = g.append("g");

    linkSelectionRef.current = linkGroup.selectAll<SVGLineElement, ResolvedGraphLink>("line");
    nodeSelectionRef.current = nodeGroup.selectAll<SVGCircleElement, GraphNode>("circle");

    simulation.on("tick", () => {
      // Write each element's geometry in a single pass (native setAttribute)
      // instead of one chained .attr() pass per attribute — at large graph
      // sizes the selection iterations + function calls add up per frame.
      const links = linkSelectionRef.current;
      if (links) {
        links.each(function (d) {
          this.setAttribute("x1", String(d.source.x ?? 0));
          this.setAttribute("y1", String(d.source.y ?? 0));
          this.setAttribute("x2", String(d.target.x ?? 0));
          this.setAttribute("y2", String(d.target.y ?? 0));
        });
      }

      const nodes = nodeSelectionRef.current;
      if (nodes) {
        nodes.each(function (d) {
          this.setAttribute("cx", String(d.x ?? 0));
          this.setAttribute("cy", String(d.y ?? 0));
        });
      }

      positionLabel();

      // Once the layout has settled, zoom out so the whole (eventual) graph is
      // in view instead of the handful of nodes around the centre filling the
      // screen. Runs once per data set and eases in over 500ms.
      if (!fitDone && simulation.alpha() < 0.05) {
        fitDone = true;
        const fit = computeFitTransform(simulation.nodes(), width, height, 60);
        const t = d3.zoomIdentity.translate(fit.x, fit.y).scale(fit.k);
        svg.transition().duration(500).call(zoom.transform, t);
      }
    });

    return () => {
      simulation.stop();
      simulationRef.current = null;
      lastSignatureRef.current = null;
      hoveredIdRef.current = null;
      setHoveredId(null);
    };
  }, [nodes, edges, positionLabel]);

  // Join the currently-visible nodes and edges onto the existing selections
  // (enter/exit) as `currentTime` advances. The simulation itself is never
  // recreated here, and the join is skipped when the visible set is unchanged,
  // so the layout can settle while the timeline plays instead of being wiped
  // and rebuilt on every frame.
  useEffect(() => {
    degreesRef.current = degrees;
    collideRadiusRef.current = new Map(
      [...degrees].map(([id, degree]) => [id, 5 + Math.sqrt(degree) * 2])
    );

    const simulation = simulationRef.current;
    const nodesById = nodesByIdRef.current;
    const nodeSelection = nodeSelectionRef.current;
    const linkSelection = linkSelectionRef.current;
    if (!simulation || !nodeSelection || !linkSelection) return;

    const visibleSimNodes: GraphNode[] = visibleNodes
      .map((node) => nodesById.get(node.id))
      .filter((node): node is GraphNode => node !== undefined);

    const visibleSimLinks: ResolvedGraphLink[] = visibleEdges
      .map((edge) => {
        const source = nodesById.get(edge.source);
        const target = nodesById.get(edge.target);
        if (source === undefined || target === undefined) return null;
        return { ...edge, source, target };
      })
      .filter((link): link is ResolvedGraphLink => link !== null);

    const signature =
      visibleSimNodes.map((node) => node.id).join(",") +
      "|" +
      visibleSimLinks.map((link) => `${link.source.id}->${link.target.id}`).join(",");

    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    const joinedLinks = linkSelection
      .data(visibleSimLinks, (d: ResolvedGraphLink) => `${d.source.id}->${d.target.id}`)
      .join<SVGLineElement>("line")
      .classed("kg-link", true)
      .attr("stroke-width", 1);
    linkSelectionRef.current = joinedLinks;

    // Index the joined links so the drag handler can move a node's incident
    // edges in O(degree) without scanning the whole edge set on every pointer
    // move.
    const incidentEdges = new Map<string, ResolvedGraphLink[]>();
    const linkElements = new Map<string, SVGLineElement>();
    joinedLinks.each(function (d) {
      linkElements.set(`${d.source.id}->${d.target.id}`, this);
      const fromSource = incidentEdges.get(d.source.id);
      if (fromSource) fromSource.push(d);
      else incidentEdges.set(d.source.id, [d]);
      const fromTarget = incidentEdges.get(d.target.id);
      if (fromTarget) fromTarget.push(d);
      else incidentEdges.set(d.target.id, [d]);
    });
    incidentEdgesRef.current = incidentEdges;
    linkElementsRef.current = linkElements;

    nodeSelectionRef.current = nodeSelection
      .data(visibleSimNodes, (d: GraphNode) => d.id)
      .join<SVGCircleElement>("circle")
      .classed("kg-node", true)
      // Edge nodes are the leaves of the visible graph — exactly one
      // connection — and render slightly dimmed so hubs stand out. A hub
      // (degree >= 2) or an isolated node (degree 0) keeps full colour.
      .classed("kg-node--edge", (d: GraphNode) => (degrees.get(d.id) ?? 0) === 1)
      .attr("r", (d: GraphNode) => NODE_BASE_RADIUS + Math.sqrt(degrees.get(d.id) ?? 0))
      .attr("stroke", "var(--background)")
      .attr("stroke-width", 1.5)
      .on("mouseover", (_event, d) => {
        hoveredIdRef.current = d.id;
        setHoveredId(d.id);
        applyHover();
        positionLabel();
      })
      .on("mouseout", () => {
        hoveredIdRef.current = null;
        setHoveredId(null);
        applyHover();
      })
      .call(
        d3
          .drag<SVGCircleElement, GraphNode>()
          .on("start", function (event, d) {
            // Reheat the simulation so neighbouring nodes keep easing toward
            // the dragged node while it moves; pin the node so the forces
            // don't yank it away from the pointer.
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", function (event, d) {
            d.fx = event.x;
            d.fy = event.y;
            d.x = event.x;
            d.y = event.y;

            // Move the grabbed node and its incident links synchronously so the
            // drag tracks the pointer instead of waiting on a simulation tick.
            d3.select<SVGCircleElement, GraphNode>(this)
              .attr("cx", event.x)
              .attr("cy", event.y);

            const incident = incidentEdgesRef.current.get(d.id);
            if (incident) {
              for (const link of incident) {
                const el = linkElementsRef.current.get(
                  `${link.source.id}->${link.target.id}`
                );
                if (!el) continue;
                el.setAttribute("x1", String(link.source.x ?? 0));
                el.setAttribute("y1", String(link.source.y ?? 0));
                el.setAttribute("x2", String(link.target.x ?? 0));
                el.setAttribute("y2", String(link.target.y ?? 0));
              }
            }

            positionLabel();
          })
          .on("end", function (event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = undefined;
            d.fy = undefined;
            positionLabel();
          })
      );

    // If the hovered node is no longer visible (e.g. playback moved past its
    // removal), drop the highlight so a ghost label isn't left behind.
    if (
      hoveredIdRef.current !== null &&
      !visibleSimNodes.some((node) => node.id === hoveredIdRef.current)
    ) {
      hoveredIdRef.current = null;
      setHoveredId(null);
    }
    applyHover();
    positionLabel();

    simulation.alpha(0.3).restart();
  }, [visibleNodes, visibleEdges, degrees, applyHover, positionLabel]);

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        className="h-full w-full touch-none"
        style={{ color: "var(--foreground)" }}
      />
      {hoveredId !== null && (
        <div
          ref={labelRef}
          data-testid="kg-node-label"
          className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-primary [text-shadow:0_0_3px_var(--background),0_0_3px_var(--background)]"
        >
          {hoveredId}
        </div>
      )}
    </div>
  );
}
