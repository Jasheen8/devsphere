const API =
  import.meta.env.VITE_API_URL || "http://localhost:4000/api";

if (typeof document !== "undefined") {
  try {
    const apiOrigin = new URL(API, window.location.origin).origin;
    const hasPreconnect = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="preconnect"]'),
    ).some((link) => link.href === apiOrigin);

    if (apiOrigin !== window.location.origin && !hasPreconnect) {
      const preconnect = document.createElement("link");
      preconnect.rel = "preconnect";
      preconnect.href = apiOrigin;
      preconnect.crossOrigin = "use-credentials";
      document.head.appendChild(preconnect);
    }
  } catch {
    // Keep the app usable when VITE_API_URL is malformed or unavailable.
  }
}

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
  const {
    skipLoader = false,
    ...requestOptions
  } = options;

  if (!skipLoader) {
    activeRequests += 1;
    notifyLoading();
  }

  try {
    const headers = new Headers(requestOptions.headers);
    if (
      typeof requestOptions.body === "string" &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(`${API}${path}`, {
      ...requestOptions,
      credentials: requestOptions.credentials ?? "include",
      headers,
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

type CachedUser = {
  user: any | null;
  expiresAt: number;
};

let currentUserCache: CachedUser | null = null;
let currentUserRequest: Promise<any | null> | null = null;
let currentUserGeneration = 0;

export async function getCurrentUser(forceRefresh = false) {
  if (forceRefresh) {
    currentUserGeneration += 1;
    currentUserCache = null;
    currentUserRequest = null;
  }

  if (currentUserCache && currentUserCache.expiresAt > Date.now()) {
    return currentUserCache.user;
  }

  if (currentUserRequest) return currentUserRequest;

  const generation = currentUserGeneration;
  const request = api<{ user?: any }>("/auth/me", { skipLoader: true })
    .then((response) => response.user ?? null)
    .catch(() => null)
    .then((user) => {
      if (generation === currentUserGeneration) {
        currentUserCache = {
          user,
          expiresAt: Date.now() + (user ? 60_000 : 10_000),
        };
      }
      return user;
    })
    .finally(() => {
      if (currentUserRequest === request) currentUserRequest = null;
    });

  currentUserRequest = request;
  return request;
}

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
const TEMPLATES_STORAGE_KEY = "devsphere:templates:v1";
const CATEGORIES_STORAGE_KEY = "devsphere:categories:v1";

function readStoredCatalog<T>(key: string): T[] | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const items = JSON.parse(raw);
    return Array.isArray(items) ? (items as T[]) : null;
  } catch {
    return null;
  }
}

function writeStoredCatalog<T>(key: string, items: T[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Continue without persistent caching when storage is unavailable or full.
  }
}

function notifyCatalogUpdate(eventName: string, items: any[]) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(eventName, { detail: items }));
  }
}

function requestTemplates() {
  if (templatesRequest) return templatesRequest;

  templatesRequest = api<{ items: any[] }>("/templates", {
    skipLoader: true,
  })
    .then((response) => {
      const items = response.items || [];
      templatesCache = { items, timestamp: Date.now() };
      writeStoredCatalog(TEMPLATES_STORAGE_KEY, items);
      notifyCatalogUpdate("devsphere:templates-updated", items);
      return items;
    })
    .finally(() => {
      templatesRequest = null;
    });

  return templatesRequest;
}

export async function getTemplates(): Promise<any[]> {
  const now = Date.now();

  if (
    templatesCache &&
    now - templatesCache.timestamp < TEMPLATE_CACHE_TIME
  ) {
    return templatesCache.items;
  }

  const staleItems = templatesCache?.items ?? readStoredCatalog<any>(TEMPLATES_STORAGE_KEY);
  if (staleItems) {
    if (!templatesCache) {
      templatesCache = { items: staleItems, timestamp: now - TEMPLATE_CACHE_TIME };
    }
    void requestTemplates().catch(() => undefined);
    return staleItems;
  }

  return requestTemplates();
}

export function preloadTemplates() {
  void getTemplates();
}

let categoriesCache: CachedTemplates | null = null;
let categoriesRequest: Promise<any[]> | null = null;

export async function getCategories(): Promise<any[]> {
  if (categoriesCache && Date.now() - categoriesCache.timestamp < TEMPLATE_CACHE_TIME) {
    return categoriesCache.items;
  }

  const staleItems = categoriesCache?.items ?? readStoredCatalog<any>(CATEGORIES_STORAGE_KEY);
  if (staleItems) {
    if (!categoriesCache) {
      categoriesCache = {
        items: staleItems,
        timestamp: Date.now() - TEMPLATE_CACHE_TIME,
      };
    }
    if (!categoriesRequest) {
      categoriesRequest = api<{ items: any[] }>("/categories", { skipLoader: true })
        .then((response) => {
          const items = response.items || [];
          categoriesCache = { items, timestamp: Date.now() };
          writeStoredCatalog(CATEGORIES_STORAGE_KEY, items);
          notifyCatalogUpdate("devsphere:categories-updated", items);
          return items;
        })
        .finally(() => {
          categoriesRequest = null;
        });
    }
    void categoriesRequest.catch(() => undefined);
    return staleItems;
  }

  if (categoriesRequest) return categoriesRequest;

  categoriesRequest = api<{ items: any[] }>("/categories", { skipLoader: true })
    .then((response) => {
      const items = response.items || [];
      categoriesCache = { items, timestamp: Date.now() };
      writeStoredCatalog(CATEGORIES_STORAGE_KEY, items);
      notifyCatalogUpdate("devsphere:categories-updated", items);
      return items;
    })
    .finally(() => {
      categoriesRequest = null;
    });

  return categoriesRequest;
}

const templateDetailsCache = new Map<string, { template: any; timestamp: number }>();
const templateDetailsRequests = new Map<string, Promise<any>>();

export async function getTemplate(id: string): Promise<any> {
  const cached = templateDetailsCache.get(id);
  if (cached && Date.now() - cached.timestamp < TEMPLATE_CACHE_TIME) {
    return cached.template;
  }

  const pending = templateDetailsRequests.get(id);
  if (pending) return pending;

  const request = api<{ template: any }>(`/templates/${encodeURIComponent(id)}`, {
    skipLoader: true,
  })
    .then((response) => {
      templateDetailsCache.set(id, {
        template: response.template,
        timestamp: Date.now(),
      });
      return response.template;
    })
    .finally(() => {
      templateDetailsRequests.delete(id);
    });

  templateDetailsRequests.set(id, request);
  return request;
}

export function preloadTemplate(id: string) {
  void getTemplate(id).catch(() => undefined);
}

export function clearTemplatesCache() {
  templatesCache = null;
  categoriesCache = null;
  templateDetailsCache.clear();
  try {
    window.localStorage.removeItem(TEMPLATES_STORAGE_KEY);
    window.localStorage.removeItem(CATEGORIES_STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}
