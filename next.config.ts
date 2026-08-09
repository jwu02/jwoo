import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack root to this project directory so Next.js does not
  // walk up to the parent repository root when multiple package-lock.json
  // files are present (e.g. in a git worktree).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
