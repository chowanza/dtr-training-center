import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained .next/standalone build (only the deps actually used, no full
  // node_modules) — what the production Dockerfile copies into the runtime image.
  output: "standalone",
};

export default nextConfig;
