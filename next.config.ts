import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // d3 ships ESM-only source in node_modules; transpile it and all of its ESM
  // transitive deps so Jest's next/jest transform can run them in tests.
  // next/jest matches transpilePackages entries as exact package directory
  // names, so every d3-* subpackage must be listed explicitly.
  // "three" is included because its examples (three/addons/*, e.g. the
  // OrbitControls home-orbit-controls.tsx builds from) are ESM-only too.
  transpilePackages: [
    "three",
    "d3",
    "d3-array",
    "d3-axis",
    "d3-brush",
    "d3-chord",
    "d3-color",
    "d3-contour",
    "d3-delaunay",
    "d3-dispatch",
    "d3-drag",
    "d3-dsv",
    "d3-ease",
    "d3-fetch",
    "d3-force",
    "d3-format",
    "d3-geo",
    "d3-hierarchy",
    "d3-interpolate",
    "d3-path",
    "d3-polygon",
    "d3-quadtree",
    "d3-random",
    "d3-scale",
    "d3-scale-chromatic",
    "d3-selection",
    "d3-shape",
    "d3-time",
    "d3-time-format",
    "d3-timer",
    "d3-transition",
    "d3-zoom",
    "delaunator",
    "internmap",
    "robust-predicates",
  ],
  // Allow LAN devices (e.g. a phone on the same Wi-Fi) to hit dev-only
  // resources like /_next/webpack-hmr. Patterns are matched per DNS label by
  // Next's own matcher, which rejects a bare "*" — a wildcard must span
  // multiple segments, so "*.*" alone would only cover 2-label hosts.
  allowedDevOrigins: ["192.168.*.*"],
  // Pin the Turbopack root to this project directory so Next.js does not
  // walk up to the parent repository root when multiple package-lock.json
  // files are present (e.g. in a git worktree).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
