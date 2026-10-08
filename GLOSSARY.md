# Personal Website OS

The site presents itself as an operating system: a Dock for navigation, a desktop, and one application window at a time.

## Language

**App**:
One application of the site: a route the Dock can select, with a name and a glyph.
_Avoid_: page, screen

**App window**:
The glass area an application renders inside, with a titlebar naming it. Only one is ever open. Code and comments call it the application's *surface*.
_Avoid_: pane, card

**Desktop**:
The Home view. The wallpaper the app windows appear over, not an application among them.
_Avoid_: homepage, landing page

**Dock**:
The persistent launcher that selects the active app. The site's only navigation.
_Avoid_: taskbar, sidebar, menu bar

**Shell**:
The OS frame every view renders inside: the Dock plus the active view.

**Titlebar**:
The bar at the top of an app window that names the application it belongs to, and carries the Traffic lights at its left.
_Avoid_: Top Bar, header, page header

**Traffic lights**:
The three window controls at the left of the Titlebar, in macOS's image. Close and Minimize are both a departure to the Desktop — the one place a window here can go when it leaves, there being no window manager to minimize into. Full screen is the one control that manages the window itself.
_Avoid_: window buttons, dots (that is their look, not what they are)

**Full screen**:
The state the green Traffic light toggles: the Dock is hidden and the application's window takes the space the Dock held, everything else about the window unchanged. It belongs to the window: it dies with it, and any navigation or reload restores the Dock. The Desktop is never in it — the Desktop has no window, so nothing there could engage or leave the state.
_Avoid_: Zoom (that is the knowledge graph's camera), maximize, presentation mode
