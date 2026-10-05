// The cabinet's type: a 5×7 bitmap font drawn as rectangles.
//
// Carried over from the prototype skin (ADR 0007's throwaway reference), for
// the same reason it was written there: an arcade cabinet's lettering is part of
// the art, and a font file would either bring a second typeface onto the machine
// or blur the moment the cabinet is scaled. Each glyph is seven rows of five
// bits, so a rectangle per lit pixel is the whole of text.

const FONT: Record<string, string> = {
  " ": "00000 00000 00000 00000 00000 00000 00000",
  A: "01110 10001 10001 11111 10001 10001 10001",
  B: "11110 10001 10001 11110 10001 10001 11110",
  C: "01110 10001 10000 10000 10000 10001 01110",
  D: "11110 10001 10001 10001 10001 10001 11110",
  E: "11111 10000 10000 11110 10000 10000 11111",
  F: "11111 10000 10000 11110 10000 10000 10000",
  G: "01110 10001 10000 10111 10001 10001 01111",
  H: "10001 10001 10001 11111 10001 10001 10001",
  I: "11111 00100 00100 00100 00100 00100 11111",
  J: "00111 00010 00010 00010 00010 10010 01100",
  K: "10001 10010 10100 11000 10100 10010 10001",
  L: "10000 10000 10000 10000 10000 10000 11111",
  M: "10001 11011 10101 10101 10001 10001 10001",
  N: "10001 11001 10101 10011 10001 10001 10001",
  O: "01110 10001 10001 10001 10001 10001 01110",
  P: "11110 10001 10001 11110 10000 10000 10000",
  Q: "01110 10001 10001 10001 10101 10010 01101",
  R: "11110 10001 10001 11110 10100 10010 10001",
  S: "01111 10000 10000 01110 00001 00001 11110",
  T: "11111 00100 00100 00100 00100 00100 00100",
  U: "10001 10001 10001 10001 10001 10001 01110",
  V: "10001 10001 10001 10001 10001 01010 00100",
  W: "10001 10001 10001 10101 10101 11011 10001",
  X: "10001 10001 01010 00100 01010 10001 10001",
  Y: "10001 10001 01010 00100 00100 00100 00100",
  Z: "11111 00001 00010 00100 01000 10000 11111",
  "0": "01110 10001 10011 10101 11001 10001 01110",
  "1": "00100 01100 00100 00100 00100 00100 01110",
  "2": "01110 10001 00001 00110 01000 10000 11111",
  "3": "11111 00010 00100 00010 00001 10001 01110",
  "4": "00010 00110 01010 10010 11111 00010 00010",
  "5": "11111 10000 11110 00001 00001 10001 01110",
  "6": "00110 01000 10000 11110 10001 10001 01110",
  "7": "11111 00001 00010 00100 01000 01000 01000",
  "8": "01110 10001 10001 01110 10001 10001 01110",
  "9": "01110 10001 10001 01111 00001 00010 01100",
  "-": "00000 00000 00000 11111 00000 00000 00000",
  ".": "00000 00000 00000 00000 00000 01100 01100",
  ":": "00000 01100 01100 00000 01100 01100 00000",
  "!": "00100 00100 00100 00100 00100 00000 00100",
  "?": "01110 10001 00001 00110 00100 00000 00100",
  "/": "00001 00010 00100 00100 01000 01000 10000",
  "'": "00100 00100 00000 00000 00000 00000 00000",
  "+": "00000 00100 00100 11111 00100 00100 00000",
  "(": "00010 00100 01000 01000 01000 00100 00010",
  ")": "01000 00100 00010 00010 00010 00100 01000",
  "<": "00010 00100 01000 10000 01000 00100 00010",
  ">": "01000 00100 00010 00001 00010 00100 01000",
}

/** A lit pixel of the font, in the cabinet's own art pixels. */
export interface GlyphPixel {
  x: number
  y: number
  size: number
}

/** The width in art pixels of `text` at `scale`: glyphs are five wide, one apart. */
export function textWidth(text: string, scale = 1): number {
  return text.length * 6 * scale - scale
}

/**
 * The lit pixels of `text`, its top-left corner at (x, y). Lower case is drawn
 * as upper case — the font has one case — and anything else falls back to "?".
 */
export function textPixels(
  text: string,
  x: number,
  y: number,
  scale = 1
): GlyphPixel[] {
  const pixels: GlyphPixel[] = []
  for (let i = 0; i < text.length; i++) {
    const glyph = FONT[text[i]] ?? FONT[text[i].toUpperCase()] ?? FONT["?"]
    const rows = glyph.split(" ")
    for (let row = 0; row < rows.length; row++) {
      for (let column = 0; column < rows[row].length; column++) {
        if (rows[row][column] === "1") {
          pixels.push({
            x: x + (i * 6 + column) * scale,
            y: y + row * scale,
            size: scale,
          })
        }
      }
    }
  }
  return pixels
}
