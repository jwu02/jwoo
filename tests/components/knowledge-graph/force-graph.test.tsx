import { act, render, waitFor } from "@testing-library/react";
import { ForceGraph } from "@/components/knowledge-graph/force-graph";

beforeEach(() => {
  document.documentElement.style.setProperty("--primary", "#ff0000");
  document.documentElement.style.setProperty("--claude-orange", "#ff8800");
  document.documentElement.style.setProperty("--foreground", "#000000");
  document.documentElement.style.setProperty("--background", "#ffffff");
});

interface MockNode {
  label?: string;
  visible?: boolean;
  alpha?: number;
  tint?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  scale?: { x: number; y: number };
  children?: MockNode[];
  emit?(event: string, data?: unknown): void;
}

interface MockApp {
  stage: MockNode;
}

function getPixiApp(container: HTMLElement): MockApp | undefined {
  const canvas = container.querySelector("canvas");
  return (canvas as unknown as { __pixiApp?: MockApp })?.__pixiApp;
}

function getContainers(container: HTMLElement) {
  const app = getPixiApp(container);
  const world = app?.stage.children?.[0];
  const linksContainer = world?.children?.[0];
  const nodesContainer = world?.children?.[1];
  return { app, world, linksContainer, nodesContainer };
}

function nodeSpriteById(container: HTMLElement, id: string): MockNode | undefined {
  const { nodesContainer } = getContainers(container);
  return nodesContainer?.children?.find((s) => s.label === id);
}

function linkSpriteBySource(container: HTMLElement, sourceId: string): MockNode | undefined {
  const { linksContainer } = getContainers(container);
  return linksContainer?.children?.find((s) => s.label?.startsWith(`${sourceId}->`));
}

describe("ForceGraph", () => {
  it("renders visible nodes and edges", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
    ];
    const edges = [{ source: "A.md", target: "B.md" }];

    const { container } = render(
      <ForceGraph nodes={nodes} edges={edges} />
    );

    await waitFor(() => {
      const { nodesContainer, linksContainer } = getContainers(container);
      expect(nodesContainer?.children?.filter((s) => s.visible).length).toBe(2);
      expect(linksContainer?.children?.filter((s) => s.visible).length).toBe(1);
    });
  });

  it("renders all nodes and edges without a timeline", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-03T00:00:00.000Z" },
      { id: "C.md", createdAt: "2024-01-05T00:00:00.000Z" },
    ];
    const edges = [
      { source: "A.md", target: "B.md" },
      { source: "B.md", target: "C.md" },
    ];

    const { container } = render(<ForceGraph nodes={nodes} edges={edges} />);

    await waitFor(() => {
      const { nodesContainer, linksContainer } = getContainers(container);
      expect(nodesContainer?.children?.filter((s) => s.visible).length).toBe(3);
      expect(linksContainer?.children?.filter((s) => s.visible).length).toBe(2);
    });
  });

  it("shows an HTML filename label and highlights the hovered node + its links", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
      { id: "C.md", createdAt: "2024-01-03T00:00:00.000Z" },
    ];
    const edges = [
      { source: "A.md", target: "B.md" },
      { source: "B.md", target: "C.md" },
    ];

    const { container } = render(
      <ForceGraph nodes={nodes} edges={edges} />
    );

    await waitFor(() => {
      const { nodesContainer } = getContainers(container);
      expect(nodesContainer?.children?.filter((s) => s.visible).length).toBe(3);
    });

    const nodeA = nodeSpriteById(container, "A.md")!;

    act(() => {
      nodeA.emit!("pointerover", { stopPropagation: () => {} });
    });

    await waitFor(() => {
      expect(container.querySelector("[data-testid='kg-node-label']")).toBeTruthy();
    });

    expect(container.querySelector("[data-testid='kg-node-label']")?.textContent).toBe("A.md");

    const linkAB = linkSpriteBySource(container, "A.md")!;
    const linkBC = linkSpriteBySource(container, "B.md")!;
    expect(linkAB.alpha).toBe(1);
    expect(linkBC.alpha).toBe(0.08);

    const nodeB = nodeSpriteById(container, "B.md")!;
    const nodeC = nodeSpriteById(container, "C.md")!;
    expect(nodeB.alpha).toBe(1);
    expect(nodeC.alpha).toBe(0.15);
    expect(nodeA.scale!.x).toBeGreaterThan(nodeB.scale!.x);
  });

  it("positions the hover label at the node immediately when it mounts", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
    ];
    const edges = [{ source: "A.md", target: "B.md" }];

    const { container } = render(<ForceGraph nodes={nodes} edges={edges} />);

    await waitFor(() => {
      const { nodesContainer } = getContainers(container);
      expect(nodesContainer?.children?.filter((s) => s.visible).length).toBe(2);
    });

    const nodeA = nodeSpriteById(container, "A.md")!;

    act(() => {
      nodeA.emit!("pointerover", { stopPropagation: () => {} });
    });

    const labelEl = container.querySelector<HTMLElement>("[data-testid='kg-node-label']")!;
    expect(labelEl).toBeTruthy();
    // The label must be positioned when it mounts, not left at the wrapper's
    // top-left until some later simulation tick / drag repositions it.
    expect(labelEl.style.transform).not.toBe("");
    expect(labelEl.style.transform).toContain("translate3d");
  });

  it("dims leaf nodes as edge nodes but leaves hubs and isolated nodes bright", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
      { id: "C.md", createdAt: "2024-01-03T00:00:00.000Z" },
      { id: "D.md", createdAt: "2024-01-04T00:00:00.000Z" },
      { id: "E.md", createdAt: "2024-01-05T00:00:00.000Z" },
    ];
    const edges = [
      { source: "A.md", target: "B.md" },
      { source: "B.md", target: "C.md" },
      { source: "B.md", target: "D.md" },
    ];

    const { container } = render(
      <ForceGraph nodes={nodes} edges={edges} />
    );

    await waitFor(() => {
      const { nodesContainer } = getContainers(container);
      expect(nodesContainer?.children?.filter((s) => s.visible).length).toBe(5);
    });

    const leafA = nodeSpriteById(container, "A.md")!;
    const leafC = nodeSpriteById(container, "C.md")!;
    const leafD = nodeSpriteById(container, "D.md")!;
    const hubB = nodeSpriteById(container, "B.md")!;
    const isolatedE = nodeSpriteById(container, "E.md")!;

    expect(leafA.tint).not.toBe(hubB.tint);
    expect(leafC.tint).not.toBe(hubB.tint);
    expect(leafD.tint).not.toBe(hubB.tint);
    expect(isolatedE.tint).toBe(hubB.tint);
  });

  it("clears the highlight and hides the label on mouseout", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
    ];
    const edges = [{ source: "A.md", target: "B.md" }];

    const { container } = render(
      <ForceGraph nodes={nodes} edges={edges} />
    );

    await waitFor(() => {
      const { nodesContainer } = getContainers(container);
      expect(nodesContainer?.children?.filter((s) => s.visible).length).toBe(2);
    });

    const nodeA = nodeSpriteById(container, "A.md")!;
    act(() => {
      nodeA.emit!("pointerover", { stopPropagation: () => {} });
    });

    await waitFor(() => {
      expect(container.querySelector("[data-testid='kg-node-label']")).toBeTruthy();
    });

    act(() => {
      nodeA.emit!("pointerout", { stopPropagation: () => {} });
    });

    await waitFor(() => {
      const labelEl = container.querySelector("[data-testid='kg-node-label']");
      expect(labelEl).toBeTruthy();
      expect(labelEl).toHaveClass("opacity-0");
      expect(nodeA.alpha).toBe(1);
    });
  });

  it("tears down without throwing when the app is destroyed before the world", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
    ];
    const edges = [{ source: "A.md", target: "B.md" }];

    const { container, unmount } = render(
      <ForceGraph nodes={nodes} edges={edges} />
    );

    await waitFor(() => {
      const { nodesContainer } = getContainers(container);
      expect(nodesContainer?.children?.length).toBe(2);
    });

    // Navigating away unmounts the component. usePixiApp's cleanup destroys the
    // Application (nulling app.stage) before the build effect's teardownWorld
    // runs, which used to dereference the nulled stage and throw.
    expect(() => unmount()).not.toThrow();
  });

  it("moves the dragged node and its incident links immediately during a drag", async () => {
    const nodes = [
      { id: "A.md", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "B.md", createdAt: "2024-01-02T00:00:00.000Z" },
      { id: "C.md", createdAt: "2024-01-03T00:00:00.000Z" },
    ];
    const edges = [
      { source: "A.md", target: "B.md" },
      { source: "B.md", target: "C.md" },
    ];

    const { container } = render(
      <ForceGraph nodes={nodes} edges={edges} />
    );

    await waitFor(() => {
      const { nodesContainer } = getContainers(container);
      expect(nodesContainer?.children?.filter((s) => s.visible).length).toBe(3);
    });

    const nodeB = nodeSpriteById(container, "B.md")!;
    const linkAB = linkSpriteBySource(container, "A.md")!;
    const linkBC = linkSpriteBySource(container, "B.md")!;

    const startX = 100;
    const startY = 100;
    const dx = 150;
    const dy = 40;

    act(() => {
      nodeB.emit!("pointerdown", {
        client: { x: startX, y: startY },
        stopPropagation: () => {},
        preventDefault: () => {},
      });
    });

    const moveEvent = new MouseEvent("pointermove", {
      bubbles: true,
      clientX: startX + dx,
      clientY: startY + dy,
    });
    document.dispatchEvent(moveEvent);

    expect(nodeB.x).toBe(startX + dx);
    expect(nodeB.y).toBe(startY + dy);
    expect(linkAB.width).toBeGreaterThan(0);
    expect(linkBC.width).toBeGreaterThan(0);
  });
});
