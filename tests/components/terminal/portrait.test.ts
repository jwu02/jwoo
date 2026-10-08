import { PORTRAIT } from "@/components/terminal/portrait"

// The generated artifact, not the generator: what the Terminal prints is what
// is checked here. How it was drawn is `scripts/portrait.mjs`'s to explain.
describe("the printable Portrait", () => {
  const rows = PORTRAIT.split("\n")

  it("is a rectangular grid of glyphs: a picture, not a paragraph", () => {
    expect(rows.length).toBeGreaterThan(16)
    const width = rows[0].length
    expect(width).toBeGreaterThan(32)
    for (const row of rows) expect(row).toHaveLength(width)
  })

  // Dithering is what makes it a picture. A field of one glyph would print as a
  // rectangle of noise, and a field of spaces as nothing at all.
  it("keeps both paper and more than one shade of ink", () => {
    const glyphs = new Set(rows.join(""))
    expect(glyphs.has(" ")).toBe(true)
    expect(glyphs.size).toBeGreaterThan(3)
  })
})
