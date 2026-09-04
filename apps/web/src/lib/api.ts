const API =
  import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export async function api<T = any>(
  path: string,
  options: RequestInit = {},
) {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data as T;
}

export const apiBase = API;

/* =========================================================
   TEMPLATE CACHE
   ========================================================= */

type CachedTemplates = {
  items: any[];
  timestamp: number;
};

let templatesCache: CachedTemplates | null = null;
let templatesRequest: Promise<any[]> | null = null;

// Keep templates cached for 5 minutes.
const TEMPLATE_CACHE_TIME = 5 * 60 * 1000;

/**
 * Loads templates quickly using an in-memory cache.
 *
 * The first request goes to the API.
 * Later requests within 5 minutes return instantly.
 */
export async function getTemplates(): Promise<any[]> {
  const now = Date.now();

  // Return cached templates immediately.
  if (
    templatesCache &&
    now - templatesCache.timestamp < TEMPLATE_CACHE_TIME
  ) {
    return templatesCache.items;
  }

  // Prevent multiple simultaneous requests.
  if (templatesRequest) {
    return templatesRequest;
  }

  templatesRequest = api<{ items: any[] }>("/templates")
    .then((response) => {
      const items = response.items || [];

      templatesCache = {
        items,
        timestamp: Date.now(),
      };

      return items;
    })
    .finally(() => {
      templatesRequest = null;
    });

  return templatesRequest;
}

/**
 * Start loading templates before the Templates page opens.
 */
export function preloadTemplates() {
  void getTemplates();
}

/**
 * Clear the template cache.
 * Useful after admin template changes.
 */
export function clearTemplatesCache() {
  templatesCache = null;
}