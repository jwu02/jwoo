/**
 * @jest-environment node
 */
import { CABINET, cabinetScale } from "@/lib/tetris/cabinet"

describe("the cabinet's own geometry", () => {
  it("is the header-over-well art size, with the well inside it", () => {
    expect(CABINET).toMatchObject({ width: 108, height: 234, cell: 10 })
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
  it("uses whole numbers while one fits on a large surface", () => {
    expect(cabinetScale(864, 832)).toBe(3)
    expect(cabinetScale(1080, 1080)).toBe(4)
    expect(cabinetScale(1920, 1080)).toBe(4)
    // At the shell's md breakpoint exactly, the desktop rule still holds.
    expect(cabinetScale(768, 832)).toBe(3)
  })

  it("takes the smaller of the two fits", () => {
    expect(cabinetScale(1080, 832)).toBe(3)
    expect(cabinetScale(864, 2080)).toBe(8)
  })

  it("fills a small surface fractionally rather than flooring", () => {
    // A phone portrait: the art's tall aspect nearly matches the screen's, so
    // the height binds and the width comes within a sliver of filling too.
    expect(cabinetScale(390, 844)).toBeCloseTo(844 / 234, 6)
    // A phone landscape: the height binds.
    expect(cabinetScale(844, 390)).toBeCloseTo(390 / 234, 6)
    expect(cabinetScale(320, 568)).toBeCloseTo(568 / 234, 6)
    // One under the breakpoint is already a small surface: 7.10 stays 7.10
    // where the desktop rule would floor it to 7.
    expect(cabinetScale(767, 1700)).toBeCloseTo(767 / 108, 6)
  })

  it("goes fractional rather than clipping on a viewport under the art", () => {
    expect(cabinetScale(54, 234)).toBeCloseTo(0.5, 6)
    expect(cabinetScale(108, 117)).toBeCloseTo(0.5, 6)
    expect(cabinetScale(27, 234)).toBeCloseTo(0.25, 6)
    expect(cabinetScale(200, 400)).toBeCloseTo(400 / 234, 6)
  })

  it("keeps the art's own size when there is nothing to measure", () => {
    expect(cabinetScale(0, 0)).toBe(1)
    expect(cabinetScale(Number.NaN, 100)).toBe(1)
    expect(cabinetScale(-10, -10)).toBe(1)
  })
})
