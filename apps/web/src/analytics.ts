type PostHogClient = {
  capture: (
    event: string,
    properties?: Record<string, string | number | boolean>,
  ) => void;
};

declare global {
  interface Window {
    posthog?: PostHogClient;
  }
}

export function captureEvent(
  event: string,
  properties: Record<string, string | number | boolean> = {},
) {
  window.posthog?.capture(event, properties);
}

export function capturePageview() {
  window.posthog?.capture("$pageview", {
    $current_url: window.location.href,
  });
}
