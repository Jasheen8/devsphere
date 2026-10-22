import React from "react";
import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("App root element not found");
}

const isPublicPage = window.location.pathname.startsWith("/r/");
const publicApiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
let publicRequest: { slug: string; promise: Promise<any> } | undefined;

if (isPublicPage) {
  const rawSlug = window.location.pathname.slice(3).split("/")[0];
  let slug = rawSlug;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    // Keep the raw segment if the URL contains malformed escaping.
  }

  const promise = fetch(`${publicApiUrl}/public/${encodeURIComponent(slug)}`, {
    credentials: "include",
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Unable to load this website.");
    }
    return data;
  });

  // Mark the promise handled while the public code chunk downloads; the page
  // still receives the original promise and displays any request error.
  void promise.catch(() => {});
  publicRequest = { slug, promise };
}

if (isPublicPage) {
  rootElement.innerHTML =
    '<div style="min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(145deg,#750505,#620808);color:#fffbeb;text-align:center;font:600 1rem Manrope,system-ui,sans-serif">Loading your surprise…</div>';
}

try {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    const apiOrigin = new URL(apiUrl, window.location.origin).origin;
    const alreadyConnected = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="preconnect"]'),
    ).some((link) => link.href === apiOrigin);

    if (apiOrigin !== window.location.origin && !alreadyConnected) {
      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = apiOrigin;
      link.crossOrigin = "use-credentials";
      document.head.appendChild(link);
    }
  }
} catch {
  // The API client will still attempt the configured endpoint if preconnect fails.
}

const root = createRoot(rootElement);
const application = isPublicPage
  ? import("./PublicApp")
  : import("./PlatformApp");

void application
  .then(({ default: App }) => {
    if (isPublicPage) {
      const PublicApp = App as React.ComponentType<{
        initialPublicRequest?: { slug: string; promise: Promise<any> };
      }>;
      root.render(<PublicApp initialPublicRequest={publicRequest} />);
      return;
    }

    const PlatformApp = App as React.ComponentType;
    root.render(<PlatformApp />);
  })
  .catch((error) => {
    console.error("DEVSPHERE APP LOAD FAILED:", error);
    root.render(
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#620808",
          color: "#fffbeb",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        We couldn’t open this page. Refresh to try again.
      </div>,
    );
  });
