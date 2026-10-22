import React, { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { TemplateRenderer } from "@memora/template-engine";
import { api } from "./lib/api";
import "./public.css";

type PublicPageProps = {
  slug: string;
  initialPublicRequest?: { slug: string; promise: Promise<any> };
};

export default function PublicPage({
  slug,
  initialPublicRequest,
}: PublicPageProps) {
  const [payload, setPayload] = useState<any>();
  const [unlock, setUnlock] = useState("");
  const [question, setQuestion] = useState("");
  const [gate, setGate] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setPayload(undefined);
    setQuestion("");

    const request =
      initialPublicRequest?.slug === slug
        ? initialPublicRequest.promise
        : api(`/public/${encodeURIComponent(slug)}`, {
            signal: controller.signal,
          });

    request
      .then((result) => {
        setPayload(result);
        setGate(
          result.accessRequired &&
            ["PIN", "PUZZLE", "LETTER", "GIFT"].includes(
              result.site.revealMethod,
            ),
        );

        if (result.site.seoTitle) {
          document.title = result.site.seoTitle;
        }

        if (result.site.seoDescription) {
          let meta = document.querySelector(
            "meta[name=description]",
          ) as HTMLMetaElement | null;

          if (!meta) {
            meta = document.createElement("meta");
            meta.name = "description";
            document.head.appendChild(meta);
          }

          meta.content = result.site.seoDescription;
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("PUBLIC WEBSITE LOAD FAILED:", error);
        setQuestion(error?.message || "Unable to load this website.");
        setGate(false);
      });

    return () => controller.abort();
  }, [slug, initialPublicRequest]);

  if (!payload) {
    return (
      <div className="reveal">
        <div className="reveal-box" aria-live="polite">
          <h2>
            {question ? "We couldn’t open your surprise" : "Loading your surprise…"}
          </h2>
          {question && <p>{question}</p>}
          {question && (
            <button
              className="btn btn-primary"
              style={{ marginTop: 14, background: "#fff", color: "#2b211e" }}
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  async function submit() {
    try {
      if (
        payload.site.revealMethod === "LETTER" ||
        payload.site.revealMethod === "GIFT"
      ) {
        setGate(false);
        return;
      }

      await api(`/public/${encodeURIComponent(slug)}/unlock`, {
        method: "POST",
        body: JSON.stringify(
          payload.site.revealMethod === "PIN"
            ? { pin: unlock }
            : { answer: unlock },
        ),
      });
      setGate(false);
    } catch (error: any) {
      setQuestion(error.message);
    }
  }

  if (gate) {
    return (
      <div className="reveal">
        <div className="reveal-box">
          <Heart fill="currentColor" size={30} />
          <h1>
            {payload.site.revealMethod === "LETTER"
              ? "Someone left a letter for you…"
              : payload.site.revealMethod === "GIFT"
                ? "A little gift is waiting…"
                : payload.site.revealMethod === "PUZZLE"
                  ? "One question stands between you and the surprise…"
                  : "A Special Memory Is Waiting"}
          </h1>
          {payload.site.revealMethod === "PUZZLE" && (
            <p>
              {payload.accessRule?.puzzleQuestion ||
                "Answer the question to unlock."}
            </p>
          )}
          {(payload.site.revealMethod === "PIN" ||
            payload.site.revealMethod === "PUZZLE") && (
            <input
              value={unlock}
              onChange={(event) => setUnlock(event.target.value)}
              placeholder={
                payload.site.revealMethod === "PIN"
                  ? "Secret PIN"
                  : "Your answer"
              }
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 12,
                border: "1px solid #6a5550",
                background: "transparent",
                color: "#fff",
              }}
            />
          )}
          <button
            className="btn btn-primary"
            style={{ marginTop: 14, background: "#fff", color: "#2b211e" }}
            onClick={submit}
          >
            {payload.site.revealMethod === "PIN"
              ? "Unlock ❤️"
              : "Open My Surprise ❤️"}
          </button>
          {question && <p style={{ color: "#ffb4a6" }}>{question}</p>}
        </div>
      </div>
    );
  }

  return (
    <TemplateRenderer
      template={payload.template}
      data={payload.data}
      customization={{
        ...(payload.customization || {}),
        publicUrl: `${window.location.origin}/r/${payload.site?.slug || slug}`,
      }}
    />
  );
}
