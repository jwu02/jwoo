# The OS has two appearances

Status: accepted

The site was dark only: `<html class="dark">` was fixed in the root layout, and the project instructions said so outright — an OS has one appearance, and the glass every pane is made of only reads as glass over a dark wallpaper. That left a visitor who finds dark interfaces hard to read with nothing to do about it, and ignored the preference their own operating system already states.

## Decision

The OS is drawn in one of two appearances, light or dark, and the visitor chooses between them in Settings. A visit that has never chosen follows `prefers-color-scheme`, so the site does not fight the system the visitor just arrived from; a choice is remembered in `os.appearance` and is what they get from then on. The choice can be cleared, which returns them to where a first visit finds them.

An appearance is a class on `<html>` and nothing more: `:root` holds the light tokens every application already draws with, `.dark` overrides them. The material the OS is made of — the glass the Dock and a window's surface are cut from, the wallpaper's glow, the tint the Dock marks the active application with — is declared once per appearance as tokens in `app/globals.css`, so neither appearance is a second copy of the other.

The document is server-rendered dark — the OS's own first appearance — and an inline script in its head corrects the class from storage before the browser's first paint, so a visitor whose appearance is light never sees a dark flash. The store that owns the choice (`components/os/appearance.ts`) is the one place that reads and writes the key and the one place that puts the class on; the Shell only keeps it there, so nothing depends on hydration to get the appearance right and React never has to be the source of truth for it.

An application's world does not follow it, except that the Desktop's scene is its own dark world either way: the arcade cabinet and the 3D scenes keep their own look in both appearances, because they are screens rather than chrome — a screen does not turn into a pale page because the room around it did. The printed resume is likewise unaffected: its sheet forces print's light tokens itself.

## Considered options

**Reading the choice from a cookie in the root layout, so the server renders the right class.** Rejected: reading a cookie in the root layout opts the entire app out of static prerendering, for a class that an inline script can put on before the first paint anyway. The cookie could be read only by the inline script, but then it is just `localStorage` with more ceremony.

**A theming dependency (`next-themes`).** Rejected: it is a dependency to set one class on `<html>`, and the store's fallbacks — storage that throws, a write that is refused, an unrecognised value — are the same ones this repo already writes by hand for the Dock's order.

**A separate appearance per application.** Rejected: an operating system has one appearance. Per-application schemes would make the Dock, two windows and the wallpaper disagree, which is the opposite of what the frame is for.

## Consequences

`CLAUDE.md`'s "dark only" instruction was the convention this reverses and is corrected in the same change.

Two colour ramps bake in a direction that was only correct in the dark appearance — the keyboard heatmap's ramp and the AI-usage sibling shades — and are made appearance-aware separately.

The store is the single owner of the key, so anything that later needs to list or delete it (Settings' Data section) asks the store rather than touching storage.
