import type { NextConfig } from 'next';
const basePath = (process.env.CALIFY_BASE_PATH ?? '/calify').replace(/\/$/, '');
if (basePath && !/^\/[A-Za-z0-9/_-]+$/.test(basePath)) throw new Error('CALIFY_BASE_PATH must be an absolute URL path.');
const nextConfig: NextConfig = {
  output: 'standalone',
  basePath,
  env: { NEXT_PUBLIC_CALIFY_BASE_PATH: basePath },
};
export default nextConfig;
