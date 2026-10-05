/**
 * @jest-environment node
 */
import { createController, NO_INTENT } from "@/lib/tetris/controller"

describe("the keyboard Controller", () => {
  it("idles with nothing held", () => {
    const controller = createController()
    expect(controller.nextIntent()).toEqual(NO_INTENT)
  })

  it("holds a direction until it is released", () => {
    const controller = createController()
    controller.setDirection("left", true)
    expect(controller.nextIntent()).toEqual({ ...NO_INTENT, left: true })
    expect(controller.nextIntent()).toEqual({ ...NO_INTENT, left: true })
    controller.setDirection("left", false)
    expect(controller.nextIntent()).toEqual(NO_INTENT)
  })

  it("remembers a tap that ends between two Ticks", () => {
    const controller = createController()
    // A key pressed and released inside one frame still counts as one Tick of
    // that direction — the held flag is already false when it is read.
    controller.setDirection("right", true)
    controller.setDirection("right", false)
    expect(controller.nextIntent()).toEqual({ ...NO_INTENT, right: true })
    // …and the tap lasts exactly one Tick.
    expect(controller.nextIntent()).toEqual(NO_INTENT)
  })

  it("does not remember a soft-drop tap, which is a held flag", () => {
    const controller = createController()
    controller.setDirection("down", true)
    controller.setDirection("down", false)
    expect(controller.nextIntent()).toEqual(NO_INTENT)
  })

  it("pays a one-shot action exactly once", () => {
    const controller = createController()
    controller.press("rotateCW")
    controller.press("hardDrop")
    controller.press("hold")
    expect(controller.nextIntent()).toEqual({
      ...NO_INTENT,
      rotateCW: true,
      hardDrop: true,
      hold: true,
    })
    expect(controller.nextIntent()).toEqual(NO_INTENT)
  })

  it("forgets everything on reset", () => {
    const controller = createController()
    controller.setDirection("left", true)
    controller.setDirection("down", true)
    controller.press("hold")
    controller.reset()
    expect(controller.nextIntent()).toEqual(NO_INTENT)
  })
})
