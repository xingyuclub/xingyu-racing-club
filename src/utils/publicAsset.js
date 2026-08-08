const publicAssetPattern = /^\/(images|audio|videos)\//;

export function resolvePublicAssetPath(path, base = import.meta.env.BASE_URL || '/') {
  if (typeof path !== 'string' || !publicAssetPattern.test(path) || base === '/') return path;
  return `${base.replace(/\/$/, '')}${path}`;
}

export function resolvePublicAssetPaths(value, base = import.meta.env.BASE_URL || '/') {
  if (typeof value === 'string') return resolvePublicAssetPath(value, base);
  if (Array.isArray(value)) return value.map((item) => resolvePublicAssetPaths(item, base));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, resolvePublicAssetPaths(item, base)]),
  );
}
