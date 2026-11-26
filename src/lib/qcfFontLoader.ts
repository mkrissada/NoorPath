const BASE = import.meta.env.BASE_URL || './';

const loadedPages = new Set<number>();
const inFlightLoads = new Map<number, Promise<string>>();

export function getQcfFontFamily(page: number): string {
  return `NoorPathQCF_P${page}`;
}

export function getQcfFontUrl(page: number): string {
  const cleanBase = BASE.endsWith('/') ? BASE : `${BASE}/`;
  return `${cleanBase}fonts/qcf-v2/p${page}.woff2`;
}

export function isQcfPageFontLoaded(page: number): boolean {
  return loadedPages.has(page);
}

export async function ensureQcfPageFont(page: number): Promise<string> {
  const clamped = Math.max(1, Math.min(604, Math.floor(page)));
  const family = getQcfFontFamily(clamped);

  if (loadedPages.has(clamped)) {
    return family;
  }

  const existing = inFlightLoads.get(clamped);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      if (typeof FontFace !== 'undefined' && typeof document !== 'undefined') {
        const url = getQcfFontUrl(clamped);
        const face = new FontFace(family, `url("${url}") format("woff2")`, {
          display: 'block',
        });
        const loaded = await face.load();
        document.fonts.add(loaded);
      }
      loadedPages.add(clamped);
      return family;
    } finally {
      inFlightLoads.delete(clamped);
    }
  })();

  inFlightLoads.set(clamped, promise);
  return promise;
}

/**
 * Fetches all 604 QCF V2 woff2 files in smooth batches so the Service Worker
 * stores them in persistent offline CacheStorage on iPad without flooding document.fonts RAM.
 */
export async function prefetchAllQcfFontFiles(
  onBatchProgress?: (completedFonts: number, lastPage: number) => void
): Promise<void> {
  const BATCH_SIZE = 16;
  let done = 0;

  for (let start = 1; start <= 604; start += BATCH_SIZE) {
    const pages: number[] = [];
    for (let p = start; p < start + BATCH_SIZE && p <= 604; p++) {
      pages.push(p);
    }
    await Promise.all(
      pages.map(async (p) => {
        const res = await fetch(getQcfFontUrl(p));
        if (!res.ok) {
          throw new Error(`โหลดฟอนต์มุศฮัฟหน้า ${p} ไม่สำเร็จ (${res.status})`);
        }
        // Consume body so browser/Workbox commits the response to CacheStorage
        await res.arrayBuffer();
      })
    );
    done += pages.length;
    onBatchProgress?.(done, pages[pages.length - 1]);
  }
}
