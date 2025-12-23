/**
 * Get the base path from environment variable
 * Returns empty string if not set, which means serving from root
 */
export function getBasePath(): string {
  const basePath = import.meta.env.PUBLIC_BASE_PATH || "";
  if (!basePath || basePath === "/") return "";

  // Ensure consistent format: starts with /, doesn't end with /
  const normalized = basePath.trim();
  if (normalized.startsWith("/")) {
    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  }
  return `/${normalized}`;
}

/**
 * Build an API URL with the base path prefix
 */
export function buildApiUrl(path: string): string {
  const basePath = getBasePath();
  // Empty path means just return the base path without trailing slash
  if (!path) {
    return basePath;
  }
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${normalizedPath}`;
}

/**
 * Build a WebSocket URL with the base path prefix
 */
export function buildWsUrl(path: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const basePath = getBasePath();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${protocol}//${window.location.host}${basePath}${normalizedPath}`;
}
