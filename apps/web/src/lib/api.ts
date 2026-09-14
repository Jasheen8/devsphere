const API =
  import.meta.env.VITE_API_URL || "http://localhost:4000/api";

type ApiOptions = RequestInit & {
  skipLoader?: boolean;
};

let activeRequests = 0;

function notifyLoading() {
  window.dispatchEvent(
    new CustomEvent("devsphere-loading", {
      detail: {
        loading: activeRequests > 0,
      },
    }),
  );
}

export async function api<T = any>(
  path: string,
  options: ApiOptions = {},
) {
  const { skipLoader = false, ...requestOptions } = options;

  if (!skipLoader) {
    activeRequests += 1;
    notifyLoading();
  }

  try {
    const res = await fetch(`${API}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(requestOptions.headers || {}),
      },
      ...requestOptions,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data as T;
  } finally {
    if (!skipLoader) {
      activeRequests = Math.max(0, activeRequests - 1);
      notifyLoading();
    }
  }
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

const TEMPLATE_CACHE_TIME = 5 * 60 * 1000;

export async function getTemplates(): Promise<any[]> {
  const now = Date.now();

  if (
    templatesCache &&
    now - templatesCache.timestamp < TEMPLATE_CACHE_TIME
  ) {
    return templatesCache.items;
  }

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

export function preloadTemplates() {
  void getTemplates();
}

export function clearTemplatesCache() {
  templatesCache = null;
}