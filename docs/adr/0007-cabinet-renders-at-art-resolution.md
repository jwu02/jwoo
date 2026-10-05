# The cabinet renders at art resolution

Status: accepted

The Tetris cabinet is drawn on a canvas whose backing store is its fixed pixel-art design size — 108×208, the well and its frame alone, one unit per art pixel — and scaled up by CSS with `image-rendering: pixelated`, never devicePixelRatio-aware rendering. DPR-aware rendering would smooth what the skin deliberately makes blocky and complicate the renderer's coordinates for nothing, since the skin is solid rects.

The scale is whole-numbered on large surfaces, where an art pixel is then a whole number of device pixels on 1x/2x/3x displays — that is the blocky look. On small surfaces — the box's smaller dimension under 768 CSS px, the OS shell's md breakpoint, where the application surface runs edge to edge — the scale goes fractional and fills the binding dimension, and below the art's own size it always has. The whole-number floor would otherwise pin a phone to a fraction of its screen: at the old 260×248 cabinet, a 390×844 viewport floored a raw scale of 1.5 down to 1 and drew the game a third of the screen tall. Fractional scaling renders some art pixels a device pixel wider than others, which `pixelated` keeps crisp-but-uneven — the cost of filling a phone, and smaller than the letterbox it replaces.

## Considered options

**Rendering at device resolution with art coordinates snapped to device pixels.** Rejected: smooths the pixel edges that are the point of the skin, and the resize/snap bookkeeping buys nothing while the skin is solid rects.

**Filling both dimensions — cover-cropping or stretching.** Rejected: cover would scale past the binding dimension and crop well columns off the phone's narrower aspect; stretch distorts the pixel grid. With the well-only art (~1:1.9 against a phone's ~1:2.2), contain-fill takes the full width and all but a sliver of the height.
