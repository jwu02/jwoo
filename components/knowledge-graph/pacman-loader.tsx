// What the page shows while it has no graph to draw — either because the
// snapshot is still on its way or because the snapshot has arrived and the
// layout has not yet been run to rest. The two are the same wait to the viewer,
// so they are the same thing on screen.
//
// The label is inside rather than a prop: there is one thing this loader ever
// says, and it is the accessible name — the caller places it, it does not
// reword it. `role="status"` is what makes the wait announce itself; the pacman
// itself is decoration and says nothing.
export function PacmanLoader() {
  return (
    <div role="status" className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        {/* `text-` and not `bg-`: the pie is drawn by the class's conic
            gradient in `currentColor`, so the colour has to arrive as the
            element's colour rather than as a background the utility sets.
            Claude orange is the graph's own accent — the colour a node takes
            when it is hovered — so the wait is drawn in the same ink as the
            thing being waited for. */}
        <div className="kg-pacman size-5 text-[var(--claude-orange)]" />
        <div className="flex gap-1.5">
          {[0, 1, 2].map((dot) => (
            <div
              key={dot}
              className="kg-pacman-dot size-1.5 rounded-full bg-[var(--claude-orange)]"
              // A third of the cycle apart each, so the three read as eaten in
              // turn rather than blinking together.
              style={{ animationDelay: `${dot * 0.15}s` }}
            />
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Loading knowledge graph…</p>
    </div>
  );
}
