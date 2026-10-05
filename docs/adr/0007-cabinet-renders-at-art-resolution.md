# The cabinet renders at art resolution

Status: accepted

The Tetris cabinet is drawn on a canvas whose backing store is its fixed pixel-art design size — 260×248, one unit per art pixel — and scaled up by CSS with integer factors and `image-rendering: pixelated`, never devicePixelRatio-aware rendering. Integer scale keeps every art pixel a whole number of device pixels on 1x/2x/3x displays, which is the blocky look the arcade skin is; DPR-aware rendering would smooth what the skin deliberately makes blocky and complicate the renderer's coordinates for nothing, since the skin is solid rects. Below the scale where the cabinet no longer fits (viewports under 260×248 CSS px), the scale goes fractional rather than clipping or scrolling.

## Considered options

**Rendering at device resolution with art coordinates snapped to device pixels.** Rejected: smooths the pixel edges that are the point of the skin, and the resize/snap bookkeeping buys nothing while the skin is solid rects.
