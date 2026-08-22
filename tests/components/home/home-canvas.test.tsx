import { render } from "@testing-library/react"
import * as THREE from "three"

import { HomeCanvas } from "@/components/home/home-canvas"
import { getHeroMode, setHeroMode } from "@/components/home/home-hero-store"
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
} = {}

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

jest.mock("@react-three/drei", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const MockOrbitControls = React.forwardRef(
    (
      props: { onChange?: () => void },
      ref: unknown,
    ) => {
      React.useEffect(() => {
        if (ref && typeof ref === "object") {
          // Stub the controls handle so SceneController.flyTo can read
          // controls.target and arm its in-flight tween.
          (ref as { current: unknown }).current = {
            target: mockCamera.position.clone(),
            update: () => {},
          }
        }
        mockOrbitControls.onChange = props.onChange
      }, [ref, props.onChange])
      return null
    },
  )
  MockOrbitControls.displayName = "MockOrbitControls"
  return {
    OrbitControls: MockOrbitControls,
    useProgress: () => ({ active: false, progress: 0 }),
  }
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
    mockCanvas.onPointerMissed = undefined
    mockOrbitControls.onChange = undefined
    mockSceneModels.onFocus = undefined
  })

  it("loads already engaged on the MacBook — the greeting types without a click", () => {
    render(<HomeCanvas />)

    // The initial camera is the MacBook's framing and the hero starts engaged,
    // so the typed greeting is up on first load.
    expect(getHeroMode()).toBe("macbook")
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
})
