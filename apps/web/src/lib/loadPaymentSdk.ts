const pendingLoads = new Map<string, Promise<void>>();

export function loadPaymentSdk(
  key: string,
  src: string,
  isReady: () => boolean,
  unavailableMessage: string,
  timeoutMs = 20_000,
) {
  if (isReady()) return Promise.resolve();

  const pending = pendingLoads.get(key);
  if (pending) return pending;

  let script = document.querySelector(
    `script[data-payment-sdk="${key}"]`,
  ) as HTMLScriptElement | null;

  const expectedSrc = new URL(src, document.baseURI).href;
  if (
    script &&
    (script.src !== expectedSrc ||
      script.dataset.loadState === "failed" ||
      script.dataset.loadState === "loaded")
  ) {
    script.remove();
    script = null;
  }

  const shouldAppend = !script;
  script ??= document.createElement("script");
  if (shouldAppend) {
    script.async = true;
    script.dataset.paymentSdk = key;
    script.dataset.loadState = "loading";
    script.src = src;
  }

  const loadPromise = new Promise<void>((resolve, reject) => {
    let settled = false;
    let timeout = 0;

    const cleanup = () => {
      window.clearTimeout(timeout);
      script?.removeEventListener("load", onLoad);
      script?.removeEventListener("error", onError);
    };

    function fail(error: Error) {
      if (settled) return;
      settled = true;
      cleanup();
      if (script) {
        script.dataset.loadState = "failed";
        script.remove();
      }
      reject(error);
    }

    function onLoad() {
      if (!isReady()) {
        fail(new Error(`${unavailableMessage} SDK did not initialize.`));
        return;
      }

      if (settled) return;
      settled = true;
      cleanup();
      if (script) script.dataset.loadState = "loaded";
      resolve();
    }

    function onError() {
      fail(new Error(`${unavailableMessage} Check your connection and retry.`));
    }

    script?.addEventListener("load", onLoad, { once: true });
    script?.addEventListener("error", onError, { once: true });
    timeout = window.setTimeout(() => {
      fail(new Error(`${unavailableMessage} Loading timed out.`));
    }, timeoutMs);

    if (shouldAppend) {
      document.body.appendChild(script!);
    } else if (["loaded", "complete"].includes(
      (script as HTMLScriptElement & { readyState?: string }).readyState || "",
    )) {
      onLoad();
    }
  });

  pendingLoads.set(key, loadPromise);

  return loadPromise.finally(() => {
    if (pendingLoads.get(key) === loadPromise) {
      pendingLoads.delete(key);
    }
  });
}
