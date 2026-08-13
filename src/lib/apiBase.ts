/**
 * Base URL for the Express API (Render in production).
 * Empty in local dev so Vite can proxy `/api` → localhost:4000.
 *
 * Set on Vercel: VITE_API_BASE_URL=https://YOUR-SERVICE.onrender.com
 */
const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';

export const API_BASE_URL = raw.replace(/\/$/, '');

/** Build an absolute or relative API path, e.g. apiUrl('/api/v1/subscription/me') */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}
