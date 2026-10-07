/**
 * @jest-environment node
 */
import {
  CABINET,
  cabinetScale,
  READY_MENU,
  readyChoiceAt,
} from "@/lib/tetris/cabinet"

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

describe("the ready screen's menu", () => {
  it("gives every line its own row band, with none overlapping", () => {
    const { player, kevala } = READY_MENU
    expect(player.y).toBeLessThan(kevala.y)
    expect(player.band[0]).toBeLessThan(player.y)
    expect(player.band[1]).toBeLessThanOrEqual(kevala.band[0])
    expect(kevala.band[0]).toBeLessThan(kevala.y)
    expect(kevala.band[1]).toBeGreaterThan(kevala.y)
    // The fallback copy is inside the kevala band: a tap on NEEDS WEBGPU
    // refuses exactly as a tap on the line it explains does.
    expect(readyChoiceAt(READY_MENU.missing.y)).toBe("kevala")
    // Both bands sit over the well, where the menu is drawn, not in the stats.
    for (const line of [player, kevala]) {
      expect(line.band[0]).toBeGreaterThan(CABINET.well.y)
      expect(line.band[1]).toBeLessThan(CABINET.height)
    }
  })

  it("resolves a tap's row to a choice, and the rows between to nothing", () => {
    expect(readyChoiceAt(READY_MENU.player.y)).toBe("player")
    expect(readyChoiceAt(READY_MENU.kevala.y)).toBe("kevala")
    // The tap's own band: the line's row plus the margin around it.
    expect(readyChoiceAt(READY_MENU.kevala.band[0])).toBe("kevala")
    expect(readyChoiceAt(READY_MENU.kevala.band[1] - 1)).toBe("kevala")
    // Above the menu (the title, the stats), between the bands, and below them
    // (the control hints) no line answers, so the tap starts a 1 PLAYER game.
    expect(readyChoiceAt(0)).toBeNull()
    expect(readyChoiceAt(READY_MENU.player.band[0] - 1)).toBeNull()
    expect(readyChoiceAt(READY_MENU.kevala.band[1])).toBeNull()
    expect(readyChoiceAt(CABINET.height)).toBeNull()
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
