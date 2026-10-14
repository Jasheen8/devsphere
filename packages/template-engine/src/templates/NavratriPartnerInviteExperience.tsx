import React, { useEffect, useRef, useState } from "react";

const sourceRoot = "/templates/navratri-partner-invite/source";
const updateMessage = "devsphere-navratri-template-update";

function safeScriptJson(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function NavratriPartnerInviteExperience({
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
  const publicUrl = typeof theme?.publicUrl === "string" ? theme.publicUrl : "";
  const currentRemoveWatermark = useRef(removeWatermark);
  const [documentHtml, setDocumentHtml] = useState("");
  const [sourceError, setSourceError] = useState(false);

  currentData.current = data;
  currentRemoveWatermark.current = removeWatermark;

  useEffect(() => {
    let cancelled = false;

    fetch(`${sourceRoot}/index.html`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Could not load the Navratri Partner Invite source page.");
        }
        return response.text();
      })
      .then((html) => {
        if (cancelled) return;

        const injectedConfig = `<script>window.NAVRATRI_DATA=${safeScriptJson(currentData.current)};window.NAVRATRI_PUBLIC_URL=${safeScriptJson(publicUrl)};window.NAVRATRI_REMOVE_WATERMARK=${currentRemoveWatermark.current};</script>`;
        const liveHtml = html
          .replace("<script>", `${injectedConfig}<script>`)
          .replace(
            "</head>",
            '<base href="/templates/navratri-partner-invite/" /></head>',
          );

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
      {
        type: updateMessage,
        data,
        removeWatermark: currentRemoveWatermark.current,
      },
      window.location.origin,
    );
  }, [data, documentHtml, removeWatermark]);

  if (sourceError) {
    return <p role="alert">The Navratri Partner Invite could not be loaded.</p>;
  }

  return (
    <iframe
      ref={iframeRef}
      className="navratri-source-frame"
      srcDoc={documentHtml || undefined}
      title="Navratri Partner Invite experience"
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
