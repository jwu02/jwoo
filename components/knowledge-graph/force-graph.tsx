"use client";

import { useEffect, useMemo, useRef } from "react";
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

type GraphNode = KnowledgeGraphNode & d3.SimulationNodeDatum;
type GraphLink = KnowledgeGraphEdge & d3.SimulationLinkDatum<GraphNode>;
type ResolvedGraphLink = KnowledgeGraphEdge & { source: GraphNode; target: GraphNode };

export function ForceGraph({ nodes, edges, currentTime }: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, undefined> | null>(null);
  const nodesByIdRef = useRef<Map<string, GraphNode>>(new Map());
  const degreesRef = useRef<Map<string, number>>(new Map());
  const lastSignatureRef = useRef<string | null>(null);
  const nodeSelectionRef = useRef<
    d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown> | null
  >(null);
  const linkSelectionRef = useRef<
    d3.Selection<SVGLineElement, ResolvedGraphLink, SVGGElement, unknown> | null
  >(null);

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

  // Build the SVG shell, zoom, and force simulation once per graph data set.
  // The simulation lays out the full graph so node positions stay stable while
  // `currentTime` advances; node/edge visibility is toggled by the effect below
  // instead of wiping (`svg.selectAll("*").remove()`) and rebuilding the graph.
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
          (d: GraphNode) => 5 + Math.sqrt(degreesRef.current.get(d.id) ?? 0) * 2
        )
      );

    simulationRef.current = simulation;

    const linkGroup = g
      .append("g")
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.15);
    const nodeGroup = g.append("g");

    linkSelectionRef.current = linkGroup.selectAll<SVGLineElement, ResolvedGraphLink>("line");
    nodeSelectionRef.current = nodeGroup.selectAll<SVGCircleElement, GraphNode>("circle");

    simulation.on("tick", () => {
      const links = linkSelectionRef.current;
      if (links) {
        links
          .attr("x1", (d: ResolvedGraphLink) => d.source.x ?? 0)
          .attr("y1", (d: ResolvedGraphLink) => d.source.y ?? 0)
          .attr("x2", (d: ResolvedGraphLink) => d.target.x ?? 0)
          .attr("y2", (d: ResolvedGraphLink) => d.target.y ?? 0);
      }

      const nodes = nodeSelectionRef.current;
      if (nodes) {
        nodes.attr("cx", (d: GraphNode) => d.x ?? 0).attr("cy", (d: GraphNode) => d.y ?? 0);
      }
    });

    return () => {
      simulation.stop();
      simulationRef.current = null;
      lastSignatureRef.current = null;
    };
  }, [nodes, edges]);

  // Join the currently-visible nodes and edges onto the existing selections
  // (enter/exit) as `currentTime` advances. The simulation itself is never
  // recreated here, and the join is skipped when the visible set is unchanged,
  // so the layout can settle while the timeline plays instead of being wiped
  // and rebuilt on every frame.
  useEffect(() => {
    degreesRef.current = degrees;

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

    linkSelectionRef.current = linkSelection
      .data(visibleSimLinks, (d: ResolvedGraphLink) => `${d.source.id}->${d.target.id}`)
      .join<SVGLineElement>("line")
      .attr("stroke-width", 1);

    nodeSelectionRef.current = nodeSelection
      .data(visibleSimNodes, (d: GraphNode) => d.id)
      .join<SVGCircleElement>("circle")
      .attr("r", (d: GraphNode) => 4 + Math.sqrt(degrees.get(d.id) ?? 0))
      .attr("fill", "var(--primary)")
      .attr("stroke", "var(--background)")
      .attr("stroke-width", 1.5)
      .call(
        d3
          .drag<SVGCircleElement, GraphNode>()
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
            d.fx = undefined;
            d.fy = undefined;
          })
      );

    nodeSelectionRef.current.selectAll("title").remove();
    nodeSelectionRef.current.append("title").text((d: GraphNode) => d.id);

    simulation.alpha(0.3).restart();
  }, [visibleNodes, visibleEdges, degrees]);

  return (
    <svg
      ref={svgRef}
      className="h-full w-full touch-none"
      style={{ color: "var(--foreground)" }}
    />
  );
}
