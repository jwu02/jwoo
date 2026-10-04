# Research: Authoritative classic Pac-Man rules

Resolves wayfinder ticket jwoo#30 ("Research: the authoritative Pacman rules") for map jwoo#29 ("Wayfinder map: Pacman application").
Goal: a spec complete enough to implement and unit-test a faithful classic Pac-Man engine with no further research.

## Source provenance and method

- **[D] The Pac-Man Dossier, Jamey Pittman, v1.0.27 (2015-08-11)** — the primary source; author states all data "extracted from or verified with disassembly output from the original Pac-Man code ROMs." Fetched and quoted directly from the live mirror **https://pacman.holenet.info/** (also mirrored at https://www.gamedeveloper.com/design/the-pac-man-dossier and https://cs.au.dk/~ocaprani/GameAI/PacMan/The%20Pac-Man%20Dossier.pdf). The originally cited mirrors are dead: `pacman.vace.fr` fails DNS, and the original `home.comcast.net/~jpittman2/pacman/pacmandossier.html` is gone (Wayback has it).
- **[GI] "Understanding Pac-Man Ghost Behavior", Chad Birch, GameInternals, 2010-12-02** — gameinternals.com is broken today (redirects to a 404 path); full text recovered from a verbatim mirror at https://stuff-youlike.tumblr.com/post/127184806813/understanding-pac-man-ghost-behavior (excerpt also at https://rhizome.org/editorial/2011/may/03/recommen-reading-understanding-pac-man-ghost-behav/, quotes at https://www.jwz.org/blog/2010/12/dissection-of-the-pac-man-ai/).
- **[DH] Don Hodges, "Pac-Man's Ghost Behaviour Analyzed and Fixed" (2008, updated 2015)** — fetched directly from http://www.donhodges.com/pacman_pinky_explanation.htm — Z80-level analysis of the Pinky/Inky "up" overflow bug with original code addresses.
- **[LOM] Chris Lomont, "Pac-Man Emulation Guide v0.1" (Oct 2008)** — https://www.lomont.org/software/games/pacman/PacmanEmulation.pdf — hardware, DIP switches, bugs.
- **[DIS] Annotated Pac-Man arcade ROM disassembly** — http://www.cubeman.org/arcade-source/pacman.asm (fetched; RAM map comments, speed bit-pattern tables referenced in its Ms. Pac-Man sibling http://www.cubeman.org/arcade-source/mspac.asm).
- **[FLO] floooh/pacman.c** — https://github.com/floooh/pacman.c/blob/main/pacman.c — a C port implemented from the Dossier with arcade ROM data; supplies the freeze/round timing constants in use by faithful implementations.
- **[ARM] armin-reichert/pacman-basic `doc/maps.txt`** — https://github.com/armin-reichert/pacman-basic/blob/main/doc/maps.txt — machine-readable wall/path map of the original maze from a disassembly-faithful reimplementation (Pac-Man + prototype + 4 Ms. Pac-Man mazes).
- **[MUS] Midway DIP-switch documentation** — https://www.arcade-museum.com/dipswitch-settings/pac-man and https://www.arcade-museum.com/tech-center/game-dips/pacman; Midway parts/operating manual mirrors (vernimark.com PDF, archive.org `pacman-bally-midway`).
- **[DUNN] Steve Dunn, "Pacman Dissected" (2017)** — https://dunnhq.com/posts/2017/08/03/pacman-dissected/ — corroborates the Dossier's per-level `LevelProps` table (speeds, Elroy, fright times) as implemented in a faithful TypeScript clone.

Validation note: `source_check` was run against the load-bearing mechanical claims (scatter/chase schedule, speed bands, Elroy thresholds). It returned **status "unclear" (confidence 0.30)** — its automated semantic-support layer was unavailable and it instructed manual review of cited passages. Manual verification was performed instead by fetching and quoting the primary texts themselves (the Dossier mirror, Game Internals mirror, Don Hodges). All decision-critical numbers below are marked with the source that literally contains them. Constraints honored: no subagents, no git/gh, no writes inside the jwoo repo. (The task's requested output path `/tmp/wayfinder-research/pacman-dossier-rules.md` was superseded by this run's authoritative runtime output path; the parent session may copy this file there.)

## Coordinate conventions (used throughout)

- Native screen: 224×288 px = **28×36 tiles** of 8×8 px [D, LOM, GI].
- Rows 0–2 (36-row frame): score/header. Rows 3–33: the playfield (31 rows). Rows 34–35: lives + fruit counter. **All tile coordinates below are `(col,row)` in playfield-local rows 0–30** unless suffixed "(36-row)", which is top-left-origin over all 36 rows (playfield row *r* = 36-row *r*+3).
- Actors occupy the tile containing their **center point**; sprites are 16×16 and overlap neighbors; collision is decided by center-point tile sharing [D ch.3, GI].
- Horizontal start positions are half-tile (`x = 13.5` means the actor straddles columns 13/14, center at px 112).

## 1. Maze, tunnel, and machine-readable map

- One maze for all levels; 28 tiles wide; the **side tunnel wraps** left↔right [D, GI]. Tunnel row = **playfield row 14** (36-row 17); it is walkable from column 0 through 9 and 18 through 27 (house wall/interior occupies 10–17) [ARM map, image-verified against [D] `lvl1.png`].
- Ghost house ("monster pen"): door tiles **(13,12) and (14,12)**; interior (actors-free) columns 11–16, rows 13–15; house center **(13.5, 14)**. Off-limits to Pac-Man; ghosts only enter via eaten-eyes or reset [D ch.2, GI].
- **Pellets: 244 total = 240 dots (10 pts) + 4 energizers (50 pts)**; clearing all 244 completes the round (2,600 pts/round from pellets) [D ch.2, GI].
- Dotless walkable tiles (engine test): ghost-house loop — rows 11 and 17 cols 9–18, rows 12–16+18 at cols 9 and 18, row 14 cols 7–9 and 18–20; tunnel outer halves row 14 cols 0–5 and 22–27; Pac-Man start tiles (13,23) and (14,23).
- Special tiles: energizers at **(1,3), (26,3), (1,23), (26,23)**; "no-up" tiles (ghosts only, see §2): **(12,11), (15,11), (12,23), (15,23)**; fruit spawn **(13.5, 17)**; Pac-Man start **(13.5, 23)**; ghost starts: Blinky **(13.5, 11)** (outside, above door), Pinky **(13.5, 14)**, Inky **(11.5, 14)**, Clyde **(15.5, 14)** [D `StartPositions.png` image-verified, GI diagram].

Machine-readable map (canonical 28×31 transcription; legend `#`=wall, `.`=dot, `o`=energizer, `-`=ghost-house door, blank=walkable-no-dot or void). **Verified two ways:** row-for-row against [ARM]'s ROM-faithful wall/path map (`|`=wall-boundary, `.`=path, `_`=void), and visually against the Dossier's level-1 screenshot. Dot count of this transcription = exactly 240 + 4 energizers.

```
############################
#............##............#
#.####.#####.##.#####.####.#
#o####.#####.##.#####.####o#
#.####.#####.##.#####.####.#
#..........................#
#.####.##.########.##.####.#
#.####.##.########.##.####.#
#......##....##....##......#
######.##### ## #####.######
     #.##### ## #####.#
     #.##          ##.#
     #.## ###--### ##.#
######.## #      # ##.######
      .   #      #   .
######.## #      # ##.######
     #.## ######## ##.#
     #.##          ##.#
     #.## ######## ##.#
######.## ######## ##.######
#............##............#
#.####.#####.##.#####.####.#
#.####.#####.##.#####.####.#
#o..##.......  .......##..o#
###.##.##.########.##.##.###
###.##.##.########.##.##.###
#......##....##....##......#
#.##########.##.##########.#
#.##########.##.##########.#
#..........................#
############################
```

Where to get machine-readable data (cited exactly, per ticket):
- Wall/path (unambiguous 3-symbol encoding, includes prototype + Ms. Pac-Man mazes): https://github.com/armin-reichert/pacman-basic/blob/main/doc/maps.txt
- Full game data in JS (GPL-3): shaunlebron/pacman, `js/map.js` + `src/` — https://github.com/shaunlebron/pacman (its README claims "coordinate space, movement physics, ghost behavior, actor speeds, timers, and update rate match that of the original arcade game", while flagging approximated score-display/map-blink timings and intentionally omitted overflow bug).
- The Dossier's own maze map image: https://pacman.holenet.info/ (Chapter 2 / maze map section).

**Licensing caution (flagged, decision for the design ticket):** the maze artwork/layout is Namco/Bandai Namco IP; an ASCII transcription of tile data circulates widely in open-source clones but carries no clear license of its own. shaunlebron/pacman is **GPL-3** — do not copy its code/data verbatim into the personal site unless GPL is acceptable. Safest: transcribe tile constants directly from the layout above (facts/mechanics) rather than importing GPL sources.

## 2. Movement, decisions, and cornering

- Everything moves in **8-px tiles at per-pixel granularity**; on each frame an actor advances an integer number of pixels per axis according to its speed (arcade quantizes speeds with per-actor 256-frame step bit-patterns; disassembly shows "speed bit patterns" tables [DIS/mspac.asm]; the Dossier expresses the same speeds as % of maximum) [D].
- **Ghost decision rule (one-tile lookahead):** whenever a ghost *enters a new tile*, it looks ahead to the next tile along its current direction and pre-decides the direction it will take there. When it reaches that tile it executes the pre-decided turn [D ch.3 "Looking Ahead", GI].
- **No voluntary reversal.** A ghost never picks its reverse direction; a two-exit tile is always straight through [D, GI].
- **Intersection choice:** among the non-reverse exits of the upcoming tile, pick the direction whose *next* tile is closest **in a straight line (Euclidean distance)** to the ghost's target tile. **Tie-break preference: up > left > down; right is never chosen on a tie** [D ch.3, GI]. (The ROM compares squared distances without sqrt — implementation detail consistent with the disassembly; medium confidence.)
- **Forced reversal:** the system reverses all ghosts on every chase↔scatter transition and on entering frightened (chase→frightened, scatter→frightened). **No reversal when leaving frightened** (frightened→chase/scatter) [D ch.2, GI]. A reversal signal applies when the ghost next enters a tile, overriding the pre-decided direction; it also applies to ghosts still in the house (they exit left briefly, then reverse right) [GI].
- **"No-up" tiles:** ghosts may never choose UP at **(12,11), (15,11), (12,23), (15,23)** (two red zones spanning cols 12–15 on rows 11 and 23 — image-verified [D `exploit.png`]); they pass straight through. The restriction is **ghosts-only** (Pac-Man may turn up), applies in scatter and chase, and is **ignored during frightened** mode [D, GI]. (Lomont's guide loosely calls these "the two passages immediately above the pen" — the four-tile/two-zone formulation is the verified one.)
- **Tunnel:** wrap on row 14; ghosts suffer a tunnel speed penalty (Pac-Man does not) [D, GI].
- **Pac-Man cornering:** Pac-Man may turn up to several pixels before or after a tile center ("pre-turn"/"post-turn": 3 pre-turn pixels approaching from the left, 4 from the right; symmetric vertically). During a pre/post turn he moves 1 px in the new direction per 1 px in the old (45°, effectively double speed) until reaching the new centerline. Ghosts can only turn exactly at tile centers. Cornering is the player's main speed edge [D ch.2 "Cornering"].
- **Pac-Man movement details:** 4-way only; direction changes execute at the earliest legal pixel (buffered input enables pre-turns); Pac-Man *can* reverse instantly (unlike ghosts). **Eating pauses:** Pac-Man stops **1 frame per dot** and **3 frames per energizer** (this is why his effective "eating" speed is ~71% when nominal is 80%) [D ch.2 "Speed"].
- **Collision:** Pac-Man dies when a ghost's center-point tile equals his tile (either moving into the other). The famous **pass-through bug**: if the two swap tiles in the same frame, no collision is registered [D ch.3, LOM]. (Faithful remakes often deliberately tighten collision; decide explicitly in the design ticket.)

## 3. Per-ghost targeting (chase mode)

All four share the movement/decision rules of §2; they differ only in target-tile selection [D ch.3–4, GI].

- **Blinky (red, "Shadow"/oikake):** target = **Pac-Man's current tile**, always [D ch.4, GI].
- **Pinky (pink, "Speedy"/machibuse):** target = **4 tiles ahead of Pac-Man in his facing direction**. **Overflow bug:** when Pac-Man faces UP, the target is **4 up AND 4 left** (ROM computes the offset by doubling a 2-byte vector: `ADD HL,HL` twice at $2795–$2797; the up-vector (#00FF)×4 = #03FC = (−4,−4) in x/y — Don Hodges gives the exact code and a fix) [D ch.4, GI, DH]. Corollary (exploitable): if Pac-Man faces toward a nearby Pinky, her target lands behind her and she turns away ("head-fake") [D, GI].
- **Inky (cyan, "Bashful"/kimagure):** take the point **2 tiles ahead of Pac-Man** (with the **same up-bug**: 2 up and 2 left when facing up), draw a **vector from Blinky's tile to that point, and double it**; the endpoint is Inky's target [D ch.4, GI].
- **Clyde (orange, "Pokey"/otoboke):** if his Euclidean tile distance to Pac-Man is **> 8 tiles**, target = Pac-Man's tile (like Blinky); if **≤ 8 tiles** (GI: "less than eight"; D: "eight tiles or more" → chase — treat the boundary as: chase when distance > 8, corner when ≤ 8; the two sources differ only in phrasing of the boundary), target = his scatter corner. Result: Clyde endlessly loops near his corner when Pac-Man is close [D ch.4, GI].
- **Eaten-ghost eyes:** target = the tile **directly above the left side of the house door** — playfield (13,11), i.e. 36-row (13,14) [D ch.3 "Fixed Target Tiles" + `Scatter.png` image-verified; GI diagram]. Eyes ignore fright, re-enter the house, revive, and leave immediately.
- **Scatter targets (fixed, unreachable, in dead space)** — 36-row top-left-origin coordinates [GI diagram; corroborated by floooh/pacman.c constants and common implementations]:
  - Blinky: **(25, 0)** (top-right, 2 cols in from the right edge)
  - Pinky: **(2, 0)** (top-left)
  - Inky: **(27, 35)** (bottom-right, at the edge)
  - Clyde: **(0, 35)** (bottom-left, at the edge)
  - (floooh/pacman.c writes the bottom pair as y=34 in a bottom-up convention — same semantic corners; minor indexing disagreement, not a behavioral one.)
  In scatter each ghost loops endlessly around its corner because the target is unreachable [D, GI].

## 4. Cruise Elroy (Blinky speed-up)

- When remaining dots fall to a per-level threshold, Blinky speeds up (**Elroy 1**), and at half that threshold again (**Elroy 2**). In Elroy state Blinky **keeps targeting Pac-Man's tile even in scatter** (he still reverses on mode switches) [D ch.4, GI].
- Thresholds and speeds per level [D Table A.1; exact rows quoted from the fetched table]:

| Level | Elroy1 dots left | Elroy1 speed | Elroy2 dots left | Elroy2 speed |
|---|---|---|---|---|
| 1 | 20 | 80% | 10 | 85% |
| 2 | 30 | 90% | 15 | 95% |
| 3–4 | 40 | 90% | 20 | 95% |
| 5 | 40 | 100% | 20 | 105% |
| 6–8 | 50 | 100% | 25 | 105% |
| 9–11 | 60 | 100% | 30 | 105% |
| 12–14 | 80 | 100% | 40 | 105% |
| 15–18 | 100 | 100% | 50 | 105% |
| 19–21+ | 120 | 100% | 60 | 105% |

- **After a life is lost, Elroy is suspended** until Clyde has left the house (Blinky reverts to normal speed and scatter behavior), then resumes based on dots remaining [D ch.4, GI].
- The dot counter used for Elroy is the *level's* remaining-dot count; the after-death suspension and the house dot-counter rules interact (see §7) [D].

## 5. Scatter/chase schedule and frightened mode

Mode timer [D ch.2 "Scatter, Chase, Repeat" — table quoted verbatim; GI agrees]:

| Wave | Level 1 | Levels 2–4 | Levels 5+ |
|---|---|---|---|
| Scatter 1 | 7 s | 7 s | 5 s |
| Chase 1 | 20 s | 20 s | 20 s |
| Scatter 2 | 7 s | 7 s | 5 s |
| Chase 2 | 20 s | 20 s | 20 s |
| Scatter 3 | 5 s | 5 s | 5 s |
| Chase 3 | 20 s | 1033 s | 1037 s |
| Scatter 4 | 5 s | 1/60 s | 1/60 s |
| Chase 4 | indefinite | indefinite | indefinite |

- Four scatter periods per level, then chase forever. The 1/60 s scatter exists purely to force a direction reversal [GI].
- **The timer resets at level start and whenever a life is lost; ghosts (re)start in scatter. It pauses while frightened and resumes where it left off** [D, GI].
- (Presentation quirk: the tumblr copy of GI lists level 1's phases bottom-up; the Dossier table above is the authoritative ordering.)

**Frightened mode** [D ch.2 "Frightening Behavior" + Table A.1; GI]:
- Eating an energizer: ghosts **reverse**, turn blue (except levels below), slow down, and wander using a **PRNG** (a pseudo-random address 0000h–1FFFh is generated and its low bits choose the first direction to try; if blocked or reversing, try next direction clockwise). **The PRNG re-seeds identically at every level start and life loss**, so frightened paths are reproducible [D; LOM agrees].
- **Frightened duration and flash count per level** [D Table A.1, quoted]:

| Level | Fright time | Flashes | | Level | Fright time | Flashes |
|---|---|---|---|---|---|---|
| 1 | 6 s | 5 | | 11 | 2 s | 5 |
| 2 | 5 s | 5 | | 12 | 1 s | 3 |
| 3 | 4 s | 5 | | 13 | 1 s | 3 |
| 4 | 3 s | 5 | | 14 | 3 s | 5 |
| 5 | 2 s | 5 | | 15 | 1 s | 3 |
| 6 | 5 s | 5 | | 16 | 1 s | 3 |
| 7 | 2 s | 5 | | 17 | none | — |
| 8 | 2 s | 5 | | 18 | 1 s | 3 |
| 9 | 1 s | 3 | | 19 | none | — |
| 10 | 5 s | 5 | | 20, 21+ | none | — |

- On levels with no fright (17, 19, 20, 21+), energizers still force the reversal and score nothing extra — ghosts never turn blue [D ch.2 + Table A.1]. (GI's prose simplifies this to "eliminated from level 19 onwards"; the disassembly-backed Table A.1 — which keeps a 1 s fright on 18 and none on 17 — is authoritative.)
- Ghosts flash white near the end as a warning, then return to their previous mode; the scatter/chase timer was paused throughout [D, GI].
- A ghost already eaten (eyes) is not re-frightened by another energizer; house-bound ghosts turn blue but do not leave early (standard emulator behavior — medium confidence, consistent with [DUNN]'s note that a ghost can be blue while in the house).

## 6. Speeds

All values are **percent of maximum speed = 75.75757625 px/s** (= ~9.47 tiles/s; at 60 fps, 100% ≈ 1.26 px/frame; level-1 Pac at 80% ≈ 60.6 px/s ≈ 1 px/frame) [D Table A.1 header; refresh 60.606061 Hz per D Appendix C / LOM].

| Levels | Pac-Man | Pac-Man (eating dots) | Pac-Man frightened | Ghosts | Ghosts frightened | Ghosts in tunnel |
|---|---|---|---|---|---|---|
| 1 | 80% | ~71% | 90% | 75% | 50% | 40% |
| 2–4 | 90% | ~79% | 95% | 85% | 55% | 45% |
| 5–20 | 100% | ~87% | 100% | 95% | 60% | 50% |
| 21+ | 90% | ~79% | — | 95% | — | 50% |

- Pac-Man gets *faster* while frightened on levels 1–4; ghosts get slower; both effects fade by level 5 [D].
- **Level-21 inversion:** Pac-Man drops back to 90% while ghosts stay at 95% — ghosts become faster than Pac-Man for the rest of the game [D].
- Tunnel slowdown is ghosts-only and applies in addition to (instead of) their normal speed; when a frightened ghost enters the tunnel both rates apply — implementations use the slower (tunnel) rate (standard emulator behavior; exact precedence not quoted in captured primary text — **medium confidence, flagged**).
- Elroy speeds override Blinky's normal ghost speed (§4) [D Table A.1].
- Implementation note: the arcade realizes these percentages via whole-pixel movement on selected frames (256-frame bit-pattern tables per actor/state, e.g. `$4D46–$4D85` in the disassembly listing [DIS]); an engine may instead accumulate fractional pixels per tick — behavior-equivalent to first order, but frame-exact pattern replication matters only for pattern-play fidelity.

## 7. Ghost house (release logic)

[D ch.2 "Home Sweet Home" — quoted/paraphrased from fetched text]

- Starts/resets: Blinky **outside above the door**; Pinky center, Inky left, Clyde right inside. After every life loss and level start this arrangement is restored.
- **Personal dot counters** (one active at a time, preference order **Pinky → Inky → Clyde**; a counter counts dots eaten while its ghost waits): dot limits — **Pinky 0 (always leaves immediately); level 1: Inky 30, Clyde 60; level 2: Inky 0, Clyde 50; level 3+: all 0** (everyone leaves immediately).
- **Global dot counter** (activates when a life is lost, resets to 0): **Pinky released at 7, Inky at 17; if Clyde is still in the house when it reaches 32, the counter deactivates and personal counters resume (Clyde then uses his personal limit).** Known exploit: if Clyde is timer-released *before* 32, the global counter never deactivates and 7/17 ghosts stay trapped as long as dots keep being eaten [D].
- **No-dot timer:** if Pac-Man goes **4 s** (levels 1–4) / **3 s** (level 5+) without eating a dot, the highest-preference ghost in the house is force-released and the timer resets [D].
- **Exit direction:** ghosts always begin moving **left** out of the house; if a mode change occurred while they were inside (reversal pending), they immediately reverse and exit right [D, GI].
- House interior: waiting ghosts bounce up/down; eaten ghosts (eyes) path to the door tile, descend into the house to their slot, and re-emerge immediately (slot-return behavior per faithful ports [FLO]; the Dossier documents the door and revival but not slot micro-pathing — **medium confidence**).

## 8. Scoring, fruit, and the status row

- Dot **10**; energizer **50** (2,600/round from 244 pellets) [D, GI].
- **Ghost chain per energizer: 200 → 400 → 800 → 1600** (doubles each time; resets with each energizer) [D ch.2, GI].
- **When a ghost is eaten, the whole game freezes for 1 second (60 ticks) while the score is displayed**; only the eaten ghost's score sprite and Pac-Man are shown [FLO: `GHOST_EATEN_FREEZE_TICKS = 60`; shaunlebron/pacman flags such score-pause timings as approximated in remakes, but 60 ticks is the constant used by faithful ports — **high confidence on 1 s, medium on frame-exactness**].
- **Bonus fruit** appears **directly below the pen at (13.5, 17)** — first after **70 dots**, second after **170 dots** eaten [D ch.2, GI]. It stays on screen **"always between nine and ten seconds"** — the exact duration is variable/random and not pattern-predictable [D ch.2; FLO uses a flat 10 s].
- Per-level fruit and values [D Table A.1, quoted]: Cherries 100 (L1); Strawberry 300 (L2); Peach/Orange 500 (L3–4); Apple 700 (L5–6); Grapes/Melon 1000 (L7–8); Galaxian 2000 (L9–10); Bell 3000 (L11–12); Key 5000 (L13+).
- Fruit eaten: value added and its score digits displayed at the fruit spot (~2 s in remakes; no game freeze) — **display duration not primary-source-verified; flagged unresolved**.
- Status row (bottom-right) shows the fruit symbols of the **last six completed levels plus the current one** (max 7 tiles) [D ch.2; FLO `NUM_STATUS_FRUITS = 7`].
- Score display caps at 999,999 ("flipping"/rolling at 1,000,000) [D Glossary]. Perfect game = 3,333,360 [D FAQ].

## 9. Lives, extra life, level progression, and sequence timing

- **Lives: 3 per game by default** (DIP: 1/2/3/5) [LOM Table 10; MUS DIP listings].
- **Extra life at 10,000 points by default** (DIP alternatives: 15,000 / 20,000 / none) [LOM Table 10; MUS]. Operator documentation describes a single bonus Pac-Man award; "once per game" is operator-manual lore — **not disassembly-verified here; flagged**.
- **Death sequence:** collision → freeze (~1 s, `PACMAN_EATEN_TICKS = 60` [FLO]) → death animation (~2.5 s, 150 ticks [FLO]) → actors reset (ghosts to house slots, Blinky above door, Pac to (13.5,23)); eaten dots stay eaten; scatter/chase timer and PRNG reset; global dot counter activates; Elroy suspends until Clyde exits [D, GI, FLO].
- **Ready sequence:** new game shows "PLAYER ONE" with the start jingle (~2 s) then "READY!" (~2 s) — ≈4 s total; after a death or between rounds "READY!" ≈ 2 s before play resumes [FLO game-loop constants: 2 s prelude + 2 s ready; consistent with common faithful implementations]. **ROM-exact frame counts for the READY!/PLAYER-ONE phases were not confirmed against the disassembly in this run — flagged as implementation-standard approximations** (shaunlebron/pacman explicitly approximates such non-critical timings).
- **Round won (all 244 pellets):** gameplay freezes ~4 s with the maze flashing (blue/white), then next level; house ghosts reset; timer resets to scatter [FLO `ROUNDWON_TICKS = 4*60`; flash count/animation is cosmetic — approximated in remakes].
- **Level progression:** the maze never changes; difficulty comes entirely from the per-level tables (speeds, fright, Elroy — §4–6). **All mechanics cap at level 21; every level from 21 on is identical** [D Table A.1, GI]. The internal level counter starts at 0 and is a single byte — on level 256 the fruit-drawing routine overflows and corrupts the right half of the screen (**"split screen" kill screen**; 114 visible + 9 resettable right-half dots, unwinnable) [D ch.5; LOM; DH "Splitting Apart the Split Screen"].
- **Intermissions ("coffee breaks")** play after completing levels **2, 5, 9**, and scene 3 repeats after **13, 17, …** [vintage period guide "Break a Million at Pac-Man" (boards 2, 5, 9, 13, 17); Pac-Man Wiki "Coffee Break" (rounds 2, 5, 9)]. Period-documentation level; **not disassembly-verified in this run — flagged**.
- **Hard difficulty DIP** (solder pad): removes levels 1, 3, 6, 19, 20 from the sequence while leaving the fruit-symbol table untouched (so symbols shift relative to levels); attract-mode death identifies the setting (Clyde kill = hard) [D Table A.2, LOM].
- Hardware beat: 60.606061 Hz vertical blank drives all logic [D Appendix C, LOM]. Engines should tick at 60 Hz and accept the ~1% drift, or tick at 60.6061 for frame-exact timing.

## 10. Testable invariants for the engine (distilled)

1. Map: 28×31 playfield; exactly **240 dots + 4 energizers** at the coordinates in §1; energizers at (1,3),(26,3),(1,23),(26,23); door tiles (13,12),(14,12); wrap on row 14.
2. Decisions: ghost direction changes only at tile centers via one-tile lookahead; never reverse voluntarily; distance = straight-line to target; tie-break up > left > down; UP forbidden at (12,11),(15,11),(12,23),(15,23) except when frightened.
3. Mode waves: 7/20/7/20/5/20/5/∞ (L1), 1033 s third chase + 1/60 s fourth scatter (L2–4), 5 s scatters + 1037 s (L5+); timer reset on life lost/level start; paused during fright; forced reversal on every wave transition and on fright entry, none on fright exit.
4. Targets: Blinky=Pac tile; Pinky=4-ahead (+4-left when facing up); Inky=doubled Blinky→(2-ahead, +2-left bug); Clyde=8-tile switch; eyes=(13,11) playfield; scatter corners (25,0),(2,0),(27,35),(0,35) in 36-row coords.
5. Elroy: thresholds/speeds per §4 table; chases during scatter; suspended after death until Clyde exits.
6. Speeds: §6 table vs 75.75757625 px/s; 1-frame dot pause, 3-frame energizer pause; tunnel penalty ghosts-only.
7. Fright: per-level durations/flashes per §5; PRNG re-seeded per level/life; chain 200/400/800/1600 with 1 s freeze per eaten ghost; no fright L17, L19+.
8. House: dot limits 0/30/60 (L1), 0/0/50 (L2), 0/0/0 (L3+); global counter 7/17/32; force-release timer 4 s (3 s from L5); exit left unless reversal pending.
9. Fruit: spawns at 70 and 170 dots at (13.5,17); 9–10 s lifetime; values 100–5000 per §8; 7-symbol status row.
10. Progression: 3 lives default; extra life at 10,000; 244 pellets clear the round; mechanics frozen at L21; 8-bit level counter → L256 kill screen.

## Contradictions and disagreements found

- **Fright availability:** GI prose says frightened mode is "completely eliminated from level 19 onwards"; Dossier Table A.1 (disassembly-backed) shows **no fright on 17, none on 19/20/21+, but 1 s on 18**. Prefer the Dossier table. Also note the Dossier's Chapter-2 prose ("By level 19, the ghosts stop turning blue altogether") is loose vs. its own table.
- **Scatter-target y-coordinate:** floooh/pacman.c encodes bottom corners as y=34 (bottom-up convention) vs the 28×36 top-down y=35 used by GI-derived implementations. Semantically identical corners; pick one convention and document it.
- **Clyde boundary phrasing:** Dossier ("eight tiles or more → chase") vs GI ("farther than eight tiles away → chase"). Boundary inclusion differs by wording; behaviorally negligible, but unit tests should pin one (recommend: chase iff distance > 8).
- **Lomont** describes only "two passages" of no-up restriction (upper zone); Dossier/GI verify **two zones / four tiles**.
- **Dead mirrors:** `pacman.vace.fr` (DNS dead), original comcast Dossier URL (dead), gameinternals.com (broken redirects) — all content recovered from the mirrors listed in Source provenance.
- **Intermission schedule:** vintage guide says boards 2, 5, 9, 13, 17; wiki rounds 2, 5, 9 (+repeats). No disassembly-level confirmation captured; treated as consistent period documentation.

## Missing evidence / unresolved

- ROM-exact frame counts for PLAYER-ONE/READY! phases, round-won flash, and eaten-fruit score display (remakes approximate them; the 60-tick ghost-freeze is the best-attested constant). Disassembly listing was captured (cubeman.org pacman.asm) but its comments are sparse; a dedicated pass over the state-machine code ($4E00 block) would pin these.
- Frightened-vs-tunnel speed precedence (assumed slower-wins; not quoted from a primary source).
- "Extra life awarded once per game" (operator-manual lore only).
- Exact eyes-to-slot micro-pathing inside the house (slot positions documented; path details from ports).
- Whether the maze/pellet map transcription can be shipped in-repo license-wise (Namco IP vs. functional data) — decision for the design ticket.

## Sources

Kept:
- The Pac-Man Dossier (v1.0.27) — https://pacman.holenet.info/ — primary, disassembly-verified; all tables quoted from the fetched page.
- Understanding Pac-Man Ghost Behavior (GameInternals, full-text mirror) — https://stuff-youlike.tumblr.com/post/127184806813/understanding-pac-man-ghost-behavior — accessible restatement of the ghost AI; coordinates/diagrams.
- Don Hodges, Ghost Behaviour Analyzed and Fixed — http://www.donhodges.com/pacman_pinky_explanation.htm — Z80 proof of the Pinky/Inky up-bug.
- Chris Lomont, Pac-Man Emulation Guide — https://www.lomont.org/software/games/pacman/PacmanEmulation.pdf — hardware, DIP switches, bugs.
- armin-reichert/pacman-basic doc/maps.txt — https://github.com/armin-reichert/pacman-basic/blob/main/doc/maps.txt — machine-readable wall map (cross-validated the transcription).
- floooh/pacman.c — https://github.com/floooh/pacman.c/blob/main/pacman.c — timing constants used by faithful ports (60-tick freeze etc.), scatter constants.
- Annotated arcade disassembly — http://www.cubeman.org/arcade-source/pacman.asm — RAM map, speed bit-pattern tables.
- Midway DIP documentation — https://www.arcade-museum.com/dipswitch-settings/pac-man — lives/extra-life defaults.
- Dossier images fetched and inspected directly: lvl1.png (maze), Scatter.png (corners + eyes target), StartPositions.png (starts), exploit.png (no-up zones + tunnel zones).
- Steve Dunn, Pacman Dissected — https://dunnhq.com/posts/2017/08/03/pacman-dissected/ — corroborates per-level LevelProps.

Rejected/deprioritized:
- pacman.vace.fr — DNS dead. home.comcast.net/~jpittman2 — dead (use holenet/gamedeveloper mirrors).
- gameinternals.com — broken (404 redirect path); replaced by verbatim mirrors.
- Steve Dunn's in-post ASCII maze — non-canonical 29-wide encoding with legend inconsistencies; used only as corroboration, not shipped.
- pacman.fandom.com wiki — fan-maintained; used only for the intermission corroboration where period guides agree.
- wuidigame.com / pacman.love / justtothepoint.com — SEO-grade summaries, not sourced to disassembly; discarded.

## Next steps (for the design ticket, not for research)

1. Decide collision fidelity (authentic same-tile + pass-through bug vs. tightened), speed quantization (pixel-pattern vs. float accumulation), and whether to reproduce the Pinky/Inky up-bug.
2. Decide map data provenance/license (transcribe from §1 vs. import GPL data).
3. Optional one-pass disassembly review of the $4E00 state machine to pin READY!/round-won/fruit-score frame counts if frame-exactness becomes a requirement.
