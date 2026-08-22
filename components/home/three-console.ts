import { setConsoleFunction } from "three"

// R3F v9 creates `THREE.Clock` in its store on every <Canvas> mount, and three
// r183+ warns that Clock is deprecated in favor of Timer. R3F 9.7.0 is the latest
// release and still uses Clock, so that warning is upstream noise with no upgrade
// path — filter just it and forward every other three log/warn/error untouched.
// This must run before any <Canvas> mounts, so it is imported (side-effect only)
// from home-canvas.tsx.
setConsoleFunction((type, message, ...params) => {
  if (type === "warn" && message.startsWith("THREE.Clock:")) return
  console[type](message, ...params)
})
