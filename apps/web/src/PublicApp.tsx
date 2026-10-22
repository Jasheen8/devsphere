import React, { useEffect } from "react";
import { capturePageview } from "./analytics";
import PublicPage from "./PublicPage";

function publicSlug() {
  const segment = window.location.pathname.slice(3).split("/")[0];
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

type PublicAppProps = {
  initialPublicRequest?: { slug: string; promise: Promise<any> };
};

export default function PublicApp({ initialPublicRequest }: PublicAppProps) {
  useEffect(() => {
    capturePageview();
  }, []);

  return (
    <PublicPage slug={publicSlug()} initialPublicRequest={initialPublicRequest} />
  );
}
