import React, { useEffect, useRef, useState } from "react";

const sourceRoot = "/templates/anniversary-bloom/source";
const updateMessage = "devsphere-bloom-template-update";

function safeScriptJson(value: Record<string, unknown>) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function BloomAnniversaryExperience({
  data,
  theme,
  isPreview = false,
}: {
  data: Record<string, unknown>;
  props?: Record<string, unknown>;
  theme?: Record<string, unknown>;
  isPreview?: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const currentData = useRef(data);
  const removeWatermark = isPreview
    ? theme?.removeWatermark === true
    : theme?.removeWatermarkPaid === true;
  const currentRemoveWatermark = useRef(removeWatermark);
  const [documentHtml, setDocumentHtml] = useState("");
  const [sourceError, setSourceError] = useState(false);

  currentData.current = data;
  currentRemoveWatermark.current = removeWatermark;

  useEffect(() => {
    let cancelled = false;

    fetch(`${sourceRoot}/index.html`)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load the Bloom Anniversary source page.");
        return response.text();
      })
      .then((html) => {
        if (cancelled) return;

        const injectedConfig = `<script>window.BLOOM_DATA=${safeScriptJson(currentData.current)};window.BLOOM_REMOVE_WATERMARK=${currentRemoveWatermark.current};</script>`;
        const liveHtml = html
          .replace('href="style.css"', `href="${sourceRoot}/style.css"`)
          .replace(
            '<script src="script.js"></script>',
            `${injectedConfig}<script src="${sourceRoot}/script.js"></script>`,
          )
          .replace("</head>", '<base href="/templates/anniversary-bloom/" /></head>');

        setDocumentHtml(liveHtml);
      })
      .catch(() => {
        if (!cancelled) setSourceError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !documentHtml) return;
    iframe.contentWindow?.postMessage(
      { type: updateMessage, data, removeWatermark: currentRemoveWatermark.current },
      window.location.origin,
    );
  }, [data, documentHtml, removeWatermark]);

  if (sourceError) {
    return <p role="alert">The Bloom Anniversary experience could not be loaded.</p>;
  }

  return (
    <iframe
      ref={iframeRef}
      className="bloom-source-frame"
      srcDoc={documentHtml || undefined}
      title="Bloom Anniversary experience"
      loading="eager"
      allow="autoplay; fullscreen"
      onLoad={() =>
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: updateMessage,
            data: currentData.current,
            removeWatermark: currentRemoveWatermark.current,
          },
          window.location.origin,
        )
      }
      style={{
        display: "block",
        width: "100%",
        height: isPreview ? "calc(100vh - 56px)" : "100vh",
        minHeight: isPreview ? "calc(100vh - 56px)" : "100vh",
        border: 0,
      }}
    />
  );
}
