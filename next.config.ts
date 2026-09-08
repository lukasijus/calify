import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: process.env.CALIFY_BASE_PATH ?? "/calify",
};

export default nextConfig;
