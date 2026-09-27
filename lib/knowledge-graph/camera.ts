import { select } from "d3-selection";
// Side-effect import: d3-transition is what puts `selection.transition()` on
// the selection prototype, and this camera eases through it.
import "d3-transition";
import { zoom as createZoom, zoomIdentity, type D3ZoomEvent } from "d3-zoom";
import {
  computeFitTransform,
  computeFocusTransform,
  computeReanchorTransform,
  GRAPH_ANIMATION_MS,
  NODE_MAX_ZOOM,
  NODE_MIN_ZOOM,
} from "./framing";
import type { KnowledgeGraphEdge } from "./types";

// A zoom transform: the scale the world is drawn at and the pan it is drawn
// through. The same shape `computeFitTransform` and its siblings return, so a
// framing and the camera that wears it are one vocabulary.
export type Transform = { x: number; y: number; k: number };

// Why a transform changed. A gesture is the visitor's own hand — a wheel, a
// drag, a double-click — and the only kind that can take the camera off a
// framing the visitor asked for. A program move is the graph's own: a fit, a
// focus flight, a re-anchor.
export type TransformCause = "gesture" | "program";

export interface CameraCallbacks {
  // Every transform change, in the event that made it — before React has
  // committed anything, which is what lets the label layer move in the same
  // frame the camera does.
  onTransformChange?: (transform: Transform, by: TransformCause) => void;
  // The camera is about to move into a viewport it has not been drawn in yet.
  // Fires before the move, because a world translated inside a surface still
  // the old width would be drawn off its edge.
  onViewportChange?: () => void;
}

// A node the camera can frame: an id to find it by, and the position the
// simulation has given it. The array is the simulation's own, held by
// reference, so the camera is always framing the layout as it stands.
type CameraNode = { id: string; x?: number; y?: number };

// The graph's whole relationship with the viewport: d3-zoom and the framing
// orchestration around it. The renderer says what the graph is doing — this
// snapshot's layout, the note the page has taken — and the camera decides where
// the viewport stands, in what it does about it, and how.
//
// Everything here is imperative and outside React: the camera is created once
// per mount and hears about the rest through its methods. d3 transitions are
// kept rather than hand-rolled, because the gesture-versus-transition interrupt
// discipline is d3's, and re-deriving it reopens a race that has already been
// debugged once.
export interface Camera {
  // A fresh snapshot: what there is to frame, and the width it is framed in.
  // The viewer's claim on the camera does not survive it — a new graph is a new
  // question about where the camera should be — but a held focus does.
  setLayout(nodes: CameraNode[], edges: KnowledgeGraphEdge[]): void;
  // The snapshot's layout is at rest and about to be drawn: the one moment the
  // camera frames the graph of its own accord. Nothing later moves it — from
  // here the viewer's hand and a focus are the only things that do.
  layoutReady(): void;
  // The note the page has taken the Focus, or null when it is over. A note
  // already flown to is not a new flight — a rebuild hands over new arrays for
  // the same focus, and the layout that follows re-frames it.
  setFocus(noteId: string | null): void;
  // The viewport changed shape under the graph — the note panel opened or
  // collapsed — so the viewer's centre is put back where they left it.
  reanchor(): void;
  // A press on a node is down, or is over. While one is, no gesture reaches
  // d3-zoom: a press is not a camera gesture, and d3 arms its pan from the
  // compatibility mousedown that follows, so a press that turns out to be a
  // click would otherwise have panned the graph by the pixels the hand drifted.
  setPressed(pressed: boolean): void;
  readonly transform: Transform;
  destroy(): void;
}

export function createCamera(
  wrapper: HTMLElement,
  callbacks: CameraCallbacks = {}
): Camera {
  let nodes: CameraNode[] = [];
  let edges: KnowledgeGraphEdge[] = [];
  let transform: Transform = { x: 0, y: 0, k: 1 };
  let pressed = false;
  // Set by the visitor's own camera gesture and by nothing else, and cleared by
  // the next snapshot: a fit yields to a viewer who has moved the camera, but
  // the viewer whose graph was just replaced has not moved this one.
  let userInteracted = false;
  // The focus the camera has been given, which is what the fit holds off for
  // and what a fresh layout is re-framed against.
  let focus: string | null = null;
  // The focus the camera was last flown to. A rebuild hands over new arrays for
  // the same focus, and that is not a new focus: the flight has been made, and
  // the fresh graph is about to frame itself.
  let flownFocus: string | null = null;
  // The width the graph last laid itself out against — measured at build, and
  // re-measured wherever the viewport moves without the camera. A re-anchor
  // owes the viewer only the width that changed under the toggle that asked
  // for it.
  let viewportWidth = 0;

  // Takes the camera and eases it to a framing of the graph's own making. The
  // interrupt is not optional: d3 keeps one transition per element, so a fit
  // still in the air would fight this one for the camera.
  const moveTo = (target: Transform) => {
    selection.interrupt();
    selection
      .transition()
      .duration(GRAPH_ANIMATION_MS)
      .call(zoom.transform, zoomIdentity.translate(target.x, target.y).scale(target.k));
  };

  const flyTo = (noteId: string) => {
    const target = computeFocusTransform(
      noteId,
      nodes,
      edges,
      wrapper.clientWidth,
      wrapper.clientHeight
    );
    if (target) moveTo(target);
  };

  const zoom = createZoom<HTMLElement, unknown>()
    .scaleExtent([NODE_MIN_ZOOM, NODE_MAX_ZOOM])
    // A press on a node is not a camera gesture, and while it is down nothing
    // else is one either. Which gesture d3 is asking about is d3's business —
    // it consults this at the start of each of them, a wheel, a pan, a
    // double-click, a touch — so refusing here refuses all of them.
    .filter((event: { type: string; ctrlKey: boolean; button: number }) => {
      if (pressed) return false;
      // d3's own default, kept as it is: ctrl+wheel is a zoom because the
      // browser's own ctrl+wheel is the page zoom, a drag is the left button's,
      // and ctrl+click belongs to the browser.
      return (!event.ctrlKey || event.type === "wheel") && !event.button;
    })
    .on("zoom", (event: D3ZoomEvent<HTMLElement, unknown>) => {
      // A sourceEvent is the visitor's own hand. The graph's own transitions
      // carry none, which is what tells a flight from the gesture that ends it.
      //
      // What is deliberately *not* here is an interrupt. A gesture takes the
      // camera off whatever the graph was doing, but d3-zoom interrupts the
      // element's transitions itself the moment one begins, before it emits the
      // first zoom of the gesture — and interrupting from here instead would
      // take the graph's own moves down with it: a wheel keeps its gesture live
      // for a moment after the last event, a transition started inside that
      // window reuses that gesture, and every frame of the graph's own camera
      // move would then read as the visitor's hand and cancel it on its first
      // frame.
      const by: TransformCause = event.sourceEvent ? "gesture" : "program";
      if (by === "gesture") {
        userInteracted = true;
        // The camera is the visitor's again: a focus already framed is over,
        // because nothing may go on claiming a note they have panned away
        // from. A dismissal is not a reframe — this is the gesture path.
        focus = null;
        flownFocus = null;
      }
      transform = { x: event.transform.x, y: event.transform.y, k: event.transform.k };
      callbacks.onTransformChange?.(transform, by);
    });

  const selection = select(wrapper).call(zoom);

  // A window resize is not the graph's to compensate for — the surface follows
  // it and the camera is left where the viewer put it — but the width it leaves
  // behind is the viewport the graph is drawn against, and so the one a later
  // panel toggle measures from. Recorded where it happens rather than measured
  // at the toggle, which would take the width the graph had before the window
  // moved and compensate for that as well.
  const recordViewport = () => {
    viewportWidth = wrapper.clientWidth;
  };
  window.addEventListener("resize", recordViewport);

  return {
    setLayout(nextNodes, nextEdges) {
      nodes = nextNodes;
      edges = nextEdges;
      userInteracted = false;
      viewportWidth = wrapper.clientWidth;
    },

    layoutReady() {
      // A focus was framed against a layout that is no longer the one on
      // screen — a rebuild's, or an early click's while it was still being
      // laid out — so the flight is made again against the positions that now
      // mean something. The focus is the visitor's claim on the camera, made
      // later and more specifically than the fit's: the framing they asked for
      // is the one that stands, so no fit is computed under it.
      if (focus !== null) {
        flyTo(focus);
        return;
      }
      // The graph is where the viewer put it: a fit may not move it out from
      // under them. A gesture can land while the layout is still being run, and
      // the frame that arrives after it would be the graph moving itself.
      if (userInteracted) return;

      // Snapped, not eased into: this is the frame the graph is first seen in,
      // drawn in the same turn as the layout it frames, so there is no unframed
      // flash to cover. The viewport is read live rather than taken from the
      // build, because the panel beside the graph may have come or gone while
      // the layout was being run.
      const { k, x, y } = computeFitTransform(
        nodes,
        wrapper.clientWidth,
        wrapper.clientHeight
      );
      selection.call(zoom.transform, zoomIdentity.translate(x, y).scale(k));
    },

    setFocus(noteId) {
      focus = noteId;
      // Nothing is focused, so nothing has been flown to: the next focus — even
      // of this same note — is a new flight. Dismissal never moves the camera.
      if (noteId === null) {
        flownFocus = null;
        return;
      }
      if (flownFocus === noteId) return;
      flownFocus = noteId;
      flyTo(noteId);
    },

    reanchor() {
      const nextWidth = wrapper.clientWidth;
      const previousWidth = viewportWidth;
      viewportWidth = nextWidth;
      // Nothing has been built yet, or the viewport is the one the graph is
      // already drawn against: either way there is nothing to put back.
      if (previousWidth === 0 || nextWidth === previousWidth) return;

      // The surface the world is drawn into follows the viewport it is drawn
      // in: it is still the width the graph was built at, and a canvas the old
      // width would clip the graph at an edge the viewport no longer has.
      callbacks.onViewportChange?.();
      // Not a framing but a compensation: the graph point that was at the
      // centre of the old viewport is put at the centre of the new one, at the
      // zoom the viewer is holding — so it applies from wherever the camera is,
      // including over a viewer who has panned away from every fit.
      moveTo(computeReanchorTransform(transform, previousWidth, nextWidth));
    },

    setPressed(nextPressed) {
      pressed = nextPressed;
    },

    get transform() {
      return transform;
    },

    destroy() {
      selection.on(".zoom", null);
      window.removeEventListener("resize", recordViewport);
    },
  };
}
