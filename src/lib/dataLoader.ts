import type {
  AthkarDataset,
  HadeethEncIndexItem,
  HadithItem,
  JuzInfo,
  MushafPageInfo,
  QcfPageData,
  ReciterConfig,
  SheikhManifest,
  SurahMeta,
  SurahPayload,
} from '../types/models.ts';
import { prefetchAllQcfFontFiles } from './qcfFontLoader.ts';

const BASE = import.meta.env.BASE_URL || './';

const surahCache = new Map<number, SurahPayload>();
let surahsIndexCache: SurahMeta[] | null = null;
let mushafPagesCache: MushafPageInfo[] | null = null;
let mushafQcfPagesCache: QcfPageData[] | null = null;
let juzIndexCache: JuzInfo[] | null = null;
let recitersCache: ReciterConfig[] | null = null;
let sheikhManifestCache: SheikhManifest | null = null;
let nawawiCache: HadithItem[] | null = null;
let hadeethEncIndexCache: HadeethEncIndexItem[] | null = null;
let hadeethEncFullCache: HadithItem[] | null = null;
let athkarCache: AthkarDataset | null = null;

function dataUrl(relativePath: string): string {
  const cleanBase = BASE.endsWith('/') ? BASE : `${BASE}/`;
  const cleanRel = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  return `${cleanBase}${cleanRel}`;
}

async function fetchJson<T>(relativePath: string): Promise<T> {
  const res = await fetch(dataUrl(relativePath));
  if (!res.ok) {
    throw new Error(`โหลดข้อมูลไม่สำเร็จ (${res.status}): ${relativePath}`);
  }
  return (await res.json()) as T;
}

export async function getSurahsIndex(): Promise<SurahMeta[]> {
  if (surahsIndexCache) return surahsIndexCache;
  surahsIndexCache = await fetchJson<SurahMeta[]>('data/surahs-index.json');
  return surahsIndexCache;
}

export async function getMushafPages(): Promise<MushafPageInfo[]> {
  if (mushafPagesCache) return mushafPagesCache;
  mushafPagesCache = await fetchJson<MushafPageInfo[]>('data/mushaf-pages.json');
  return mushafPagesCache;
}

export async function getMushafQcfPages(): Promise<QcfPageData[]> {
  if (mushafQcfPagesCache) return mushafQcfPagesCache;
  mushafQcfPagesCache = await fetchJson<QcfPageData[]>('data/mushaf-qcf-v2.json');
  return mushafQcfPagesCache;
}

export async function getJuzIndex(): Promise<JuzInfo[]> {
  if (juzIndexCache) return juzIndexCache;
  juzIndexCache = await fetchJson<JuzInfo[]>('data/juz-index.json');
  return juzIndexCache;
}

export async function getSurah(surahNumber: number): Promise<SurahPayload> {
  const existing = surahCache.get(surahNumber);
  if (existing) return existing;
  const payload = await fetchJson<SurahPayload>(`data/quran/surah-${surahNumber}.json`);
  surahCache.set(surahNumber, payload);
  return payload;
}

export async function getPageSurahPayloads(
  pageInfo: MushafPageInfo
): Promise<Map<number, SurahPayload>> {
  const uniqueSurahs = Array.from(new Set(pageInfo.surahs));
  const payloads = await Promise.all(uniqueSurahs.map((s) => getSurah(s)));
  const map = new Map<number, SurahPayload>();
  for (const p of payloads) {
    map.set(p.number, p);
  }
  return map;
}

export async function getAudioCatalog(): Promise<{
  reciters: ReciterConfig[];
  sheikhManifest: SheikhManifest;
}> {
  const [recitersResp, sheikh] = await Promise.all([
    recitersCache
      ? Promise.resolve({ reciters: recitersCache })
      : fetchJson<{ reciters: ReciterConfig[] }>('data/audio/reciters.json'),
    sheikhManifestCache
      ? Promise.resolve(sheikhManifestCache)
      : fetchJson<SheikhManifest>('data/audio/sheikh-abdallah-humeid.json'),
  ]);
  recitersCache = recitersResp.reciters;
  sheikhManifestCache = sheikh;
  return { reciters: recitersCache, sheikhManifest: sheikhManifestCache };
}

export async function getNawawi40(): Promise<HadithItem[]> {
  if (nawawiCache) return nawawiCache;
  nawawiCache = await fetchJson<HadithItem[]>('data/hadith/nawawi40.json');
  return nawawiCache;
}

export async function getHadeethEncIndex(): Promise<HadeethEncIndexItem[]> {
  if (hadeethEncIndexCache) return hadeethEncIndexCache;
  hadeethEncIndexCache = await fetchJson<HadeethEncIndexItem[]>('data/hadith/hadeethenc-index.json');
  return hadeethEncIndexCache;
}

export async function getHadeethEncFull(): Promise<HadithItem[]> {
  if (hadeethEncFullCache) return hadeethEncFullCache;
  hadeethEncFullCache = await fetchJson<HadithItem[]>('data/hadith/hadeethenc-full.json');
  return hadeethEncFullCache;
}

export async function getAthkarDataset(): Promise<AthkarDataset> {
  if (athkarCache) return athkarCache;
  athkarCache = await fetchJson<AthkarDataset>('data/athkar.json');
  return athkarCache;
}

export async function prefetchAllOfflineData(
  onProgress?: (completed: number, total: number, label: string) => void
): Promise<void> {
  const coreJobs: Array<{ label: string; run: () => Promise<unknown> }> = [
    { label: 'สารบัญซูเราะฮ์', run: () => getSurahsIndex() },
    { label: 'ดัชนีหน้ามุศฮัฟ (604 หน้า)', run: () => getMushafPages() },
    { label: 'โครงสร้างบรรทัดมุศฮัฟ QCF V2 (604 หน้า)', run: () => getMushafQcfPages() },
    { label: 'ดัชนีญุซอ์ (30 ญุซอ์)', run: () => getJuzIndex() },
    { label: 'ข้อมูลเสียงอ่าน', run: () => getAudioCatalog() },
    { label: '40 ฮะดีษ นะวาวีย์', run: () => getNawawi40() },
    { label: 'สารานุกรมฮะดีษไทย (846 บท)', run: () => getHadeethEncFull() },
    { label: 'อัซการประจำวัน (ฮิศนุลมุสลิม)', run: () => getAthkarDataset() },
  ];

  const total = coreJobs.length + 114 + 604;
  let completed = 0;

  for (const job of coreJobs) {
    await job.run();
    completed++;
    onProgress?.(completed, total, job.label);
  }

  // Fetch 114 surahs in batches of 8 so iPad Safari stays responsive
  for (let start = 1; start <= 114; start += 8) {
    const batch: number[] = [];
    for (let s = start; s < start + 8 && s <= 114; s++) {
      batch.push(s);
    }
    await Promise.all(batch.map((s) => getSurah(s)));
    completed += batch.length;
    onProgress?.(completed, total, `ตัวบทและคำแปล ซูเราะฮ์ที่ ${batch[batch.length - 1]} / 114`);
  }

  // Cache all 604 QCF V2 page font files into persistent Service Worker storage
  const baseBeforeFonts = completed;
  await prefetchAllQcfFontFiles((doneFonts, lastPage) => {
    onProgress?.(
      baseBeforeFonts + doneFonts,
      total,
      `ฟอนต์มุศฮัฟ QCF V2 หน้า ${lastPage} / 604`
    );
  });
}

export function getDataFileUrl(relativePath: string): string {
  return dataUrl(relativePath);
}
