/**
 * @jest-environment node
 */
import {
  KICKS_I,
  KICKS_JLSTZ,
  PIECE_KEYS,
  PIECE_STATES,
  SPAWN_X,
  SPAWN_Y,
  kickTests,
  pieceCells,
  rotateState,
  type Cell,
  type KickKey,
  type Rotation,
} from "@/lib/tetris/pieces"

const KICK_KEYS: KickKey[] = [
  "0>1",
  "1>0",
  "1>2",
  "2>1",
  "2>3",
  "3>2",
  "3>0",
  "0>3",
]

/**
 * The SRS tables as the wiki prints them: x rightwards, y upwards. The board
 * grows downwards, so every entry in the source is negated on y here — which is
 * the whole of the translation, and worth pinning, because swapping the sign
 * turns a floor kick into a kick into the floor.
 */
function fromWiki(cells: [number, number][]): Cell[] {
  // `-0` is a distinct value to Jest's toEqual; the tables spell zero plainly.
  return cells.map(([x, y]) => [x, y === 0 ? 0 : -y] as const)
}

describe("the SRS kick tables", () => {
  it("matches the wiki's J, L, S, T, Z table for all eight transitions", () => {
    // SRS §2.2, the five positions tried in order.
    const table: Record<KickKey, [number, number][]> = {
      "0>1": [
        [0, 0],
        [-1, 0],
        [-1, 1],
        [0, -2],
        [-1, -2],
      ],
      "1>0": [
        [0, 0],
        [1, 0],
        [1, -1],
        [0, 2],
        [1, 2],
      ],
      "1>2": [
        [0, 0],
        [1, 0],
        [1, -1],
        [0, 2],
        [1, 2],
      ],
      "2>1": [
        [0, 0],
        [-1, 0],
        [-1, 1],
        [0, -2],
        [-1, -2],
      ],
      "2>3": [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, -2],
        [1, -2],
      ],
      "3>2": [
        [0, 0],
        [-1, 0],
        [-1, -1],
        [0, 2],
        [-1, 2],
      ],
      "3>0": [
        [0, 0],
        [-1, 0],
        [-1, -1],
        [0, 2],
        [-1, 2],
      ],
      "0>3": [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, -2],
        [1, -2],
      ],
    }
    for (const key of KICK_KEYS) {
      expect(KICKS_JLSTZ[key]).toEqual(fromWiki(table[key]))
    }
    // Three states of a T or an L are three distinct positions plus the
    // un-kicked one, and the 180° transition is not in the table at all.
    expect(Object.keys(KICKS_JLSTZ).sort()).toEqual([...KICK_KEYS].sort())
  })

  it("matches the wiki's I table for all eight transitions", () => {
    // SRS §2.2 — the I's own table, not the JLSTZ one and not TGM's.
    const table: Record<KickKey, [number, number][]> = {
      "0>1": [
        [0, 0],
        [-2, 0],
        [1, 0],
        [-2, -1],
        [1, 2],
      ],
      "1>0": [
        [0, 0],
        [2, 0],
        [-1, 0],
        [2, 1],
        [-1, -2],
      ],
      "1>2": [
        [0, 0],
        [-1, 0],
        [2, 0],
        [-1, 2],
        [2, -1],
      ],
      "2>1": [
        [0, 0],
        [1, 0],
        [-2, 0],
        [1, -2],
        [-2, 1],
      ],
      "2>3": [
        [0, 0],
        [2, 0],
        [-1, 0],
        [2, 1],
        [-1, -2],
      ],
      "3>2": [
        [0, 0],
        [-2, 0],
        [1, 0],
        [-2, -1],
        [1, 2],
      ],
      "3>0": [
        [0, 0],
        [1, 0],
        [-2, 0],
        [1, -2],
        [-2, 1],
      ],
      "0>3": [
        [0, 0],
        [-1, 0],
        [2, 0],
        [-1, 2],
        [2, -1],
      ],
    }
    for (const key of KICK_KEYS) {
      expect(KICKS_I[key]).toEqual(fromWiki(table[key]))
    }
  })

  it("never kicks an O", () => {
    // All four O states are the same cells, so every transition is the identity.
    expect(kickTests("O", 0, 1)).toEqual([[0, 0]])
    expect(kickTests("O", 3, 0)).toEqual([[0, 0]])
  })

  it("picks the table by piece, and the pair of states by direction", () => {
    expect(kickTests("I", 0, 1)).toEqual(KICKS_I["0>1"])
    expect(kickTests("J", 1, 0)).toEqual(KICKS_JLSTZ["1>0"])
    expect(kickTests("S", 3, 0)).toEqual(KICKS_JLSTZ["3>0"])
    expect(rotateState(0, 1)).toBe(1)
    expect(rotateState(0, -1)).toBe(3)
    expect(rotateState(3, 1)).toBe(0)
    expect(rotateState(2, -1)).toBe(1)
  })
})

describe("spawn geometry", () => {
  it("puts every piece in rows 21–22, flat side down, at its own column", () => {
    // The dossier's table §5: spawn, then the spawn drop of one row.
    const resting: Record<string, [number, number][]> = {
      I: [
        [3, 1],
        [4, 1],
        [5, 1],
        [6, 1],
      ],
      J: [
        [3, 1],
        [3, 2],
        [4, 2],
        [5, 2],
      ],
      L: [
        [5, 1],
        [3, 2],
        [4, 2],
        [5, 2],
      ],
      O: [
        [4, 1],
        [5, 1],
        [4, 2],
        [5, 2],
      ],
      S: [
        [4, 1],
        [5, 1],
        [3, 2],
        [4, 2],
      ],
      T: [
        [4, 1],
        [3, 2],
        [4, 2],
        [5, 2],
      ],
      Z: [
        [3, 1],
        [4, 1],
        [4, 2],
        [5, 2],
      ],
    }
    for (const key of PIECE_KEYS) {
      const cells = pieceCells(key, 0, SPAWN_X[key], SPAWN_Y[key] + 1)
      expect([...cells].sort()).toEqual([...resting[key]].sort())
    }
  })

  it("describes every piece with four cells in every rotation", () => {
    for (const key of PIECE_KEYS) {
      expect(PIECE_STATES[key]).toHaveLength(4)
      for (const rotation of [0, 1, 2, 3] as Rotation[]) {
        const cells = PIECE_STATES[key][rotation]
        expect(cells).toHaveLength(4)
        // No two cells of a piece share a square.
        expect(new Set(cells.map((cell) => cell.join(","))).size).toBe(4)
      }
    }
  })

  it("rotates a piece back to where it started, and O to the same four cells", () => {
    for (const key of PIECE_KEYS) {
      let rotation: Rotation = 0
      const cells = pieceCells(key, 0, 0, 0)
      for (let i = 0; i < 4; i++) rotation = rotateState(rotation, 1)
      expect(rotation).toBe(0)
      expect(pieceCells(key, rotation, 0, 0)).toEqual(cells)
    }
    // O's four states are one shape.
    const o = PIECE_STATES.O[0]
    for (const rotation of [1, 2, 3] as Rotation[]) {
      expect(PIECE_STATES.O[rotation]).toEqual(o)
    }
  })
})
