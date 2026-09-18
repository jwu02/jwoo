import * as THREE from "three"

import {
  cameraMoved,
  cameraTakenOver,
  flyToSettled,
  getFlyTo,
  getSceneState,
  resetToInitial,
  selectHotspot,
  setFlyToPosition,
  subscribeSceneState,
  viewEngagesGreeting,
} from "@/components/home/home-scene-controller"
import { registerHomeScene } from "@/components/home/home-scene-resolver"

// A stand-in for the loaded homepage.glb: the Desk and car nodes with their
// authored cameras, plus a bottle for the bbox-fit path. Positions mirror the
// real scene closely enough to make the resolved framing checkable.
function makeScene() {
  const scene = new THREE.Group()

  const desk = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1))
  desk.name = "Desk"
  desk.position.set(1, 2, 3)
  scene.add(desk)
  const cameraDesk = new THREE.Object3D()
  cameraDesk.name = "CameraDesk"
  cameraDesk.position.set(5, 6, 7)
  scene.add(cameraDesk)

  const car = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1))
  car.name = "XiaomiSu7Ultra"
  car.position.set(-2.48, 0.55, -0.92)
  scene.add(car)
  const cameraCar = new THREE.Object3D()
  cameraCar.name = "CameraXiaomi"
  cameraCar.position.set(-1.44, 0.9, 1.7)
  scene.add(cameraCar)

  const bottle = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2))
  bottle.name = "WaterBottle"
  bottle.position.set(0, 1, 0)
  scene.add(bottle)

  return scene
}

// The controller is a module singleton, so each test starts from the state a
// freshly navigated page has: nothing registered, nothing flying, nothing
// selected. Done through the public interface rather than by reaching into the
// module, so the test exercises the same doors production does.
beforeEach(() => {
  registerHomeScene(null)
  cameraTakenOver()
  cameraMoved()
})

describe("homeSceneController selection", () => {
  it("starts with no view selected", () => {
    expect(getSceneState().activeView).toBeNull()
    expect(getFlyTo()).toBeNull()
  })

  it("selects a view and arms the flight to its authored camera", () => {
    registerHomeScene(makeScene())

    selectHotspot("car")

    const flight = getFlyTo()!
    expect(getSceneState().activeView).toBe("car")
    // The camera flies to the GLB-authored CameraXiaomi pose, aimed along its
    // gaze (CameraXiaomi is at [-1.44,0.9,1.7] looking down -z, so the orbit
    // target is where that gaze passes the car's bbox center).
    expect(flight.pos).toEqual([-1.44, 0.9, 1.7])
    expect(flight.radius).toBe(0)
    expect(flight.target[0]).toBeCloseTo(-1.44, 6)
    expect(flight.target[1]).toBeCloseTo(0.9, 6)
    expect(flight.target[2]).toBeCloseTo(-0.92, 6)
  })

  it("arms a fit with no camera position, for the canvas to resolve", () => {
    registerHomeScene(makeScene())

    selectHotspot("bottle")

    const flight = getFlyTo()!
    expect(getSceneState().activeView).toBe("bottle")
    // A bbox fit has no authored camera: how far back the camera sits depends on
    // its fov and the direction it is already looking, which only the canvas
    // knows. The radius is what it needs to work that out on the first frame.
    expect(flight.pos).toBeNull()
    expect(flight.radius).toBeCloseTo(Math.sqrt(3), 2)
    expect(flight.target).toEqual([0, 1, 0])
  })

  it("re-arms the flight when the same view is selected again", () => {
    registerHomeScene(makeScene())
    selectHotspot("car")
    flyToSettled()
    expect(getFlyTo()).toBeNull()

    selectHotspot("car")

    expect(getFlyTo()).not.toBeNull()
  })

  it("ignores a hotspot that has no view of its own", () => {
    registerHomeScene(makeScene())

    // The MacBook navigates to a page rather than being framed, so selecting it
    // must not half-apply: no flight, no selection.
    selectHotspot("macbook")

    expect(getFlyTo()).toBeNull()
    expect(getSceneState().activeView).toBeNull()
  })

  it("ignores an unknown id", () => {
    registerHomeScene(makeScene())

    selectHotspot("not-a-hotspot")

    expect(getFlyTo()).toBeNull()
    expect(getSceneState().activeView).toBeNull()
  })

  it("does nothing before the scene has resolved", () => {
    // The GLB is still streaming: there is no node to frame, so the pill must
    // not light up for a view the camera could not reach.
    selectHotspot("car")

    expect(getFlyTo()).toBeNull()
    expect(getSceneState().activeView).toBeNull()
  })

  it("records the camera position the canvas resolved for a fit", () => {
    registerHomeScene(makeScene())
    selectHotspot("bottle")

    setFlyToPosition([0, 1, 5])

    expect(getFlyTo()!.pos).toEqual([0, 1, 5])
  })

  it("drops a late fit position once the flight has been cancelled", () => {
    registerHomeScene(makeScene())
    selectHotspot("bottle")
    cameraTakenOver()

    // The frame loop can be a frame behind the take-over; a stale position must
    // not resurrect the cancelled flight.
    setFlyToPosition([0, 1, 5])

    expect(getFlyTo()).toBeNull()
  })
})

describe("homeSceneController camera take-over", () => {
  it("clears the selected view when the camera moves after the flight settles", () => {
    registerHomeScene(makeScene())
    selectHotspot("car")
    flyToSettled()

    cameraMoved()

    expect(getSceneState().activeView).toBeNull()
  })

  it("keeps the selected view while the flight is still in flight", () => {
    registerHomeScene(makeScene())
    selectHotspot("car")

    // controls.update() runs every frame of a fly-to, so 'change' fires
    // throughout the flight. That is the tween tracking its target, not the
    // visitor moving the camera — the view must survive it.
    cameraMoved()

    expect(getSceneState().activeView).toBe("car")
  })

  it("cancels the flight on take-over without clearing the view", () => {
    registerHomeScene(makeScene())
    selectHotspot("car")

    cameraTakenOver()

    // The visitor has the camera now — the tween must stop fighting them — but
    // grabbing it mid-flight is not a dismissal of the view they asked for.
    expect(getFlyTo()).toBeNull()
    expect(getSceneState().activeView).toBe("car")
  })

  it("clears the view on the next camera move after a take-over", () => {
    registerHomeScene(makeScene())
    selectHotspot("car")
    cameraTakenOver()

    cameraMoved()

    expect(getSceneState().activeView).toBeNull()
  })
})

describe("resetToInitial", () => {
  it("marks the load view selected without flying anywhere", () => {
    resetToInitial()

    // A fresh scene is already seated on the load view by the canvas's camera
    // props; arming a flight would tween zero distance and could out-race the
    // first frame's snap to the authored pose.
    expect(getFlyTo()).toBeNull()
    expect(getSceneState().activeView).toBe("desk")
  })

  it("re-selects the load view after the visitor took the camera over", () => {
    registerHomeScene(makeScene())
    selectHotspot("car")
    cameraTakenOver()
    cameraMoved()
    expect(getSceneState().activeView).toBeNull()

    resetToInitial()

    expect(getSceneState().activeView).toBe("desk")
  })
})

describe("viewEngagesGreeting", () => {
  it("is true for the load view — a fresh scene greets without a click", () => {
    expect(viewEngagesGreeting("desk")).toBe(true)
  })

  it("is false for a view that does not ask for it", () => {
    expect(viewEngagesGreeting("car")).toBe(false)
    expect(viewEngagesGreeting("bottle")).toBe(false)
  })

  it("is false when no view is selected", () => {
    expect(viewEngagesGreeting(null)).toBe(false)
  })
})

describe("homeSceneController subscription", () => {
  it("notifies subscribers on change and stops after unsubscribe", () => {
    registerHomeScene(makeScene())
    const listener = jest.fn()
    const unsubscribe = subscribeSceneState(listener)

    selectHotspot("car")
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    cameraTakenOver()
    cameraMoved()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("does not notify when the selection does not change", () => {
    registerHomeScene(makeScene())
    selectHotspot("car")
    const listener = jest.fn()
    subscribeSceneState(listener)

    selectHotspot("car")

    expect(listener).not.toHaveBeenCalled()
  })
})
