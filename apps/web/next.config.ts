import path from "node:path";
import type { NextConfig } from "next";

// The monorepo root, so Next.js traces workspace packages into the standalone output.
const repoRoot = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  // Self-contained server (.next/standalone) for the Docker image used on ECS / EKS.
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  // Opening the dev server through Traefik (http://shop.localhost) is a cross-origin dev request.
  allowedDevOrigins: ["shop.localhost"],
  turbopack: {
    root: repoRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
