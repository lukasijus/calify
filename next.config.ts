import type { NextConfig } from "next";

const basePath = process.env.CALIFY_BASE_PATH ?? "/calify";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath,
  // `basePath` is not applied to `fetch()` in client components, so expose it
  // for the API calls in weight-screen.tsx.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
