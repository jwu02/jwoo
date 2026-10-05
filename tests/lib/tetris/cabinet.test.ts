/**
 * @jest-environment node
 */
import { CABINET, cabinetScale } from "@/lib/tetris/cabinet"

describe("the cabinet's own geometry", () => {
  it("is the prototype's art size, with the well inside it", () => {
    expect(CABINET).toMatchObject({ width: 260, height: 248, cell: 10 })
    expect(CABINET.well.x + CABINET.well.width).toBeLessThanOrEqual(
      CABINET.width
    )
    expect(CABINET.well.y + CABINET.well.height).toBeLessThanOrEqual(
      CABINET.height
    )
    // Ten art pixels to a mino, ten minos to the well.
    expect(CABINET.well.width / CABINET.cell).toBe(10)
    expect(CABINET.well.height / CABINET.cell).toBe(20)
  })
})

describe("scaling the cabinet", () => {
  it("uses whole numbers while one fits", () => {
    expect(cabinetScale(260, 248)).toBe(1)
    expect(cabinetScale(519, 496)).toBe(1)
    expect(cabinetScale(520, 496)).toBe(2)
    expect(cabinetScale(800, 800)).toBe(3)
    expect(cabinetScale(1920, 1080)).toBe(4)
  })

  it("takes the smaller of the two fits", () => {
    expect(cabinetScale(2600, 300)).toBe(1)
    expect(cabinetScale(300, 2480)).toBe(1)
    expect(cabinetScale(300, 496)).toBe(1)
    expect(cabinetScale(780, 744)).toBe(3)
  })

  it("goes fractional rather than clipping on a small viewport", () => {
    expect(cabinetScale(130, 124)).toBeCloseTo(0.5, 6)
    expect(cabinetScale(260, 124)).toBeCloseTo(0.5, 6)
    expect(cabinetScale(65, 248)).toBeCloseTo(0.25, 6)
    expect(cabinetScale(200, 400)).toBeCloseTo(200 / 260, 6)
  })

  it("keeps the art's own size when there is nothing to measure", () => {
    expect(cabinetScale(0, 0)).toBe(1)
    expect(cabinetScale(Number.NaN, 100)).toBe(1)
    expect(cabinetScale(-10, -10)).toBe(1)
  })
})
