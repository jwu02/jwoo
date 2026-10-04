# Research: The authoritative Tetris rules (jwoo issue #35)

**Ticket:** https://github.com/jwu02/jwoo/issues/35 — "what are the authoritative modern Tetris rules the engine must model, and is the Guideline rule set the right v1 choice?"
**Researched against:** tetris.wiki (Tetris Wiki, maintained by the Hard Drop community), harddrop.com wiki, one first-party PLAYSTUDIOS support page, and per-game corroboration. Every numeric claim below carries an inline citation to the page that owns it.

---

## Answer

**Confirm Guideline for v1.** The Tetris Guideline is the specification The Tetris Company has enforced on every new official Tetris since *Tetris Worlds* (2001) ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)), so it is the only "authoritative modern" ruleset in existence; NES/classic is a 1989 one-off design, not a competing standard, and it diverges structurally (no hold, no hard drop, no ghost, no wall kicks, instant lock, NRS rotation, a different gravity table and scoring scale — see §14). For the jwoo engine, build Guideline-2009+ semantics: SRS with the full kick tables, 7-bag, 10×20+buffer playfield, rows-21/22 spawn, `(0.8 − (level−1)·0.007)^(level−1)` gravity, 0.5 s lock delay with a 15-move reset, 100/300/500/800 × level scoring with 3-corner T-spins, combos, B2B ×1.5, and perfect-clear bonuses. The one structural caveat: the Guideline document itself is not public — what stands in for it is the Hard Drop community's Tetris Wiki, which is high-quality, heavily cross-confirmed against real games, but partly community-consensus rather than canon (judged in detail below); a handful of values (next-queue count, line-clear delay, post-level-19 gravity) are genuinely unspecified and get flagged implementation-safe defaults.

---

## 0. What stands in for the (non-public) Guideline, and how reliable it is

- The Tetris Guideline is a yearly specification developed by Blue Planet Software, with rules decided by a committee and **Alexey Pajitnov having final say**; known versions: **2002, 2005, 2006, 2009** ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)).
- **In 2011 a copy of the Guideline leaked, dated March 2009.** Tetris Wiki states its rules list is "taken from interviews, the leaked document, and by observing the behavior of authentic Tetris games" ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)). The wiki does not host the leak; treat the wiki's synthesis as the citable proxy.
- **What Tetris Wiki is:** a community wiki started in 2006 on tetrisconcept.com, forked into three descendants — tetris.fandom.com, harddrop.com's wiki, and tetris.wiki (since 2015) — with ~4,989 pages documenting official and fan games and "uncovering game mechanics" ([TetrisWiki:About](https://tetris.wiki/TetrisWiki:About)). Hard Drop (harddrop.com) is the same community's second fork ([TetrisWiki:About](https://tetris.wiki/TetrisWiki:About)).
- **Reliability gradient observed during this research:**
  - *Directly confirmed / cross-confirmed (highest confidence):* SRS kick tables (identical across tetris.wiki, harddrop.com wiki, tetris.fandom.com, a Japanese SRS tutorial, and independent implementations — see §2), base scoring (confirmed by the **first-party PLAYSTUDIOS Tetris Mobile help center**, see §11), gravity curve (formula matches the wiki's own frame-accurate G table to 3 decimals, independently re-derived during this research; see §6), combo/B2B/hold/infinity semantics (consistent across both wiki forks and per-game documentation).
  - *Community-documented, per-game verified:* lock-delay reset counts, soft-drop speeds, top-out rows, T-spin rule variants — tabulated per game in the wiki's compliance-differences table ([Guideline compliant game differences — TetrisWiki](https://tetris.wiki/Guideline_compliant_game_differences)).
  - *Reverse-engineered:* everything NES (assembly-level: gravity table "stored at $898E", DAS counters, randomizer rolls) ([Tetris (NES) — TetrisWiki](https://tetris.wiki/Tetris_(NES,_Nintendo))).
  - *Weakest (consensus / unverified):* anything specific to Guideline versions after the 2009 leak; the wiki itself hedges with "it is likely that the Guideline has been modified since that time" ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)).
- Useful first-party anchor found: the **official Tetris Mobile help center** publishes the scoring table (see §11), and harddrop documents tetris.com's mechanics as "follows the Tetris guideline in every regard" ([Tetris at tetris.com — Hard Drop Wiki](https://harddrop.com/wiki/Tetris_at_tetris.com)).

---

## 1. Guideline vs NES/classic — the v1 choice and divergence summary

**Claim:** Guideline is the right v1 target; NES mechanics are a different game, not a simpler default. **Support:** direct evidence (definition of the Guideline as the enforced modern standard) + researcher inference about project fit. **Confidence:** high.

Divergence summary (details and citations in §14):

| Dimension | Guideline (2009+) | NES (Nintendo, 1989) |
|---|---|---|
| Rotation | SRS, 4 rotation states, 5-test wall/floor kicks per transition | Nintendo Rotation System (right-handed), no kicks ([Tetris (NES)](https://tetris.wiki/Tetris_(NES,_Nintendo))) |
| Randomizer | 7-bag ([Random Generator](https://tetris.wiki/Random_Generator)) | 0–7 roll, reroll on repeat/dummy-7, second roll 0–6 ([Tetris (NES)](https://tetris.wiki/Tetris_(NES,_Nintendo))) |
| Hold / ghost / hard drop | all required | **none** ([Tetris (NES)](https://tetris.wiki/Tetris_(NES,_Nintendo))) |
| Lock delay | 0.5 s, move-reset ×15 | none — locks on the downward move attempt ([Lock delay](https://tetris.wiki/Lock_delay)) |
| Gravity | exponential formula, 1→20G over levels 1–19 | linear table, 48 frames/cell → 1 frame/cell at level 29 ([Tetris (NES)](https://tetris.wiki/Tetris_(NES,_Nintendo))) |
| Scoring | 100/300/500/800 × level, T-spins, combos, B2B, PC ([Scoring](https://tetris.wiki/Scoring)) | 40/100/300/1200 × (level+1) only ([Scoring](https://tetris.wiki/Scoring)) |
| DAS | ~167 ms / ~33 ms recommended | 16 frames / 6 frames, with NES-specific counter quirks ([Tetris (NES)](https://tetris.wiki/Tetris_(NES,_Nintendo))) |
| Level goal | 10 lines per level (fixed) | first goal `start×10+10` or `max(100, start×10−50)`, then every 10 |

If the site ever wants the competitive-classic ("CTWC") feel, that is a second ruleset behind a flag — not a redirect of v1 (researcher inference).

---

## 2. SRS — Super Rotation System

### 2.1 Rotation states and spawn orientations

- SRS is the current Guideline standard for rotation and wall kicks; finalized in *Tetris Worlds* (2001) ([Super Rotation System — TetrisWiki](https://tetris.wiki/SRS)).
- State naming convention: **0** = spawn, **R** = one clockwise rotation from spawn, **L** = one counter-clockwise, **2** = two rotations in either direction ([Super Rotation System — TetrisWiki](https://tetris.wiki/SRS)).
- Spawn orientations: **all tetrominoes spawn horizontally**; I and O spawn centrally, the 3-cell-wide pieces (J, L, S, Z, T) spawn "rounded to the left"; **J, L, T spawn flat-side first; I, S, Z spawn in their upper horizontal orientation** ([Super Rotation System — TetrisWiki](https://tetris.wiki/SRS)).
- J/L/S/T/Z rotate within a 3×3 bounding box, I within a 4×4 box; unobstructed rotation is a pure mathematical rotation about an apparent center (at a gridline intersection for I and O, at a mino center for the others) ([Super Rotation System — TetrisWiki](https://tetris.wiki/SRS)). *(Box sizes are the standard implementation reading of the wiki's diagram-based description — interpretation, not verbatim text.)*
- Internally TTC implements SRS via per-state **offset tables** ("true rotation") from which the kick translations are derived by subtraction; the wiki documents both the derived kick tables (below) and the raw offset tables, which are equivalent for implementation ([Super Rotation System — TetrisWiki](https://tetris.wiki/SRS)).

### 2.2 Wall kick tables (every test, both directions)

> Coordinate convention used by the tables: **positive x = right, positive y = up**, translations relative to basic rotation ([Super Rotation System — TetrisWiki](https://tetris.wiki/SRS)). If your engine's y axis points down, negate y *(implementation note — researcher inference)*.
>
> When a rotation is attempted, **5 positions are tested in order (test 1 is the un-kicked rotation); if none fit, the rotation fails** ([Super Rotation System — TetrisWiki](https://tetris.wiki/SRS)).
>
> J, L, S, T, Z share one table; **I has its own; O does not kick** ([Super Rotation System — TetrisWiki](https://tetris.wiki/SRS)).

**J, L, S, T, Z wall kick data** (verbatim from [Super Rotation System — TetrisWiki](https://tetris.wiki/SRS); independently confirmed identical by [Hard Drop wiki SRS](https://harddrop.com/wiki/SRS), [Tetris Fandom SRS](https://tetris.fandom.com/wiki/Super_Rotation_System), and [an independent Java implementation](https://github.com/jasonbai2014/Tetris/blob/master/src/model/WallKick.java)):

| Rotation | Test 1 | Test 2 | Test 3 | Test 4 | Test 5 |
|---|---|---|---|---|---|
| 0→R | ( 0, 0) | (−1, 0) | (−1,+1) | ( 0,−2) | (−1,−2) |
| R→0 | ( 0, 0) | (+1, 0) | (+1,−1) | ( 0,+2) | (+1,+2) |
| R→2 | ( 0, 0) | (+1, 0) | (+1,−1) | ( 0,+2) | (+1,+2) |
| 2→R | ( 0, 0) | (−1, 0) | (−1,+1) | ( 0,−2) | (−1,−2) |
| 2→L | ( 0, 0) | (+1, 0) | (+1,+1) | ( 0,−2) | (+1,−2) |
| L→2 | ( 0, 0) | (−1, 0) | (−1,−1) | ( 0,+2) | (−1,+2) |
| L→0 | ( 0, 0) | (−1, 0) | (−1,−1) | ( 0,+2) | (−1,+2) |
| 0→L | ( 0, 0) | (+1, 0) | (+1,+1) | ( 0,−2) | (+1,−2) |

**I tetromino wall kick data** (verbatim from [Super Rotation System — TetrisWiki](https://tetris.wiki/SRS); same values at [Hard Drop wiki SRS](https://harddrop.com/wiki/SRS)):

| Rotation | Test 1 | Test 2 | Test 3 | Test 4 | Test 5 |
|---|---|---|---|---|---|
| 0→R | ( 0, 0) | (−2, 0) | (+1, 0) | (−2,−1) | (+1,+2) |
| R→0 | ( 0, 0) | (+2, 0) | (−1, 0) | (+2,+1) | (−1,−2) |
| R→2 | ( 0, 0) | (−1, 0) | (+2, 0) | (−1,+2) | (+2,−1) |
| 2→R | ( 0, 0) | (+1, 0) | (−2, 0) | (+1,−2) | (−2,+1) |
| 2→L | ( 0, 0) | (+2, 0) | (−1, 0) | (+2,+1) | (−1,−2) |
| L→2 | ( 0, 0) | (−2, 0) | (+1, 0) | (−2,−1) | (+1,+2) |
| L→0 | ( 0, 0) | (+1, 0) | (−2, 0) | (+1,−2) | (−2,+1) |
| 0→L | ( 0, 0) | (−1, 0) | (+2, 0) | (−1,+2) | (+2,−1) |

> ⚠️ Arika's TGM3/TGM-ACE "World rule" uses the same JLSTZ table but a **different I table** ([Super Rotation System — TetrisWiki](https://tetris.wiki/SRS)) — do not copy I kicks from TGM-flavored sources.

### 2.3 Testable assertions (SRS)

- **JLSTZ 0→R** tests `(0,0), (−1,0), (−1,+1), (0,−2), (−1,−2)` — matches the ticket's expected string exactly; verified against the source table ([Super Rotation System — TetrisWiki](https://tetris.wiki/SRS)). ✅
- **I 0→R** tests `(0,0), (−2,0), (+1,0), (−2,−1), (+1,+2)` ([Super Rotation System — TetrisWiki](https://tetris.wiki/SRS)). ✅
- **O rotation is a no-op**: O has no kick data; internally TTC gives O offsets that produce a "wobble" corrected by the first kick translation, so the *observable* result is the piece unmoved ([Super Rotation System — TetrisWiki](https://tetris.wiki/SRS)). (Note: attempted O rotation still resets the lock timer under infinity/move-reset ([Infinity — TetrisWiki](https://tetris.wiki/Infinity)).)
- **All rotations are reversible**: for every successful 0→R there is a valid R→0, etc. — this is what makes T-spin triples reachable via the "out of well" kick ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)).

---

## 3. 7-bag randomizer (Random Generator)

- **Semantics:** generate a sequence of all seven tetrominoes (I, J, L, O, S, T, Z) in random order, deal them out one by one, then generate a new bag; "the resulting sequence of seven tetrominoes is added to the queue, and another bag is then generated" ([Random Generator — TetrisWiki](https://tetris.wiki/Random_Generator)).
- The term "Random Generator" is treated by BPS staff as a proper noun for this exact algorithm ([Random Generator — TetrisWiki](https://tetris.wiki/Random_Generator)).
- Statistical guarantees worth unit-testing: **max run without an I = 12** (an I drought can span at most one full bag plus 5 pieces) and **max consecutive S/Z = 4**; each of the 7! = 5,040 bag permutations is believed near-equal probability ([Random Generator — TetrisWiki](https://tetris.wiki/Random_Generator)).
- **First bag:** the canonical Guideline algorithm has **no documented first-bag special-casing** — the first piece is simply the first draw of the first shuffled bag. The only documented exception in the wiki is TGM Ace (first piece of the first bag always I/J/L/T, per TGM tradition), which is *not* Guideline behavior ([Random Generator — TetrisWiki](https://tetris.wiki/Random_Generator)). **No Guideline source mandates forcing or rerolling the first piece; do not invent one.**
- Implementation-safe default: refill the queue eagerly (keep ≥ 7 pieces ahead) so previews never see a bag seam; that matches "added to the queue" semantics ([Random Generator — TetrisWiki](https://tetris.wiki/Random_Generator)) *(implementation note — researcher inference)*.

**Testable assertions:** (a) every bag-aligned window of 7 consecutive dealt pieces contains exactly one of each tetromino; (b) max consecutive pieces without an I = 12; (c) max consecutive S/Z run = 4 ([Random Generator — TetrisWiki](https://tetris.wiki/Random_Generator)).

---

## 4. Playfield and coordinates

- The Matrix is **10 cells wide × 20 cells tall, plus a 20-cell buffer zone above**, usually hidden; if the hardware permits, a sliver of row 21 is shown ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)).
- "Modern Tetris Guideline specifies a visible playfield 10×20 and a buffer zone of 20 rows; tetrominoes spawn in rows 21 and 22 at the bottom of the buffer zone" — so a clean field can absorb 20 rows of garbage ([Playfield — TetrisWiki](https://tetris.wiki/Playfield)).
- **Coordinates convention: columns numbered left→right, rows bottom→top** ([Playfield — TetrisWiki](https://tetris.wiki/Playfield)). Implementation: visible rows 1–20, buffer rows 21–40; total matrix 10×40. *(Indexing choice is the standard reading — interpretation.)*
- The vanish zone is the region above the visible ceiling; Guideline games let pieces land and lock partially inside it (they reappear when lines below clear) ([Playfield — TetrisWiki](https://tetris.wiki/Playfield)).
- Not all "Guideline" games use 20 buffer rows (Tetris Worlds PS2 used 4; Jstris 1) — 20 is the Guideline value ([Playfield — TetrisWiki](https://tetris.wiki/Playfield)).
- Piece colors: I cyan, J dark blue, L orange, O yellow, S green, Z red, T magenta ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)).

**Testable assertion:** a piece may lock with cells in rows 21–40 without game over (provided not *fully* above row 20 — see §13) ([Top out — TetrisWiki](https://tetris.wiki/Top_out), [Tetris Guideline](https://tetris.wiki/Tetris_Guideline)).

---

## 5. Spawn position and orientation

- **"Tetrominoes appear on the 21st and 22nd rows of the playfield, centered and rounded to the left when needed. They must start with their flat side down, and move down immediately after appearing."** ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline))
- *Tetris Worlds* spawned in rows 22–23 (I alone in row 22); **later Guideline games spawn one row lower (21–22)**; some recent games (Tetris Effect, tetris.com) go lower still ([Super Rotation System — TetrisWiki](https://tetris.wiki/SRS), [Tetris Guideline](https://tetris.wiki/Tetris_Guideline)). Guideline v1 default: **rows 21–22**.
- Per-piece spawn shapes (from the spawn-state diagram description in [Super Rotation System — TetrisWiki](https://tetris.wiki/SRS); the exact column numbers below are derived from "centered, rounded left" on a 10-wide field — **interpretation, crisp but not verbatim**):

| Piece | Spawn cells (0-indexed columns, 1-indexed rows) |
|---|---|
| J, L, T | 3 minos on row 21 at columns 3–5; notch mino on row 22 (T: col 4; J: col 3; L: col 5) |
| S, Z | row 21 cols 3–4 and row 22 cols 4–5 (S) / row 21 cols 4–5 and row 22 cols 3–4 (Z) |
| I | single row **22**, columns 3–6 |
| O | 2×2 block rows 21–22, columns 4–5 |

- The Guideline requires pieces to spawn **at least partially inside the vanish zone** (rows above the visible ceiling) ([Playfield — TetrisWiki](https://tetris.wiki/Playfield)).
- **Spawn drop rule:** the piece "must … move down immediately after appearing" — i.e., after the initial placement in rows 21/22 the piece immediately falls one row if unobstructed ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)). **Testable assertion:** on spawn with an empty field, the piece's resting rows are 20/21 (I: 21) before any player input; if the spawn cells are blocked → block out (§13).

---

## 6. Gravity, soft drop, hard drop

### 6.1 Guideline gravity curve (Tetris Worlds / Marathon)

- The Guideline Marathon speed curve is the *Tetris Worlds* curve: **time per row in seconds = (0.8 − (Level−1)·0.007)^(Level−1)** ([Marathon — TetrisWiki](https://tetris.wiki/Marathon), [Tetris Worlds — Hard Drop Wiki](https://harddrop.com/wiki/Tetris_Worlds); the exponent is confirmed verbatim in [TETR.IO issue #467 quoting the harddrop page](https://github.com/tetrio/issues/issues/467)).
  - ⚠️ Note: several wiki pages render the formula without the exponent in flat text; the exponent `(Level−1)` was verified numerically during this research against the wiki's own G table (e.g., level 5: 0.772⁴ = 0.3553 s/row → 0.04693 G ✓; level 19: 0.674¹⁸ = 0.000822 s/row → 20.27 G ✓) — **researcher verification, not wiki-stated**.
- Frame-accurate G values (1 G = 1 cell per 60 Hz frame; cells/second column derived = G × 60 — derived arithmetic) ([Marathon — TetrisWiki](https://tetris.wiki/Marathon)):

| Level | Speed (G) | ≈ cells/sec | ≈ frames/row @60fps |
|---|---|---|---|
| 1 | 0.01667 | 1.0 | 60 |
| 2 | 0.021017 | 1.26 | 47.6 |
| 3 | 0.026977 | 1.62 | 37.1 |
| 4 | 0.035256 | 2.12 | 28.3 |
| 5 | 0.04693 | 2.82 | 21.3 |
| 6 | 0.06361 | 3.82 | 15.7 |
| 7 | 0.0879 | 5.27 | 11.4 |
| 8 | 0.1236 | 7.42 | 8.09 |
| 9 | 0.1775 | 10.65 | 5.63 |
| 10 | 0.2598 | 15.59 | 3.85 |
| 11 | 0.388 | 23.28 | 2.58 |
| 12 | 0.59 | 35.4 | 1.69 |
| 13 | 0.92 | 55.2 | 1.09 |
| 14 | 1.46 | 87.6 | 0.685 |
| 15 | 2.36 | 141.6 | 0.424 |
| 16 | 3.91 | 234.6 | 0.256 |
| 17 | 6.61 | 396.6 | 0.151 |
| 18 | 11.43 | 685.8 | 0.0875 |
| 19 | 20.23 | 1213.8 | 0.0494 |
| 20 | 36.6 | 2196 | 0.0273 |

- **There is no concrete rule for the curve past level 19** — implementations either continue at 20G+ (Tetris Online Japan), extend the formula while shortening lock delay (tetris.com, Tetris Ultimate: lock delay steps 450 ms at level 20 → 150 ms at level 30), or cap at fixed 20G with shrinking lock delay (Tetris Effect, Tetris Party) ([Marathon — TetrisWiki](https://tetris.wiki/Marathon), [Tetris at tetris.com — Hard Drop Wiki](https://harddrop.com/wiki/Tetris_at_tetris.com)). Variants exist (Tetris DS offsets the curve by 1 level; Tetris 99 rescales it) ([Marathon — TetrisWiki](https://tetris.wiki/Marathon)).

### 6.2 Soft drop

- The Guideline specifies "designated soft drop speed; details vary between guideline versions" ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)); **Tetris Zone uses 20× the current level's fall speed** ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)), and the wiki's per-game compliance table records **"Native × 20" as the soft-drop speed for every modern official game checked** (Journey, 2020 mobile, Tetris 99, Effect, Ultimate, tetris.com, PPT, EA 2011, Axis, PS3, Battle, Party, Friends, Splash) ([Guideline compliant game differences — TetrisWiki](https://tetris.wiki/Guideline_compliant_game_differences)).
- Guideline games **do not lock instantly on soft drop** ([Drop — TetrisWiki](https://tetris.wiki/Drop)) — soft-dropping onto the stack starts the normal 0.5 s lock delay (§7).
- **Implementation-safe default: soft drop = 20 × current native gravity** (that is what the modern official games listed above do) ([Guideline compliant game differences — TetrisWiki](https://tetris.wiki/Guideline_compliant_game_differences)).

### 6.3 Hard drop

- **Hard drop is a locking instant drop — the piece lands and locks immediately — and Guideline games are required to include it** ([Drop — TetrisWiki](https://tetris.wiki/Drop)). Standard mapping: Up on a gamepad and **Space on keyboard = hard drop**; Down = non-locking soft drop ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)).
- Scoring: **+2 per cell** hard-dropped, **+1 per cell** soft-dropped ([Scoring — TetrisWiki](https://tetris.wiki/Scoring); first-party confirmation at [Scoring in Tetris — Tetris Mobile Help Center](https://playstudios.helpshift.com/hc/en/16-tetris-mobile/faq/2437-scoring-in-tetris/)).
- Drop points are flat — **not multiplied by level** ([Tetris at tetris.com — Hard Drop Wiki](https://harddrop.com/wiki/Tetris_at_tetris.com): "The current level functions as a score multiplier except for drop points").

---

## 7. Lock delay and move reset

- **A piece gets 0.5 s after landing before it locks** (when gravity is below 20G) ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline), [Lock delay — TetrisWiki](https://tetris.wiki/Lock_delay)).
- Three Guideline-defined lock-down modes ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)):
  1. **Infinite Placement ("infinity" / move reset, unlimited)** — any successful move or rotation resets the timer, indefinitely. First appeared in *Tetris Worlds* as "Easy Spin" ([Infinity — TetrisWiki](https://tetris.wiki/Infinity)).
  2. **Extended Placement ("move reset", limited)** — same, but **limited to 15 moves/rotations**, after which the piece locks on its next contact without a further reset. "Most games since 2007 have a limit of 15 move resets" ([Infinity — TetrisWiki](https://tetris.wiki/Infinity)); the compliance table records **limit = 15** for every modern official game checked ([Guideline compliant game differences — TetrisWiki](https://tetris.wiki/Guideline_compliant_game_differences)); the 15-move limit was specified in the Guideline by 2009 ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)).
  3. **Classic Lock Down ("step reset")** — the timer resets only when the piece moves down a row (TGM-style) ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)).
- Modern games use **move reset (15) as the only mode** ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)). **Implementation-safe default: Extended Placement, 0.5 s, 15 resets.**
- Pressing down does **not** cancel/shorten lock delay in the modern games checked (table row "Lock delay cancel using down key": No across the board) ([Guideline compliant game differences — TetrisWiki](https://tetris.wiki/Guideline_compliant_game_differences)).
- Guideline detail: "for games with Master mode, the lock delay value will decrease per level when the gravity is 20G" ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)).

**Testable assertions:** (a) landing starts a 0.5 s timer; (b) each successful shift/rotation resets it, max 15 times; (c) the 16th successful move/rotation leaves the timer running un-reset; (d) a downward step re-arms the full move budget in Guideline move-reset implementations — ⚠️ (d) is the classic ambiguity (does the counter reset on descending to a new lowest row?); the wiki does not pin this down explicitly — **implementation-safe default: reset the move counter when the piece falls to a new lowest row** (matches the observable "infinite stall is impossible at 20G but stair-stepping is allowed" behavior; flagged as interpretation).

---

## 8. DAS / ARR

- Recommended-but-non-mandatory Guideline handling, "as seen in Puyo Puyo Tetris and Tetris Effect" (values given "in 120Hz / 60FPS time") ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)):

| Parameter | Recommended value | Time |
|---|---|---|
| DAS (Delayed Auto Shift delay) | 10 frames | ≈ 167 ms (6 Hz) |
| ARR (Auto-Repeat Rate) | 2 frames | ≈ 33 ms (30 Hz) |
| ARE (entry delay) | 6 frames | ≈ 100 ms (10 Hz) |

- These are explicitly **recommended, not mandatory**; earlier guidance suggested DAS no faster than Tetris Zone's ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)). Modern official games cluster here; fan games (TETR.IO, Jstris, NullpoMino, Lockjaw) make DAS/ARR user-configurable ([DAS — TetrisWiki](https://tetris.wiki/DAS)).
- Definition nuance: the wiki measures DAS delay **inclusive** of the press frame and the first auto-shift frame ([DAS — TetrisWiki](https://tetris.wiki/DAS)).
- DAS "charging" during ARE/line-clear delay exists in many games but is a per-game feature, not a published Guideline constant ([DAS — TetrisWiki](https://tetris.wiki/DAS)).
- **Implementation-safe default: DAS 167 ms, ARR 33 ms** (the recommended block above); expose as tunables.
- NES comparison: 16 frames initial / 6 frames repeat (§14).

---

## 9. Hold and Next queue

### Hold
- One hold slot. Pressing Hold swaps the active piece with the held piece (or takes the next piece if the slot is empty); **the swapped-in piece resets at the top of the playfield; hold cannot be used again until the current piece locks** ([Hold piece — TetrisWiki](https://tetris.wiki/Hold_piece), [Tetris Guideline](https://tetris.wiki/Tetris_Guideline)).
- "Most games rotate tetrominoes back to the starting orientation when moving them to the hold space" ([Hold piece — TetrisWiki](https://tetris.wiki/Hold_piece)) — **implementation-safe default: reset to spawn state on hold**.
- Hold was introduced in *The New Tetris*; Tetris Blitz is the only Guideline game with two hold slots ([Hold piece — TetrisWiki](https://tetris.wiki/Hold_piece)).

### Next queue
- The Guideline calls previews the **Next Queue**; "some games have **up to six** previews, and some the option to change the amount"; pieces display in their starting orientations; queue sits right of or above the field ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline), [Piece preview — TetrisWiki](https://tetris.wiki/Piece_preview)).
- ⚠️ **The often-quoted "Guideline recommends 6" is not directly evidenced in any source found**; the wiki only says "up to six". Actual counts: Tetris Worlds — 3 (GBA) / 6 (other platforms) ([Tetris Worlds — TetrisWiki](https://tetris.wiki/Tetris_Worlds)); modern official games range **1–6** (tetris.com: 3; Tetris 99: 6; Effect: 1–4 configurable; Journey: 3–5) ([Guideline compliant game differences — TetrisWiki](https://tetris.wiki/Guideline_compliant_game_differences)). **Implementation-safe default: render 5–6 next pieces** (the upper end of official practice; a 7-bag engine can always render up to 6 from the queue).
- The 7-bag + hold combination famously allows "playing forever" ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)) — a good stress test for the engine.

---

## 10. Line clear detection and animation timing

- **Detection:** a row clears when every cell spans the full 10-column width, evaluated on lock ([Line clear — TetrisWiki](https://tetris.wiki/Line_clear)). Guideline SRS additionally enables "impossible" clears (S/Z/T triples via twist kicks) ([Line clear — TetrisWiki](https://tetris.wiki/Line_clear)).
- **Gravity after clear is naive**: blocks above a cleared row move down by exactly the number of cleared rows below them — this is what virtually all tetromino games including Guideline games use (sticky/cascade are separate modes) ([Line clear — TetrisWiki](https://tetris.wiki/Line_clear)).
- **Animation timing is per-game, and no Guideline-wide constant is publicly documented.** Documented data points: TGM and Tetris DS wait **400–700 ms** of line-clear delay ([Line clear — TetrisWiki](https://tetris.wiki/Line_clear)); NES uses 17–20 frames plus a 5-step flash animation (§14); the Guideline's *recommended* ARE is 6 frames ≈ 100 ms ([Tetris Guideline](https://tetris.wiki/Tetris_Guideline)).
- ⚠️ **Not documented anywhere citable: the exact Guideline-mandated clear delay (if any). Do not invent one.** **Implementation-safe default: instant row removal with a configurable cosmetic delay; ship 0 ms (instant) or ~0.4 s for feel, flagged as a design choice, not a Guideline constant** *(researcher inference from the above)*.

---

## 11. Scoring

### 11.1 Base line clears, T-spins, drops

"Most games released after Tetris DS share large parts of their scoring system"; level is always the level **before** the line clear ([Scoring — TetrisWiki](https://tetris.wiki/Scoring)).

| Action | Points | Notes |
|---|---|---|
| Single | 100 × level | |
| Double | 300 × level | |
| Triple | 500 × level | |
| Tetris | 800 × level | flagged "difficult" |
| Mini T-Spin, no lines | 100 × level | |
| T-Spin, no lines | 400 × level | |
| Mini T-Spin Single | 200 × level | "difficult" |
| T-Spin Single | 800 × level | "difficult" |
| Mini T-Spin Double (where present) | 400 × level | "difficult" |
| T-Spin Double | 1200 × level | "difficult" |
| T-Spin Triple | 1600 × level | "difficult" |
| Back-to-Back difficult clear | action score × **1.5** | excluding soft/hard drop points |
| Combo | 50 × combo × level | see §11.3 |
| Soft drop | 1 per cell | flat, not × level |
| Hard drop | 2 per cell | flat, not × level |

(Sources: [Scoring — TetrisWiki](https://tetris.wiki/Scoring); T-spin rows also at [T-Spin — TetrisWiki](https://tetris.wiki/T-Spin); **first-party confirmation** of every base and T-spin value, soft/hard drop points, and B2B "+50%" at the official [Scoring in Tetris — Tetris Mobile Help Center](https://playstudios.helpshift.com/hc/en/16-tetris-mobile/faq/2437-scoring-in-tetris/); drop points also at [Tetris at tetris.com — Hard Drop Wiki](https://harddrop.com/wiki/Tetris_at_tetris.com).)

**Testable assertion:** the level multiplier is the level *before* the line clear, and drop points never multiply ([Scoring — TetrisWiki](https://tetris.wiki/Scoring), [Tetris at tetris.com — Hard Drop Wiki](https://harddrop.com/wiki/Tetris_at_tetris.com)).

### 11.2 T-spin detection (3-corner rule + mini)

On locking a T, award T-spin credit iff ([T-Spin — TetrisWiki](https://tetris.wiki/T-Spin)):
1. **The last maneuver of the T was a rotation**, and
2. **Three of the four diagonally-adjacent corners of the T's 3×3 box are occupied.** With that:
   - If **both front corners** (the two corners adjacent to the T's protruding mino) **plus at least one back corner** are occupied → **proper T-spin**.
   - Else (of the three occupied corners only **one is a front corner**, two are back) → **Mini T-spin**, **unless** the final rotation was the big SRS kick that moved the T's center 1 across and 2 up/down (kick test 5, (±1, ±2)) → then it is upgraded to a **proper T-spin** ([T-Spin — TetrisWiki](https://tetris.wiki/T-Spin)).
   - If the T points into a wall or floor, **the two back corners count as occupied** ([T-Spin — TetrisWiki](https://tetris.wiki/T-Spin)).

The Guideline describes this as "T-Spin rules based on the 3-corner method, and T-Spin Mini rules based on the pointing side cell method" ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)).

Per-game variants exist (Tetris Worlds: no wall/floor T-spins; New Century/iPod/Evolution: no-kick T-spins only; Tetris Zone: no TST) ([T-Spin — TetrisWiki](https://tetris.wiki/T-Spin)) — the "3-corner standard" above is what the compliance table records for **every modern official game checked** ([Guideline compliant game differences — TetrisWiki](https://tetris.wiki/Guideline_compliant_game_differences)).

**Testable assertions:** (a) T rotated as last action + 3 corners with 2 front → T-spin; (b) same but 1 front + 2 back → mini; (c) 1 front + 2 back but last kick was (±1,±2) → proper T-spin; (d) last action not rotation (move/drop) → no credit even with 3 corners; (e) wall-facing T counts back corners as filled.

### 11.3 Combos

- The **combo counter starts at −1**; each placed piece that clears ≥ 1 line increments it; a placement with no clear resets it to −1. Two consecutive clears = a "1-combo". **Reward (single-player): 50 × combo count × current level, awarded when the counter is > 0** ([Combo — TetrisWiki](https://tetris.wiki/Combo)).
- **Testable assertion:** single clear → no combo bonus (counter 0); second consecutive clear → 50 × 1 × level; a non-clearing placement resets to −1 ([Combo — TetrisWiki](https://tetris.wiki/Combo)).
- Multiplayer garbage-per-combo tables vary per game and are out of scope for a single-player v1 engine ([Combo — TetrisWiki](https://tetris.wiki/Combo)).

### 11.4 Back-to-Back

- B2B = "any combination of two or more 'difficult' line clears without an 'easy' line clear between them"; since Tetris DS, **difficult = Tetris (4-line) or any T-spin line clear**; originally (Tetris Worlds) Tetris only ([Line clear — TetrisWiki](https://tetris.wiki/Line_clear), [Back-to-Back — Hard Drop Wiki](https://harddrop.com/wiki/Back-to-Back)).
- Recognition table ([Back-to-Back — Hard Drop Wiki](https://harddrop.com/wiki/Back-to-Back)): Single/Double/Triple → No; Tetris, T-Spin Single/Double/Triple → Yes.
- Chain semantics: **all difficult clears share one state variable** (TSS → Tetris still counts as B2B); **non-clearing placements do not break the chain**; a plain Single/Double/Triple does break it; **a T-spin with no lines does not break it** ([Back-to-Back — Hard Drop Wiki](https://harddrop.com/wiki/Back-to-Back), [Scoring — TetrisWiki](https://tetris.wiki/Scoring)).
- Bonus: **action score × 1.5, excluding soft/hard drop points** ([Scoring — TetrisWiki](https://tetris.wiki/Scoring); "extra 50%" first-party at [Tetris Mobile Help Center](https://playstudios.helpshift.com/hc/en/16-tetris-mobile/faq/2437-scoring-in-tetris/)).
- **Testable assertion:** Tetris → Double (breaks) → Tetris = no B2B; Tetris → (pieces locked, no clears) → TSD = B2B TSD = 1200 × 1.5 × level.

### 11.5 Perfect Clear

- A Perfect Clear (All Clear) is locking a line-clearing piece that empties the playfield ([Perfect clear — TetrisWiki](https://tetris.wiki/Perfect_clear)).
- Bonus table used by several recent Guideline games (e.g., Tetris Effect, Tetris 2020 mobile), **added on top of the normal line-clear score** ([Scoring — TetrisWiki](https://tetris.wiki/Scoring)):

| PC type | Bonus |
|---|---|
| Single PC | 800 × level |
| Double PC | 1200 × level |
| Triple PC | 1800 × level |
| Tetris PC | 2000 × level |
| B2B Tetris PC | 3200 × level |

- Example from the source: a Triple PC scores 1800 + 500 = 2300 total ([Scoring — TetrisWiki](https://tetris.wiki/Scoring)).
- ⚠️ **Discrepancy:** the first-party Tetris Mobile help center lists the triple-line All Clear bonus as **1600**, not 1800 ([Scoring in Tetris — Tetris Mobile Help Center](https://playstudios.helpshift.com/hc/en/16-tetris-mobile/faq/2437-scoring-in-tetris/)). See Contradictions. **Implementation-safe default: tetris.wiki's table (1800)** — it is the community reference table explicitly scoped to the games named, but flag it.

---

## 12. Level progression

- Guideline defines **two Marathon goal systems** ([Marathon — TetrisWiki](https://tetris.wiki/Marathon)):
  - **Fixed-goal (modern standard since ~2010):** each level requires **10 lines**; starting at level N requires the same *total* as starting at 1 and playing up — e.g., start at 5 → 50 lines to reach level 6. Level caps at 15 (150 lines) typically, up to 30; with Endless on, gravity stops increasing at the cap ([Marathon — TetrisWiki](https://tetris.wiki/Marathon)).
  - **Variable-goal (earlier Guideline):** level L requires **5 × L** goal points; a line clear awards its base score ÷ 100, rounded down (Single = 1, Double = 3, Triple = 5, Tetris = 8, TSD = 12, TST = 16 under the current scoring); excess goal does not carry over ([Marathon — TetrisWiki](https://tetris.wiki/Marathon)). Tetris Worlds' own legacy credit table: Single 1, Double 3, Triple 5, Tetris 8, B2B Tetris 12, T-spin 0 = 1, TSS 3, TSD 7, TST 6 ([Tetris Worlds — TetrisWiki](https://tetris.wiki/Tetris_Worlds)).
- "Player may only level up by clearing lines. Players can choose the level they wish to start on" ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)).
- **Gravity/level changes apply on the level-up event**, i.e., when the fixed line count for the current level is met; the speed curve in §6 then takes the new level ([Marathon — TetrisWiki](https://tetris.wiki/Marathon)).
- Per-game confirmation of "10 Lines" as the modern norm: compliance table rows "Level advancement requirement = 10 Lines" for the modern fixed-goal games ([Guideline compliant game differences — TetrisWiki](https://tetris.wiki/Guideline_compliant_game_differences)).
- **Implementation-safe default: fixed-goal, 10 lines/level, level-selectable start, cap 15 (endless option caps gravity at level 15's 2.36 G)** — *cap choice is a design default, not a Guideline mandate* ([Marathon — TetrisWiki](https://tetris.wiki/Marathon)).

---

## 13. Game over

- **The player tops out when** ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline)):
  1. **Block out** — a piece is spawned overlapping at least one block ([Top out — TetrisWiki](https://tetris.wiki/Top_out));
  2. **Lock out** — a piece locks **entirely above the visible portion** of the playfield (wholly in the vanish zone) ([Top out — TetrisWiki](https://tetris.wiki/Top_out), [Tetris Guideline](https://tetris.wiki/Tetris_Guideline));
  3. **"Top out" (garbage out variant)** — a block is pushed above the 20-row buffer zone (i.e., above the entire vanish zone) ([Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline), [Top out](https://tetris.wiki/Top_out)).
- A piece locking *partially* above the visible field is legal (partial lock out is a different, non-default condition used by some games) ([Top out — TetrisWiki](https://tetris.wiki/Top_out)).
- The exact stack row that triggers death varies per game ("line at 22" for most older Guideline games; "line at 21" Effect; "line at 20" for 2020 mobile/tetris.com) ([Guideline compliant game differences — TetrisWiki](https://tetris.wiki/Guideline_compliant_game_differences)) — with a full 20-row buffer and lock-out, block-out normally fires first anyway.
- **Testable assertions:** (a) spawn overlap → game over; (b) piece locking with all cells in rows 21–40 → game over; (c) piece locking with ≥ 1 cell in rows 1–20 → no game over.

---

## 14. NES / classic divergences (for the owner's judgment)

All NES facts from [Tetris (NES) — TetrisWiki](https://tetris.wiki/Tetris_(NES,_Nintendo)) (reverse-engineered, assembly-level; NTSC runs at 60.0988 fps) and [Scoring — TetrisWiki](https://tetris.wiki/Scoring) unless noted.

### 14.1 What NES *lacks* vs Guideline
- **No hold, no ghost piece, no hard drop, no wall kicks, no lock delay** ("Lock delay, wall kick, and hard drop are not present"); rotation is the right-handed **Nintendo Rotation System**; 1 next piece ([Tetris (NES)](https://tetris.wiki/Tetris_(NES,_Nintendo))).
- Locking: the game only attempts to lock when the piece tries to move down — effectively the piece locks one gravity tick after landing ([Lock delay — TetrisWiki](https://tetris.wiki/Lock_delay)).

### 14.2 NES gravity table (frames per gridcell, NTSC) ([Tetris (NES)](https://tetris.wiki/Tetris_(NES,_Nintendo)))

| Level | Frames/cell | Level | Frames/cell |
|---|---|---|---|
| 00 | 48 | 10–12 | 5 |
| 01 | 43 | 13–15 | 4 |
| 02 | 38 | 16–18 | 3 |
| 03 | 33 | 19–28 | 2 |
| 04 | 28 | 29+ | 1 |
| 05 | 23 | | |
| 06 | 18 | | |
| 07 | 13 | | |
| 08 | 8 | | |
| 09 | 6 | | |

(PAL rebalances the table and reaches 1G at level 19 — see source for the PAL table.)

### 14.3 NES level advancement
- In A-TYPE, the first level-up comes at whichever is smaller: **(startLevel × 10) + 10 lines** or **max(100, (startLevel × 10) − 50) lines**; afterwards +1 level per 10 lines. Examples from source: start 5 → level 6 at 60 lines; start 12 → level 13 at 100 lines; start 16 → level 17 at 110 lines ([Tetris (NES)](https://tetris.wiki/Tetris_(NES,_Nintendo))).

### 14.4 NES scoring ([Scoring — TetrisWiki](https://tetris.wiki/Scoring))

| Level | Single | Double | Triple | Tetris |
|---|---|---|---|---|
| 0 | 40 | 100 | 300 | 1200 |
| 1 | 80 | 200 | 600 | 2400 |
| 2 | 120 | 300 | 900 | 3600 |
| … | … | … | … | … |
| 9 | 400 | 1000 | 3000 | 12000 |
| n | 40(n+1) | 100(n+1) | 300(n+1) | 1200(n+1) |

- Plus soft-drop points equal to cells continuously soft-dropped per piece (not × level). NES quirks: soft-drop points counted only for the last press before lock; soft-drop scoring is buggy (BCD addition error); **the level multiplier uses the level after the line clear** ([Scoring — TetrisWiki](https://tetris.wiki/Scoring)).

### 14.5 NES randomizer
- "The first roll generates a value 0–7 and will accept and deal on any value other than the previous piece dealt or the dummy value of 7. The piece history is initially empty. If the first roll fails, it progresses to a second roll that generates a value 0–6 and deals that piece" ([Tetris (NES)](https://tetris.wiki/Tetris_(NES,_Nintendo))). I.e., mild anti-repeat, no bag, no drought protection.

### 14.6 NES DAS and timing
- DAS: initial delay **16 frames**, then auto-shift **every 6 frames**; counter quirks: if DAS reaches 16 and the piece can't shift, nothing is subtracted; a blocked tap shift instantly sets the counter to 16; the counter resets on *new* press, not on neutral; **DAS charging is dead during ARE and line clear**, but leftover charge can be redirected during ARE ([Tetris (NES)](https://tetris.wiki/Tetris_(NES,_Nintendo))). (PAL: 12/4.)
- Soft drop: **½ G** (i.e., ½ cell per frame at 60.0988 fps ≈ 30 cells/s) ([Tetris (NES)](https://tetris.wiki/Tetris_(NES,_Nintendo))).
- ARE: **10–18 frames** depending on lock height (bottom two rows: 10; +2 frames per 4 rows up) ([Tetris (NES)](https://tetris.wiki/Tetris_(NES,_Nintendo))).
- **Line clear delay: an additional 17–20 frames** (depending on the lock frame) with a 5-step animation advancing when the global frame counter mod 4 = 0 ([Tetris (NES)](https://tetris.wiki/Tetris_(NES,_Nintendo))).
- Game over: block out (with quirks — occasionally escapable by moving/rotating out) ([Top out — TetrisWiki](https://tetris.wiki/Top_out)).

---

## Contradictions and ambiguities (with implementation-safe defaults)

1. **Triple Perfect Clear bonus: 1800 (tetris.wiki, scoped to Tetris Effect / Tetris 2020 mobile) vs 1600 (first-party Tetris Mobile help center).** [Scoring — TetrisWiki](https://tetris.wiki/Scoring) vs [Tetris Mobile Help Center](https://playstudios.helpshift.com/hc/en/16-tetris-mobile/faq/2437-scoring-in-tetris/). **Default: 1800** (community reference table); flag as uncertain. No source disagreement on the other four PC values.
2. **Spawn rows: 21/22 (Guideline-era standard) vs 22/23 (Tetris Worlds) vs one row lower again (tetris.com/Tetris Effect).** [Tetris Guideline](https://tetris.wiki/Tetris_Guideline), [Super Rotation System](https://tetris.wiki/SRS). **Default: 21/22.**
3. **Exact column placement of spawns** ("centered, rounded to the left") is stated only in prose, not as coordinates; the column table in §5 is the standard derivation (**interpretation**). The wiki's own diagram (not text-extractable here) is the underlying evidence ([Super Rotation System — TetrisWiki](https://tetris.wiki/SRS)).
4. **Move-reset counter reset-on-descent behavior** (does the 15 budget restore when the piece reaches a new lowest row?) is not explicitly pinned in any fetched source. **Default: restore on new lowest row** (interpretation; matches modern-game feel).
5. **Next-queue count**: no source states a Guideline-mandated number; "up to six" + per-game 1–6 ([Tetris Guideline](https://tetris.wiki/Tetris_Guideline), [Guideline compliant game differences](https://tetris.wiki/Guideline_compliant_game_differences)). **Default: 6 rendered.**
6. **Line-clear animation delay**: no Guideline-wide constant found; per-game values 400–700 ms (TGM/Tetris DS), 17–20 frames (NES) ([Line clear — TetrisWiki](https://tetris.wiki/Line_clear)). **Default: instant removal, delay as a cosmetic config.**
7. **Post-level-19 gravity**: "no concrete rule" ([Marathon — TetrisWiki](https://tetris.wiki/Marathon)). **Default: clamp at 20G with 0.5 s lock delay** for a capped-at-15 Marathon this never triggers.
8. **Soft drop = 20×** is confirmed as the modern official-game convention, but the Guideline text itself is only summarized as "details vary between guideline versions" ([Tetris Guideline](https://tetris.wiki/Tetris_Guideline), [Guideline compliant game differences](https://tetris.wiki/Guideline_compliant_game_differences)). **Default: 20× native.**

## Missing evidence

- The Guideline document itself (2009 leak or later versions) was not consulted directly — no accessible authoritative copy was found; everything rests on the wiki's synthesis plus per-game observation. Any post-2009 Guideline change (e.g., exact 2014+ values) is unverified.
- No citable source was found for: a mandated Next-queue count (§9), a Guideline-wide line-clear delay (§10), first-bag special rules in canonical Guideline games (§3), or the move-reset-on-descent rule (§7). These are explicitly **not invented** above.
- tetris.wiki's piece-color and rotation-state diagrams are images; their content is reported here via the pages' prose descriptions, not pixel-verified.
- Hard Drop's Tetris Worlds page (the gravity formula's original home) returned HTTP 520 during this research; the formula was instead verified via [TETR.IO issue #467's verbatim quote](https://github.com/tetrio/issues/issues/467), the [Marathon page](https://tetris.wiki/Marathon), and independent numerical re-derivation against the wiki's G table.

---

## Sources

**Kept:**

- **Primary / first-party**
  - [Scoring in Tetris — Tetris Mobile Help Center (PLAYSTUDIOS)](https://playstudios.helpshift.com/hc/en/16-tetris-mobile/faq/2437-scoring-in-tetris/) — official support page for a licensed Tetris game; confirms base scoring, T-spin values, PC bonuses (with the 1600 triple discrepancy), B2B +50%.
  - ["Mr. Tetris" — Blue Planet Software (archived, cited by TetrisWiki)](https://web.archive.org/web/20070228062826/http://www.blueplanetsoftware.com/news_edge.html) — first-party attribution of Guideline development (accessed via [Tetris Guideline](https://tetris.wiki/Tetris_Guideline)).
- **Community-documented, heavily cross-confirmed (primary stand-in for the Guideline)**
  - [Super Rotation System — TetrisWiki](https://tetris.wiki/SRS) — the authoritative community SRS reference; full kick tables, spawn orientations, offset implementation. Cross-confirmed by [Hard Drop wiki SRS](https://harddrop.com/wiki/SRS) and [Tetris Fandom SRS](https://tetris.fandom.com/wiki/Super_Rotation_System).
  - [Tetris Guideline — TetrisWiki](https://tetris.wiki/Tetris_Guideline) — the wiki's synthesis of the Guideline (leak + interviews + observation); playfield, spawn, lock down, DAS/ARR/ARE recommendations, hold, colors, top out, versions, leak provenance.
  - [Random Generator — TetrisWiki](https://tetris.wiki/Random_Generator) — 7-bag semantics and statistical guarantees.
  - [Playfield — TetrisWiki](https://tetris.wiki/Playfield) — matrix size, buffer zone, vanish zone, coordinate convention.
  - [Marathon — TetrisWiki](https://tetris.wiki/Marathon) — fixed/variable goal, Tetris Worlds gravity formula + G table, post-19 handling.
  - [Scoring — TetrisWiki](https://tetris.wiki/Scoring) — the full modern scoring system, B2B, PC table, plus legacy BPS/Sega/Nintendo scoring tables (source of the NES table).
  - [T-Spin — TetrisWiki](https://tetris.wiki/T-Spin) — 3-corner + mini detection and scoring.
  - [Combo — TetrisWiki](https://tetris.wiki/Combo) — counter semantics and 50 × combo × level.
  - [Back-to-Back — Hard Drop Wiki](https://harddrop.com/wiki/Back-to-Back) — B2B recognition table and chain-break rules.
  - [Top out — TetrisWiki](https://tetris.wiki/Top_out) — block out / lock out / partial lock out / garbage out definitions.
  - [Lock delay — TetrisWiki](https://tetris.wiki/Lock_delay) and [Infinity (move reset) — TetrisWiki](https://tetris.wiki/Infinity) — lock-delay modes and the 15-reset limit.
  - [Drop — TetrisWiki](https://tetris.wiki/Drop) — gravity units, soft drop, locking hard drop.
  - [DAS — TetrisWiki](https://tetris.wiki/DAS) — DAS/ARR definitions and measurement convention.
  - [Hold piece — TetrisWiki](https://tetris.wiki/Hold_piece) and [Piece preview — TetrisWiki](https://tetris.wiki/Piece_preview) — hold and next-queue semantics.
  - [Guideline compliant game differences — TetrisWiki](https://tetris.wiki/Guideline_compliant_game_differences) — per-game table that grounds soft-drop 20×, move-reset 15, next counts, top-out rows, T-spin rule variants, guideline versions.
  - [Tetris Worlds — TetrisWiki](https://tetris.wiki/Tetris_Worlds) — the reference implementation of Guideline 2002; variable-goal credit table.
  - [TetrisWiki:About](https://tetris.wiki/TetrisWiki:About) — provenance/reliability of the wiki itself.
- **Reverse-engineered (authoritative for NES)**
  - [Tetris (NES) — TetrisWiki](https://tetris.wiki/Tetris_(NES,_Nintendo)) — NES gravity table ($898E), DAS counters, ARE, line-clear animation, randomizer, level-ups; also references the [meatfighter Nintendo Tetris AI assembly-level write-up](http://meatfighter.com/nintendotetrisai/#The_Mechanics_of_Nintendo_Tetris).
- **Corroboration**
  - [TETR.IO issues #467](https://github.com/tetrio/issues/issues/467) — verbatim quote of the harddrop gravity formula with exponent.
  - [Independent WallKick.java implementation](https://github.com/jasonbai2014/Tetris/blob/master/src/model/WallKick.java) — independent match of the JLSTZ table.

**Rejected / deprioritized:**
- [Tetris Fandom wiki](https://tetris.fandom.com/wiki/Super_Rotation_System) — same content family as tetris.wiki (fork of the same wiki), used only as a cross-check, not cited as an owner.
- [gamedev.stackexchange "Understanding Tetris speed curve"](https://gamedev.stackexchange.com/questions/159835/understanding-tetris-speed-curve) — Q&A aggregation; superseded by the wiki pages it cites.
- Blog write-ups (e.g., "How to Make Tetris" tutorials) and clone product pages — secondary, no independent authority.
- tetris.fandom "Scoring" — redundant with tetris.wiki/harddrop scoring pages.

---

## Next steps

- Optional: locate and archive a copy of the leaked 2009 Guideline (it circulates as a PDF; linking it here was deliberately avoided) to upgrade "community-documented" to "primary" for §5–§12 constants.
- When implementing, write the unit tests from the "Testable assertions" bullets in §2–§13 first — they encode every crisp rule; the flagged interpretation defaults (spawn columns, move-reset-on-descent, clear delay) should be config constants, not hard-coded.
- If versus/multiplay is ever in scope, revisit the per-game combo/garbage tables ([Combo — TetrisWiki](https://tetris.wiki/Combo)) — deliberately out of scope here.
