import { cleanup, render } from "@testing-library/react"
import { createRef } from "react"
import { PerspectiveCamera } from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"

import { HomeOrbitControls, type HomeOrbitControlsProps } from "@/components/home/home-orbit-controls"

// HomeOrbitControls mounts the REAL three OrbitControls, so it needs a working
// R3F store to pull camera/gl/events from. The mock replays selectors against
// this store; useFrame is a no-op because the test drives update() explicitly.
// The mock factory references only module-scope `mock*` holders (jest forbids
// out-of-scope references), the same pattern home-canvas.test.tsx uses.
const mockStore: {
  camera: PerspectiveCamera
  gl: { domElement: HTMLDivElement }
  events: { connected: HTMLDivElement }
  controls: unknown
  set: (partial: Record<string, unknown>) => void
  get: () => { controls: unknown }
} = {
  camera: new PerspectiveCamera(45, 1, 0.1, 100),
  gl: { domElement: document.createElement("div") },
  events: { connected: document.createElement("div") },
  controls: null,
  set: (partial) => Object.assign(mockStore, partial),
  get: () => ({ controls: mockStore.controls }),
}

jest.mock("@react-three/fiber", () => ({
  useThree: (selector: (state: typeof mockStore) => unknown) => selector(mockStore),
  useFrame: () => {},
}))

afterEach(cleanup)

function renderControls(props: HomeOrbitControlsProps) {
  const controlsRef = createRef<OrbitControls>()
  render(<HomeOrbitControls ref={controlsRef} {...props} />)
  return controlsRef
}

describe("HomeOrbitControls", () => {
  beforeEach(() => {
    mockStore.camera.position.set(0, 0, 10)
    mockStore.controls = null
    // Fresh event target each test so a previous test's still-connected controls
    // instance never sees this test's wheel events.
    mockStore.events.connected = document.createElement("div")
  })

  it("exposes the controls instance via ref and applies the tuning props", () => {
    const controlsRef = renderControls({
      target: [0, 1, 0],
      zoomSpeed: 0.5,
      dampingFactor: 0.08,
      maxPolarAngle: Math.PI / 2.05,
      minDistance: 0.7,
      maxDistance: 8,
    })

    const controls = controlsRef.current
    expect(controls).toBeInstanceOf(OrbitControls)
    expect(controls?.target.toArray()).toEqual([0, 1, 0])
    expect(controls?.zoomSpeed).toBe(0.5)
    expect(controls?.dampingFactor).toBe(0.08)
    expect(controls?.maxPolarAngle).toBeCloseTo(Math.PI / 2.05)
    expect(controls?.minDistance).toBe(0.7)
    expect(controls?.maxDistance).toBe(8)
  })

  it("scales the wheel zoom step with the scroll delta (trackpad momentum fix)", () => {
    // Regression: drei's <OrbitControls> wraps a three-stdlib copy that applies
    // a FIXED zoom step per wheel event regardless of delta, so the decaying
    // burst of wheel events macOS fires after a swipe keeps zooming the scene
    // after the fingers lift. The controls used here must scale the step with
    // |deltaY| — a big wheel delta zooms more than a small one.
    const controlsRef = renderControls({
      target: [0, 0, 0],
      zoomSpeed: 0.5,
      minDistance: 0.1,
      maxDistance: 100,
    })
    const controls = controlsRef.current!
    const wheelTarget = mockStore.events.connected
    const distance = () => mockStore.camera.position.distanceTo(controls.target)

    controls.update()
    const d0 = distance()
    wheelTarget.dispatchEvent(new WheelEvent("wheel", { deltaY: -10 }))
    const smallZoom = d0 - distance() // scroll up = zoom in

    mockStore.camera.position.set(0, 0, 10)
    controls.update()
    const d1 = distance()
    wheelTarget.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }))
    const bigZoom = d1 - distance()

    expect(smallZoom).toBeGreaterThan(0)
    expect(bigZoom).toBeGreaterThan(smallZoom)
  })

  it("fires onStart/onChange from a real wheel zoom", () => {
    // The scene wires onStart to cancel an in-flight fly-to when the user takes
    // over, and onChange to dismiss the greeting once the camera moves — both
    // must fire from real control events, including wheel zoom.
    const onStart = jest.fn()
    const onChange = jest.fn()
    renderControls({
      target: [0, 0, 0],
      onStart,
      onChange,
    })
    const wheelTarget = mockStore.events.connected

    wheelTarget.dispatchEvent(new WheelEvent("wheel", { deltaY: -50 }))

    expect(onStart).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalled()
  })
})
