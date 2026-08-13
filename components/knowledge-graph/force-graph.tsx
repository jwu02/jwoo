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
  const simulationRef = useRef<
    d3.Simulation<KnowledgeGraphNode & d3.SimulationNodeDatum, undefined> | null
  >(null);

  const visibleNodes = getVisibleNodes(nodes, currentTime);
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
      .selectAll<SVGCircleElement, KnowledgeGraphNode & d3.SimulationNodeDatum>("circle")
      .data(simulationNodes)
      .join<SVGCircleElement>("circle")
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
