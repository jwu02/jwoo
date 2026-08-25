import { act, fireEvent, render, screen } from "@testing-library/react"
import * as THREE from "three"

import { HomeCanvas } from "@/components/home/home-canvas"
import { getHeroMode, setHeroMode } from "@/components/home/home-hero-store"
import { registerHomeScene } from "@/components/home/home-scene-resolver"
import { getActiveView, setActiveView } from "@/components/home/home-view-store"
import type { FocusRequest } from "@/components/home/scene-focus"

// R3F/drei never run under jsdom (no WebGL), so the scene is driven through
// mocked <Canvas>/<OrbitControls> that capture the handlers the tests trigger.
// The mock factories reference only the `jest` global and `mock*` holders —
// jest forbids out-of-scope references in factories (require() is also banned
// by the typescript lint rules), and `jest.requireActual` pulls in React
// without hitting either restriction.
const mockCamera = {
  position: new THREE.Vector3(0, 1.6, 3.4),
  fov: 45,
}

const mockCanvas: {
  onPointerMissed?: () => void
} = {}

const mockOrbitControls: {
  onChange?: () => void
  updateCalls: number
} = { updateCalls: 0 }

const mockSceneModels: {
  onFocus?: (request: FocusRequest) => void
} = {}

jest.mock("@react-three/fiber", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  return {
    // R3F's reconciler maps intrinsic lowercase elements (<ambientLight>,
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

// HomeCanvas renders HomeOrbitControls (three's current OrbitControls) rather
// than drei's. Mock it the same way the drei <OrbitControls> used to be mocked:
// expose a ref handle whose update() records the call and, once the 'change'
// listener is attached in the passive effect below, dispatches it — the
// dispatch path that would dismiss the greeting if the sync ran too late.
jest.mock("@/components/home/home-orbit-controls", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const MockOrbitControls = React.forwardRef(
    (
      props: { onChange?: () => void },
      ref: unknown,
    ) => {
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
        mockOrbitControls.onChange = props.onChange
      }, [props.onChange])
      return null
    },
  )
  MockOrbitControls.displayName = "MockOrbitControls"
  return { HomeOrbitControls: MockOrbitControls }
})

jest.mock("@/components/home/scene-models", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  return {
    SceneModels: ({ onFocus }: { onFocus: (request: FocusRequest) => void }) => {
      React.useEffect(() => {
        mockSceneModels.onFocus = onFocus
      }, [onFocus])
      return null
    },
  }
})

describe("HomeCanvas camera interaction", () => {
  beforeEach(() => {
    setHeroMode("intro")
    setActiveView(null)
    registerHomeScene(null)
    mockCanvas.onPointerMissed = undefined
    mockOrbitControls.onChange = undefined
    mockOrbitControls.updateCalls = 0
    mockSceneModels.onFocus = undefined
  })

  it("loads already framed on the desk view with the greeting engaged", () => {
    render(<HomeCanvas />)

    // The desk view is the initial view (hero starts engaged so the typed
    // greeting is up without a click) and the desk switcher button is active.
    expect(getHeroMode()).toBe("macbook")
    expect(getActiveView()).toBe("desk")
  })

  it("syncs the controls baseline on mount so the initial camera seat doesn't dismiss the greeting", () => {
    render(<HomeCanvas />)

    // The mount-time useLayoutEffect calls controls.update() exactly once,
    // before the 'change' listener is attached. Without it, OrbitControls'
    // first frame-loop update() (lastPosition seeded at the origin) reads the
    // camera seated at the desk preset as a user move and dismisses the
    // greeting before the intro can type. The sync must stay silent: the
    // greeting stays engaged and the desk view stays active.
    expect(mockOrbitControls.updateCalls).toBe(1)
    expect(getHeroMode()).toBe("macbook")
    expect(getActiveView()).toBe("desk")
  })

  it("does nothing when empty space is clicked — no default-framing reset handler", () => {
    render(<HomeCanvas />)

    // Clicking empty space must not reset the camera to the default framing
    // (or touch the hero mode), so no onPointerMissed handler may be installed.
    expect(mockCanvas.onPointerMissed).toBeUndefined()
  })

  it("dismisses the engaged greeting when the camera moves after the fly-to settles", () => {
    render(<HomeCanvas />)
    setHeroMode("macbook")
    expect(getHeroMode()).toBe("macbook")

    // A user-initiated camera move fires OrbitControls 'change' with no tween
    // in flight — the greeting should disappear.
    mockOrbitControls.onChange?.()

    expect(getHeroMode()).toBe("intro")
  })

  it("keeps the greeting while the fly-to tween is still in flight", () => {
    render(<HomeCanvas />)
    // Simulate the MacBook click: arm its framing fly-to (sets the tween).
    mockSceneModels.onFocus?.({
      point: [0, 0.78, 0],
      radius: 0,
      cameraPos: [0, 0.8, 1.0],
    })
    setHeroMode("macbook")

    // 'change' also fires during the tween (controls.update runs each frame),
    // so the greeting must stay visible until the tween settles.
    mockOrbitControls.onChange?.()

    expect(getHeroMode()).toBe("macbook")
  })

  it("flies to the car view, marks it active, and dismisses the greeting when the car button is clicked", () => {
    // The switcher resolves against the loaded scene, which ModelObject
    // registers in the real app; provide a stand-in so the car hotspot resolves
    // to its authored CameraXiaomi view.
    const scene = new THREE.Group()
    const car = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1))
    car.name = "XiaomiSu7Ultra"
    car.position.set(1, 0, 1)
    scene.add(car)
    const camera = new THREE.Object3D()
    camera.name = "CameraXiaomi"
    camera.position.set(5, 6, 7)
    scene.add(camera)
    registerHomeScene(scene)

    render(<HomeCanvas />) // loads on the desk view with the greeting engaged

    fireEvent.click(screen.getByRole("button", { name: "Xiaomi SU7" }))

    // The switch flies to the authored view and marks the car active; the car
    // preset's hero is "intro", so the greeting is dismissed.
    expect(getActiveView()).toBe("car")
    expect(getHeroMode()).toBe("intro")
  })

  it("clears the active view when the camera moves after the fly-to settles", () => {
    render(<HomeCanvas />)
    // HomeCanvas subscribes to the store, so mutations happen inside act.
    act(() => setActiveView("desk"))
    expect(getActiveView()).toBe("desk")

    // A user-initiated camera move fires OrbitControls 'change' with no tween
    // in flight — the switcher should un-highlight.
    act(() => mockOrbitControls.onChange?.())

    expect(getActiveView()).toBeNull()
  })

  it("keeps the active view while the fly-to tween is still in flight", () => {
    render(<HomeCanvas />)
    // Arm a fly-to so 'change' during the tween doesn't count as a user move.
    mockSceneModels.onFocus?.({
      point: [0, 0.78, 0],
      radius: 0,
      cameraPos: [0, 0.8, 1.0],
    })
    act(() => setActiveView("desk"))

    act(() => mockOrbitControls.onChange?.())

    expect(getActiveView()).toBe("desk")
  })
})
