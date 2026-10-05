// The seven tetrominoes as Super Rotation System defines them.
//
// Cells are [x, y] offsets inside the piece's bounding box — a 3×3 box for
// JLSTZ, 4×4 for I, 2×2 for O — with y growing downward, the direction the
// Engine's board is indexed in. All four rotation states are written out
// explicitly rather than derived by rotating a matrix: SRS's states are not
// plain rotations of one another about a common centre (I's are not), so the
// authored states are the only honest source.
//
// The kick tables below are the dossier's, sign-flipped into this coordinate
// system: the wiki states translations with y positive *up* (§2.2), and every
// y here is the negative of its wiki counterpart.

export type PieceKey = "I" | "J" | "L" | "O" | "S" | "T" | "Z"

/** One of SRS's four rotation states: 0 spawn, 1 clockwise, 2 twice, 3 counter-clockwise. */
export type Rotation = 0 | 1 | 2 | 3

export type Cell = readonly [number, number]

export const PIECE_KEYS: readonly PieceKey[] = [
  "I",
  "J",
  "L",
  "O",
  "S",
  "T",
  "Z",
]

/** The Guideline's piece colours (Tetris Guideline — TetrisWiki §4). */
export const PIECE_COLORS: Record<PieceKey, string> = {
  I: "#00f0f0",
  J: "#0000f0",
  L: "#f0a000",
  O: "#f0f000",
  S: "#00f000",
  T: "#a000f0",
  Z: "#f00000",
}

export const PIECE_STATES: Record<PieceKey, readonly (readonly Cell[])[]> = {
  I: [
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
    [
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
    ],
    [
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ],
  ],
  J: [
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [0, 2],
      [1, 2],
    ],
  ],
  L: [
    [
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [0, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
  ],
  O: [
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  ],
  S: [
    [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [
      [1, 1],
      [2, 1],
      [0, 2],
      [1, 2],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
  ],
  T: [
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
  ],
  Z: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [2, 0],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
    ],
  ],
}

/**
 * Where a piece's box origin sits on spawn: rows 21 and 22 of the matrix, a
 * column offset that rounds left, which is the dossier's Guideline default.
 *
 * The box's top edge is row 22 for every piece except I, whose bar rides the
 * second row of its 4×4 box; its origin therefore sits one row higher so the
 * bar lands in row 22 as the spawn diagram has it.
 */
export const SPAWN_X: Record<PieceKey, number> = {
  I: 3,
  J: 3,
  L: 3,
  O: 4,
  S: 3,
  T: 3,
  Z: 3,
}

export const SPAWN_Y: Record<PieceKey, number> = {
  I: -1,
  J: 0,
  L: 0,
  O: 0,
  S: 0,
  T: 0,
  Z: 0,
}

/**
 * A transition between adjacent rotation states, keyed "from>to". Only the
 * eight adjacencies SRS defines a kick table for appear here — a two-state jump
 * is not a rotation the Engine can ask for (it rotates one step at a time).
 */
export type KickKey =
  "0>1" | "1>0" | "1>2" | "2>1" | "2>3" | "3>2" | "3>0" | "0>3"

/**
 * The J, L, S, T, Z kick table from SRS §2.2: five positions tried in order per
 * transition, the first being the un-kicked rotation itself.
 */
export const KICKS_JLSTZ: Record<KickKey, readonly Cell[]> = {
  "0>1": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  "1>0": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  "1>2": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  "2>1": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  "2>3": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  "3>2": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  "3>0": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  "0>3": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
}

/**
 * The I tetromino's own kick table (SRS §2.2). Not interchangeable with the
 * JLSTZ table, and not the TGM "World rule" table either — the dossier flags
 * that trap explicitly.
 */
export const KICKS_I: Record<KickKey, readonly Cell[]> = {
  "0>1": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, 1],
    [1, -2],
  ],
  "1>0": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, -1],
    [-1, 2],
  ],
  "1>2": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, -2],
    [2, 1],
  ],
  "2>1": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, 2],
    [-2, -1],
  ],
  "2>3": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, -1],
    [-1, 2],
  ],
  "3>2": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, 1],
    [1, -2],
  ],
  "3>0": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, 2],
    [-2, -1],
  ],
  "0>3": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, -2],
    [2, 1],
  ],
}

/** The five (O) never kicks: all its states occupy the same cells. */
export function kicksFor(
  key: PieceKey
): Record<KickKey, readonly Cell[]> | null {
  if (key === "O") return null
  return key === "I" ? KICKS_I : KICKS_JLSTZ
}

/**
 * The five positions tried, in order, rotating `key` from one state to the
 * next: the first is the un-kicked rotation itself, and the first that fits
 * wins (§2.2). O has no table — its rotation is a no-op.
 */
export function kickTests(
  key: PieceKey,
  from: Rotation,
  to: Rotation
): readonly Cell[] {
  const table = kicksFor(key)
  if (table === null) return [[0, 0]]
  // `to` is always adjacent to `from`: rotations step one state at a time.
  return table[`${from}>${to}` as KickKey]
}

/** The transition a rotation in `direction` (1 clockwise, −1 counter-clockwise) takes. */
export function rotateState(rotation: Rotation, direction: 1 | -1): Rotation {
  return ((rotation + direction + 4) % 4) as Rotation
}

/** A piece's occupied cells at a board position, in board coordinates. */
export function pieceCells(
  key: PieceKey,
  rotation: Rotation,
  x: number,
  y: number
): Cell[] {
  return PIECE_STATES[key][rotation].map(
    ([cx, cy]) => [x + cx, y + cy] as const
  )
}
