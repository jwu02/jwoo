# One application at a time

Status: accepted

The site is presented as an operating system: a Top Bar naming where you are, a Dock that is the navigation, and a single application view. Selecting an application from the Dock *replaces* the active one. There is no window manager, no second window, no overlapping, no draggable anything — and no traffic-light, resize or close controls, because controls that do nothing imply a feature that does not exist.

This is a deliberate departure from the macOS metaphor at its most literal. The common "macOS portfolio" is draggable, overlapping windows, and it is the obvious thing to build. We take the parts of the metaphor that help a visitor find things — persistent navigation, an obvious current location, symbols that are recognizable at a glance — and drop the part that gets in the way, which is managing a desktop of windows on a site with seven pages.

An application is a route (`/activity-telemetry`, `/resume`, …). The OS is the interface over ordinary web navigation, never a replacement for it: refresh, back and forward, bookmarks and shared links all still work and land you inside the right application.

Contact with the metaphor that is *not* taken: Home is the desktop rather than an application. It is the one view with no surface around it, because it is what the other applications appear over.

## Considered options

**Draggable, overlapping windows.** The recognizable version of the idea, and the one most existing macOS portfolios implement. Rejected: the site's content is seven fixed pages, so every window-management affordance is ceremony a visitor has to work through to read anything, and the metaphor then competes with the content instead of framing it.

**An OS-styled frame around the existing sidebar navigation.** Far smaller change: keep the shadcn sidebar, restyle it as a Dock. Rejected: it would have left two navigation surfaces disagreeing about what the site is — a sidebar that is a sidebar, inside a frame that claims to be an OS.

**Simulated macOS chrome — menu bar, Apple logo, system indicators.** Rejected: pretending to be Apple's actual interface invites comparison with the real thing, which a website loses. The frame should read as *an* operating system, not as *this* one.

## Consequences

The shell is a layout, not a window manager: one component wraps every page, and the active application is read from the route rather than held as state. That is what keeps back/forward honest — the browser already knows which application is active, so the shell must not keep a second, divergent answer.

The Dock and the Top Bar are two views of one list of applications (`components/os/apps.ts`). A route added to one without the other would be navigable but unnamed, so the list is the single place an application is declared.

Home being the desktop rather than an application is load-bearing in the layout, and the reason the scene fills its area unframed while every other application sits on a surface.
