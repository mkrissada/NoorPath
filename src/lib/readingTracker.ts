import { useEffect, useRef } from 'react';

/**
 * Tracks continuous dwell time while the page/tab is visible (`!document.hidden`).
 * Fires `onComplete` once after `dwellMs` elapses for a given `key`.
 */
export function usePageDwellTracker(
  enabled: boolean,
  key: string | null,
  dwellMs: number,
  onComplete: () => void
): void {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!enabled || !key) return;

    let elapsed = 0;
    let startedAt: number | null = document.hidden ? null : Date.now();
    let timerId: number | null = null;
    let fired = false;

    const clearTimer = () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
    };

    const schedule = () => {
      clearTimer();
      if (fired || document.hidden) return;
      const remaining = Math.max(0, dwellMs - elapsed);
      startedAt = Date.now();
      timerId = window.setTimeout(() => {
        fired = true;
        onCompleteRef.current();
      }, remaining);
    };

    const handleVisibility = () => {
      if (fired) return;
      if (document.hidden) {
        if (startedAt !== null) {
          elapsed += Date.now() - startedAt;
          startedAt = null;
        }
        clearTimer();
      } else {
        schedule();
      }
    };

    schedule();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimer();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, key, dwellMs]);
}

/**
 * Uses a single IntersectionObserver across registered ayah DOM nodes (`data-ayah-num`)
 * and marks ayahs read after remaining ≥60% visible for `dwellMs` (default 3000ms) while tab is active.
 */
export function useAyahViewportTracker(
  enabled: boolean,
  surahNumber: number,
  elementsMapRef: React.MutableRefObject<Map<number, HTMLElement>>,
  dataReadyKey: string,
  onMarkRead: (keys: string[]) => void,
  dwellMs = 3000
): void {
  const onMarkReadRef = useRef(onMarkRead);
  onMarkReadRef.current = onMarkRead;

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return;

    const timers = new Map<number, number>();
    const pendingBatch = new Set<string>();
    let flushTimer: number | null = null;

    const flush = () => {
      flushTimer = null;
      if (pendingBatch.size === 0) return;
      const keys = Array.from(pendingBatch);
      pendingBatch.clear();
      onMarkReadRef.current(keys);
    };

    const queueKey = (key: string) => {
      pendingBatch.add(key);
      if (flushTimer === null) {
        flushTimer = window.setTimeout(flush, 600);
      }
    };

    const clearAyahTimer = (ayahNum: number) => {
      const tid = timers.get(ayahNum);
      if (tid !== undefined) {
        window.clearTimeout(tid);
        timers.delete(ayahNum);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (document.hidden) return;
        for (const entry of entries) {
          const ayahNum = Number((entry.target as HTMLElement).dataset.ayahNum);
          if (!Number.isFinite(ayahNum) || ayahNum <= 0) continue;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            if (!timers.has(ayahNum)) {
              const tid = window.setTimeout(() => {
                timers.delete(ayahNum);
                if (!document.hidden) {
                  queueKey(`${surahNumber}:${ayahNum}`);
                }
              }, dwellMs);
              timers.set(ayahNum, tid);
            }
          } else {
            clearAyahTimer(ayahNum);
          }
        }
      },
      { threshold: [0.55] }
    );

    elementsMapRef.current.forEach((el, ayahNum) => {
      el.dataset.ayahNum = String(ayahNum);
      observer.observe(el);
    });

    const handleVisibility = () => {
      if (document.hidden) {
        timers.forEach((tid) => window.clearTimeout(tid));
        timers.clear();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      timers.forEach((tid) => window.clearTimeout(tid));
      timers.clear();
      if (flushTimer !== null) {
        window.clearTimeout(flushTimer);
        flush();
      }
    };
  }, [enabled, surahNumber, elementsMapRef, dataReadyKey, dwellMs]);
}
