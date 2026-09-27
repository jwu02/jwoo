import * as d3 from "d3";
import {
  computeFocusTransform,
  computeReanchorTransform,
  GRAPH_ANIMATION_MS,
  NODE_MAX_ZOOM,
  NODE_MIN_ZOOM,
  planFit,
  type FitPlan,
  type FitTrigger,
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
// simulation has given it so far. The array is the simulation's own, held by
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
  // The layout has moved. Only the first one of these frames anything: the
  // seeded positions are all there is to see until the layout settles.
  layoutTicked(): void;
  // The layout has come to rest: re-frame a held focus against the positions
  // that now mean something, or fit the whole graph.
  layoutSettled(): void;
  // The note the page has taken the Focus, or null when it is over. A note
  // already flown to is not a new flight — a rebuild hands over new arrays for
  // the same focus, and the settle that follows re-frames it.
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
  let firstTickFramed = false;
  // The focus the camera has been given, which is what tells the fits to hold
  // off and what a settled layout re-frames.
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

  const applyFit = (plan: FitPlan) => {
    const { k, x, y } = plan.transform;
    const target = d3.zoomIdentity.translate(x, y).scale(k);
    if (plan.mode === "snap") {
      selection.call(zoom.transform, target);
    } else {
      selection.transition().duration(plan.durationMs).call(zoom.transform, target);
    }
  };

  const fit = (trigger: FitTrigger) => {
    const plan = planFit(trigger, {
      userInteracted,
      // A note holding the focus is the visitor's claim on the camera, made
      // later and more specifically than the fit's: the framing they asked for
      // is the one that stands.
      focused: focus !== null,
      nodes,
      // The viewport the graph is in now, which the fit is the framing of. Read
      // live rather than taken from the build: a panel that came or went while
      // the layout was still settling leaves the graph a different box to be
      // framed inside.
      viewportWidth: wrapper.clientWidth,
      viewportHeight: wrapper.clientHeight,
    });
    if (plan) applyFit(plan);
  };

  // Takes the camera and eases it to a framing of the graph's own making. The
  // interrupt is not optional: d3 keeps one transition per element, so a fit
  // still in the air would fight this one for the camera.
  const moveTo = (target: Transform) => {
    selection.interrupt();
    selection
      .transition()
      .duration(GRAPH_ANIMATION_MS)
      .call(zoom.transform, d3.zoomIdentity.translate(target.x, target.y).scale(target.k));
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

  const zoom = d3
    .zoom<HTMLElement, unknown>()
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
    .on("zoom", (event: d3.D3ZoomEvent<HTMLElement, unknown>) => {
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

  const selection = d3.select(wrapper).call(zoom);

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
      firstTickFramed = false;
      viewportWidth = wrapper.clientWidth;
    },

    layoutTicked() {
      if (firstTickFramed) return;
      firstTickFramed = true;
      fit("first-tick");
    },

    layoutSettled() {
      // A focus was framed against a layout that has since moved — an early
      // click, or a fresh snapshot's own layout — so the flight is made again
      // rather than a fit taking the camera off the note. The focus outranks
      // the fit either way: planFit plans nothing while one is held.
      if (focus !== null) {
        flyTo(focus);
        return;
      }
      fit("settled");
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
