/**
 * @jest-environment node
 */
import { textPixels, textWidth } from "@/components/tetris/pixel-font"

describe("the cabinet's pixel font", () => {
  it("measures a glyph as five pixels wide and one apart", () => {
    expect(textWidth("A")).toBe(5)
    expect(textWidth("AB")).toBe(11)
    expect(textWidth("AB", 2)).toBe(22)
    // The title screen's widest hint line has to fit the 100-pixel well.
    expect(textWidth("ARROWS MOVE")).toBeLessThan(100)
  })

  it("draws the glyph's own bits, at the scale it was asked for", () => {
    // "T" is a full top row with a stem down the middle.
    const pixels = textPixels("T", 0, 0, 1)
    expect(pixels).toHaveLength(5 + 6)
    expect(pixels.slice(0, 5).map((pixel) => pixel.x)).toEqual([0, 1, 2, 3, 4])
    expect(pixels.every((pixel) => pixel.y >= 0 && pixel.y < 7)).toBe(true)
    expect(pixels.filter((pixel) => pixel.x === 2)).toHaveLength(7)

    const doubled = textPixels("T", 10, 20, 2)
    expect(doubled).toHaveLength(pixels.length)
    // The seventh pixel is the second row's stem: scaled, it moves two pixels
    // down and four to the right of the glyph's origin.
    expect(doubled[6]).toEqual({ x: 14, y: 24, size: 2 })
  })

  it("draws one glyph per character, spaces and all", () => {
    // A space has no lit pixel, but it still advances.
    expect(textPixels(" ", 0, 0)).toEqual([])
    expect(textPixels("A B", 0, 0)).toHaveLength(textPixels("AB", 0, 0).length)
    // Lower case falls back to the capital, and an unknown character to "?".
    expect(textPixels("a", 0, 0)).toEqual(textPixels("A", 0, 0))
    expect(textPixels("~", 0, 0)).toEqual(textPixels("?", 0, 0))
  })
})
