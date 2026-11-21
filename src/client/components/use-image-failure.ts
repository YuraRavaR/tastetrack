import { useState } from "react";

// An image's URL while it may still load, and null once it failed to, with the handler its `<img>`
// reports a failure to: an album's cover is linked whether or not the Cover Art Archive has one
// (ADR-0013). Another URL is tried afresh.
export function useImageFailure(url: string | null): [string | null, () => void] {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return [url === failedUrl ? null : url, () => setFailedUrl(url)];
}
