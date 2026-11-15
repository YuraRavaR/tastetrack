import { useCallback, useEffect, useRef, useState } from "react";
import type { Episode, SeriesProgress } from "../../shared/progress";
import * as api from "../api";

function same(a: SeriesProgress | null, b: SeriesProgress | null): boolean {
  return a === b || (a !== null && b !== null && a.season === b.season && a.episode === b.episode);
}

// A series' Progress as the User last set it, shown at once and saved behind it. `change` shows
// the new Progress and saves it, at once or once the User has stopped changing it for `after`
// milliseconds, so a run of taps costs one write (ADR-0006). The Progress is sent whole, and only
// when it differs from what is saved, so a repeated change sends nothing. A save that fails puts
// back the Progress last saved and calls `onFailed`, unless the User has left: a series they
// stopped or finished in that moment has no Progress to save. `markWatched` is the check: it sets the
// Progress to an episode at once, unless a save is on its way, when a second tap would skip an
// episode. `saved` is read once: after that the Progress shown is the User's own.
export function useSeriesProgress(
  mediaItemId: number,
  saved: SeriesProgress | null,
  onFailed: () => void,
) {
  const [progress, setProgress] = useState(saved);
  const state = useRef({
    saved,
    latest: saved,
    sending: false,
    left: false,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
  });
  const failed = useRef(onFailed);
  failed.current = onFailed;

  const send = useCallback(async () => {
    const current = state.current;
    clearTimeout(current.timer);
    current.timer = undefined;
    // The save on its way sends whatever is latest once it ends.
    if (current.sending) return;
    current.sending = true;
    while (!same(current.latest, current.saved)) {
      const sent = current.latest;
      if (await api.changeProgress(mediaItemId, sent)) {
        current.saved = sent;
        continue;
      }
      current.latest = current.saved;
      if (current.left) break;
      setProgress(current.saved);
      failed.current();
    }
    current.sending = false;
  }, [mediaItemId]);

  const change = useCallback(
    (next: SeriesProgress | null, after = 0) => {
      const current = state.current;
      current.latest = next;
      setProgress(next);
      clearTimeout(current.timer);
      if (after > 0) current.timer = setTimeout(send, after);
      else void send();
    },
    [send],
  );

  // A change still waiting when the User leaves is saved then.
  useEffect(() => {
    const current = state.current;
    current.left = false;
    return () => {
      current.left = true;
      if (current.timer !== undefined) void send();
    };
  }, [send]);

  const markWatched = useCallback(
    ({ season, episode }: Episode) => {
      if (!state.current.sending) change({ mediaType: "series", season, episode });
    },
    [change],
  );

  return { progress, change, markWatched };
}
