import { act, render } from "@testing-library/react"
import * as THREE from "three"

import { HomeCanvas } from "@/components/home/home-canvas"
import {
  cameraMoved,
  cameraTakenOver,
  getSceneState,
  selectHotspot,
  viewEngagesGreeting,
} from "@/components/home/home-scene-controller"
import { registerHomeScene } from "@/components/home/home-scene-resolver"

// R3F/drei never run under jsdom (no WebGL), so the scene is driven through
// mocked <Canvas>/<OrbitControls> that capture the handlers the tests trigger.
// The mock factories reference only the `jest` global and `mock*` holders —
// jest forbids out-of-scope references in factories (require() is also banned
// by the typescript lint rules), and `jest.requireActual` pulls in React
// without hitting either restriction.
//
// What this file covers is what HomeCanvas decides for itself: the view a fresh
// mount starts on, and the OrbitControls baseline that keeps the first frame
// from reading as a visitor take-over. The interaction state machine itself is
// tested in home-scene-controller.test.ts, where it needs no JSX at all.
const mockCamera = {
  position: new THREE.Vector3(0, 1.6, 3.4),
  fov: 45,
}

const mockCanvas: {
  onPointerMissed?: () => void
} = {}

const mockOrbitControls: {
  onStart?: () => void
  onChange?: () => void
  updateCalls: number
} = { updateCalls: 0 }

jest.mock("@react-three/fiber", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  return {
    // R3F's reconciler maps intrinsic lowercase elements (<hemisphereLight>,
    // <directionalLight>) to three objects; a DOM reconciler would report them
    // as unknown tags. Drop intrinsic elements so only the real components
    // (SceneController) mount and register their handlers.
    Canvas: ({
      children,
      onPointerMissed,
    }: {
      children: unknown
      onPointerMissed?: () => void
    }) => {
      mockCanvas.onPointerMissed = onPointerMissed
      const components = React.Children.toArray(children as React.ReactNode).filter(
        (child): boolean => typeof (child as { type?: unknown }).type !== "string",
      )
      return React.createElement("div", null, components)
    },
    useFrame: () => {},
    useThree: () => mockCamera,
  }
})

jest.mock("@react-three/drei", () => ({
  useProgress: () => ({ active: false, progress: 0 }),
}))

// The model is the scene's content, not its camera wiring: it needs a GLB to
// load and has its own concerns. HomeCanvas's decisions are the subject here.
jest.mock("@/components/home/model-object", () => ({
  ModelObject: () => null,
}))

// HomeCanvas renders HomeOrbitControls (three's current OrbitControls) rather
// than drei's. Mock it the same way the drei <OrbitControls> used to be mocked:
// expose a ref handle whose update() records the call and, once the 'change'
// listener is attached in the passive effect below, dispatches it — the
// dispatch path that would clear the selected view if the sync ran too late.
jest.mock("@/components/home/home-orbit-controls", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const MockOrbitControls = React.forwardRef(
    (props: { onStart?: () => void; onChange?: () => void }, ref: unknown) => {
      if (ref && typeof ref === "object") {
        ;(ref as { current: unknown }).current = {
          target: mockCamera.position.clone(),
          update: () => {
            mockOrbitControls.updateCalls += 1
            mockOrbitControls.onChange?.()
          },
        }
      }
      React.useEffect(() => {
        mockOrbitControls.onStart = props.onStart
        mockOrbitControls.onChange = props.onChange
      }, [props.onStart, props.onChange])
      return null
    },
  )
  MockOrbitControls.displayName = "MockOrbitControls"
  return { HomeOrbitControls: MockOrbitControls }
})

describe("HomeCanvas camera interaction", () => {
  beforeEach(() => {
    registerHomeScene(null)
    cameraTakenOver()
    cameraMoved()
    mockCanvas.onPointerMissed = undefined
    mockOrbitControls.onStart = undefined
    mockOrbitControls.onChange = undefined
    mockOrbitControls.updateCalls = 0
  })

  // A scene the car hotspot can actually resolve against, so selecting it arms
  // a flight: without a registered scene resolveHomeHotspot returns null and
  // selectHotspot is a no-op, which would make the two tests below vacuous.
  function registerCarScene() {
    const scene = new THREE.Group()
    const car = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1))
    car.name = "XiaomiSu7Ultra"
    scene.add(car)
    const camera = new THREE.Object3D()
    camera.name = "CameraXiaomi"
    camera.position.set(-1.44, 0.9, 1.7)
    scene.add(camera)
    registerHomeScene(scene)
  }

  it("loads already framed on the load view with the greeting engaged", () => {
    render(<HomeCanvas />)

    // The load view is the desk (whose authored camera the scene snaps to once
    // it resolves) and it keeps the greeting engaged, so a fresh page greets
    // without a click.
    expect(getSceneState().activeView).toBe("desk")
    expect(viewEngagesGreeting(getSceneState().activeView)).toBe(true)
  })

  it("syncs the controls baseline on mount so the initial camera seat doesn't clear the view", () => {
    render(<HomeCanvas />)

    // The mount-time useLayoutEffect calls controls.update() exactly once,
    // before the 'change' listener is attached. Without it, OrbitControls'
    // first frame-loop update() (lastPosition seeded at the origin) reads the
    // camera seated at the load view as a user move and clears the selection
    // before the intro can type. The sync must stay silent: update() is
    // dispatched here, and the view survives it.
    expect(mockOrbitControls.updateCalls).toBe(1)
    expect(getSceneState().activeView).toBe("desk")
  })

  it("clears the view when a take-over drag moves the camera", () => {
    registerCarScene()
    render(<HomeCanvas />)
    act(() => selectHotspot("car"))
    expect(getSceneState().activeView).toBe("car")

    // A real drag, in the order OrbitControls dispatches it: 'start' on
    // pointerdown stops the flight, then the camera actually moves and
    // 'change' follows. The take-over itself must not be what decides the
    // selection — by the time 'change' arrives the flight is already cleared,
    // so cameraMoved reads it as the visitor's move and dismisses. That is the
    // behaviour CONTEXT.md's Take-over entry describes.
    act(() => {
      mockOrbitControls.onStart?.()
      mockOrbitControls.onChange?.()
    })

    expect(getSceneState().activeView).toBeNull()
  })

  it("keeps the view while the flight itself is moving the camera", () => {
    registerCarScene()
    render(<HomeCanvas />)
    act(() => selectHotspot("car"))

    // The tween drives controls.update() every frame of the flight, each of
    // which dispatches 'change'. Those are the flight, not the visitor: if they
    // dismissed the view, it would clear the instant it was chosen and no
    // fly-to could ever hold its selection.
    act(() => {
      for (let frame = 0; frame < 5; frame++) mockOrbitControls.onChange?.()
    })

    expect(getSceneState().activeView).toBe("car")
  })

  it("does nothing when empty space is clicked — no default-framing reset handler", () => {
    render(<HomeCanvas />)

    // Clicking empty space must not reset the camera to the default framing (or
    // touch the selection), so no onPointerMissed handler may be installed.
    expect(mockCanvas.onPointerMissed).toBeUndefined()
  })
})
