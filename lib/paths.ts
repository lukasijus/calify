export const basePath = process.env.NEXT_PUBLIC_CALIFY_BASE_PATH ?? '/calify';
export const asset = (path: string) => `${basePath}${path}`;
export const localKey = (name: string) => `calify:${basePath || '/'}:v1:${name}`;
