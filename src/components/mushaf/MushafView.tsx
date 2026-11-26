import {
  BookOpen,
  Bookmark,
  Brain,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Languages,
  Loader2,
  Play,
  Square,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAudio } from '../../context/AudioContext';
import { getMushafQcfPages, getPageSurahPayloads } from '../../lib/dataLoader';
import {
  ensureQcfPageFont,
  getQcfFontFamily,
  isQcfPageFontLoaded,
} from '../../lib/qcfFontLoader';
import { usePageDwellTracker } from '../../lib/readingTracker';
import type {
  AyahData,
  HifzStatus,
  MushafPageInfo,
  QcfPageData,
  SurahMeta,
  SurahPayload,
} from '../../types/models';

function toArabicDigits(n: number): string {
  const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(n)
    .split('')
    .map((d) => digits[Number(d)] ?? d)
    .join('');
}

interface PageSurahBlock {
  surahNumber: number;
  payload: SurahPayload;
  ayahs: AyahData[];
}

interface SelectedAyahContext {
  surah: number;
  surahNameTh: string;
  surahNameEn: string;
  surahNameAr: string;
  ayah: AyahData;
}

const HIFZ_PILLS: Array<{ id: HifzStatus; label: string }> = [
  { id: 'learning', label: 'กำลังท่อง' },
  { id: 'memorized', label: 'จำแม่นแล้ว' },
  { id: 'review', label: 'ต้องทบทวน' },
  { id: 'none', label: 'ล้าง' },
];

function MushafPageSheet({
  pageInfo,
  qcfPage,
  renderMode,
  surahsByNum,
  payloadMap,
  fontSize,
  selectedKey,
  activeAudioSurah,
  activeAudioAyah,
  getHifzStatus,
  isBookmarked,
  isAyahRead,
  onSelectAyah,
}: {
  pageInfo: MushafPageInfo;
  qcfPage: QcfPageData | null;
  renderMode: 'qcf-v2' | 'uthmani';
  surahsByNum: Map<number, SurahMeta>;
  payloadMap: Map<number, SurahPayload>;
  fontSize: number;
  selectedKey: string | null;
  activeAudioSurah: number | null;
  activeAudioAyah: number | null;
  getHifzStatus: (key: string) => HifzStatus;
  isBookmarked: (id: string) => boolean;
  isAyahRead: (surah: number, ayah: number) => boolean;
  onSelectAyah: (ctx: SelectedAyahContext) => void;
}) {
  const widthProbeRef = useRef<HTMLDivElement | null>(null);
  const lastWinWidthRef = useRef<number>(
    typeof window !== 'undefined' ? window.innerWidth : 0
  );
  const measuredOnceRef = useRef<boolean>(false);
  const [innerWidth, setInnerWidth] = useState<number>(480);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [fontReady, setFontReady] = useState<boolean>(() =>
    renderMode !== 'qcf-v2' || isQcfPageFontLoaded(pageInfo.page)
  );

  useEffect(() => {
    const el = widthProbeRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = Math.floor(el.clientWidth);
      if (w <= 0) return;
      const winW = typeof window !== 'undefined' ? window.innerWidth : 0;
      const winChanged = Math.abs(winW - lastWinWidthRef.current) >= 2;
      setInnerWidth((prev) => {
        // Ignore <=24px scrollbar appearance/disappearance deltas when window width hasn't changed
        if (!measuredOnceRef.current || winChanged || Math.abs(w - prev) > 24) {
          measuredOnceRef.current = true;
          lastWinWidthRef.current = winW;
          return w;
        }
        return prev;
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (renderMode !== 'qcf-v2') {
      setFontReady(true);
      return;
    }
    if (isQcfPageFontLoaded(pageInfo.page)) {
      setFontReady(true);
      return;
    }
    let active = true;
    setFontReady(false);
    ensureQcfPageFont(pageInfo.page)
      .then(() => {
        if (active) setFontReady(true);
      })
      .catch(() => {
        if (active) setFontReady(true);
      });
    return () => {
      active = false;
    };
  }, [pageInfo.page, renderMode]);

  const blocks: PageSurahBlock[] = useMemo(() => {
    const out: PageSurahBlock[] = [];
    for (const seg of pageInfo.segments) {
      const payload = payloadMap.get(seg.surah);
      if (!payload) continue;
      const ayahs = payload.ayahs.filter(
        (a) => a.number >= seg.from && a.number <= seg.to
      );
      if (ayahs.length > 0) {
        out.push({ surahNumber: seg.surah, payload, ayahs });
      }
    }
    return out;
  }, [pageInfo, payloadMap]);

  const headerSurahNames = useMemo(() => {
    return pageInfo.surahs
      .map((s) => surahsByNum.get(s)?.nameAr ?? payloadMap.get(s)?.metadata.nameAr ?? '')
      .filter(Boolean)
      .join(' • ');
  }, [pageInfo.surahs, surahsByNum, payloadMap]);

  const pageAllRead = useMemo(() => {
    if (pageInfo.segments.length === 0) return false;
    return pageInfo.segments.every((seg) => {
      for (let a = seg.from; a <= seg.to; a++) {
        if (!isAyahRead(seg.surah, a)) return false;
      }
      return true;
    });
  }, [pageInfo.segments, isAyahRead]);

  const handleWordClick = useCallback(
    (sNum: number, aNum: number) => {
      const payload = payloadMap.get(sNum);
      const ayah = payload?.ayahs.find((x) => x.number === aNum);
      if (!payload || !ayah) return;
      const sMeta = surahsByNum.get(sNum) ?? payload.metadata;
      onSelectAyah({
        surah: sNum,
        surahNameTh: sMeta.nameTh,
        surahNameEn: sMeta.nameEn,
        surahNameAr: sMeta.nameAr,
        ayah,
      });
    },
    [payloadMap, surahsByNum, onSelectAyah]
  );

  const isOpeningPage = pageInfo.page === 1 || pageInfo.page === 2;
  const qcfFamily = getQcfFontFamily(pageInfo.page);
  // Fit 15-line QCF lines cleanly inside actual sheet width while respecting user zoom ratio
  const zoomRatio = fontSize / 30;
  const baseFitPx = innerWidth / (isOpeningPage ? 15.4 : 18.6);
  const qcfLineFontPx = Math.max(14, Math.min(42, Math.floor(baseFitPx * zoomRatio)));

  const useQcf = renderMode === 'qcf-v2' && qcfPage !== null;

  return (
    <div className="flex h-full flex-col rounded-2xl border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 sm:px-6 py-4 sm:py-5 shadow-[var(--shadow-card)]">
      <div ref={widthProbeRef} className="h-0 w-full pointer-events-none" aria-hidden="true" />
      {/* Ornate Mushaf Header */}
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-[var(--border-color)] pb-2 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-1.5">
          <span className="rounded-md bg-[var(--bg-subtle)] px-2 py-0.5 font-semibold text-[var(--accent-text)]">
            ญุซอ์ {pageInfo.juz}
          </span>
          <span className="hidden sm:inline text-[var(--text-muted)]">
            ฮิซบ์ {pageInfo.hizb}
          </span>
          {pageAllRead && (
            <span
              className="inline-flex items-center gap-0.5 rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--accent-text)]"
              title="บันทึกว่าอ่านหน้านี้แล้ว"
            >
              <Check className="h-3 w-3" />
              อ่านแล้ว
            </span>
          )}
        </div>
        <div dir="rtl" className="font-arabic truncate text-base sm:text-lg text-[var(--accent)]">
          {headerSurahNames}
        </div>
      </div>

      {/* Main Sheet Body */}
      <div
        className={`flex flex-1 flex-col justify-center ${
          fontSize > 34 ? 'overflow-x-auto' : 'overflow-x-hidden'
        }`}
      >
        {useQcf ? (
          !fontReady ? (
            <div className="flex min-h-[420px] items-center justify-center text-xs text-[var(--text-muted)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-[var(--accent)]" />
              กำลังโหลดฟอนต์มุศฮัฟหน้า {pageInfo.page}...
            </div>
          ) : (
            <div
              className={`flex flex-col justify-between ${
                isOpeningPage
                  ? 'my-auto rounded-2xl border-2 border-[var(--gold)]/45 bg-[var(--bg-elevated)]/45 px-3 sm:px-6 py-6 gap-2.5'
                  : 'gap-1 sm:gap-1.5 py-1'
              }`}
            >
              {qcfPage.lines.map((lineItem, idx) => {
                if (lineItem.t === 'surah') {
                  const sMeta =
                    surahsByNum.get(lineItem.s) ?? payloadMap.get(lineItem.s)?.metadata;
                  return (
                    <div
                      key={`s-${lineItem.s}-${idx}`}
                      className="my-0.5 flex items-center justify-between rounded-xl border border-[var(--gold)]/55 bg-[var(--gold-soft)]/55 px-3 py-1 text-center"
                    >
                      <span className="text-[10px] sm:text-[11px] font-semibold text-[var(--text-secondary)]">
                        {lineItem.s}. {sMeta?.nameTh ?? ''}
                        {sMeta?.nameEn ? ` (${sMeta.nameEn})` : ''}
                      </span>
                      <span
                        dir="rtl"
                        className="font-arabic text-base sm:text-xl font-bold leading-snug text-[var(--text-primary)]"
                      >
                        {sMeta?.nameAr ?? `سورة ${toArabicDigits(lineItem.s)}`}
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)]">
                        {sMeta ? `${sMeta.ayahCount} อายะฮ์` : ''}
                      </span>
                    </div>
                  );
                }

                if (lineItem.t === 'bismillah') {
                  return (
                    <div
                      key={`b-${lineItem.s}-${idx}`}
                      dir="rtl"
                      className="font-arabic py-0.5 text-center leading-[1.65] text-[var(--text-primary)]"
                      style={{ fontSize: `${Math.round(qcfLineFontPx * 0.96)}px` }}
                    >
                      بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                    </div>
                  );
                }

                const centeredLine = isOpeningPage || lineItem.w.length <= 2;
                return (
                  <div
                    key={`l-${lineItem.l}-${idx}`}
                    dir="rtl"
                    className={`flex items-center whitespace-nowrap select-none leading-[1.72] ${
                      centeredLine ? 'justify-center gap-2' : 'justify-between'
                    }`}
                    style={{
                      fontFamily: `"${qcfFamily}", "UthmanicHafs", serif`,
                      fontSize: `${qcfLineFontPx}px`,
                    }}
                  >
                    {lineItem.w.map((wt, wIdx) => {
                      const [sNum, aNum, isEnd, glyph] = wt;
                      const key = `${sNum}:${aNum}`;
                      const isPlayingAyah =
                        activeAudioSurah === sNum && activeAudioAyah === aNum;
                      const isSelected = selectedKey === key;
                      const isHovered = hoveredKey === key;
                      const hifzStatus = isEnd ? getHifzStatus(key) : 'none';
                      const bookmarked = isEnd ? isBookmarked(`quran:${key}`) : false;

                      return (
                        <span
                          key={`${lineItem.l}-${wIdx}`}
                          role="button"
                          tabIndex={0}
                          onMouseEnter={() => setHoveredKey(key)}
                          onMouseLeave={() =>
                            setHoveredKey((prev) => (prev === key ? null : prev))
                          }
                          onClick={() => handleWordClick(sNum, aNum)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleWordClick(sNum, aNum);
                            }
                          }}
                          className={`cursor-pointer rounded px-0.5 transition-colors ${
                            isPlayingAyah
                              ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                              : isSelected
                                ? 'bg-[var(--gold-soft)] text-[var(--text-primary)]'
                                : isHovered
                                  ? 'bg-[var(--bg-subtle)]/85'
                                  : ''
                          } ${
                            isEnd
                              ? hifzStatus === 'memorized'
                                ? 'text-[var(--accent)]'
                                : bookmarked
                                  ? 'text-[var(--gold)] underline decoration-dotted'
                                  : 'text-[var(--gold)]'
                              : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {glyph}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* Fallback Flowing Uthmani Mode */
          <div className="space-y-5">
            {blocks.map((block) => {
              const startsAtFirst = block.ayahs[0]?.number === 1;
              const showBismillah =
                startsAtFirst && block.surahNumber !== 1 && block.surahNumber !== 9;
              const sMeta = surahsByNum.get(block.surahNumber) ?? block.payload.metadata;

              return (
                <div key={`${pageInfo.page}-${block.surahNumber}`} className="space-y-3">
                  {startsAtFirst && (
                    <div className="rounded-xl border border-[var(--gold)]/40 bg-[var(--gold-soft)]/50 px-4 py-2.5 text-center">
                      <div
                        dir="rtl"
                        className="font-arabic text-xl sm:text-2xl font-bold text-[var(--text-primary)]"
                      >
                        {sMeta.nameAr}
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                        ซูเราะฮ์ที่ {block.surahNumber}: {sMeta.nameTh}
                        {sMeta.nameEn ? ` (${sMeta.nameEn})` : ''} ({sMeta.ayahCount} อายะฮ์)
                      </div>
                    </div>
                  )}

                  {showBismillah && (
                    <div
                      dir="rtl"
                      className="font-arabic pt-1 text-center text-2xl sm:text-[26px] text-[var(--text-primary)]"
                    >
                      بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                    </div>
                  )}

                  <p
                    dir="rtl"
                    className="font-arabic m-0 text-justify leading-[2.2] text-[var(--text-primary)] select-text"
                    style={{ fontSize: `${fontSize}px`, textAlignLast: 'center' }}
                  >
                    {block.ayahs.map((ayah) => {
                      const key = `${block.surahNumber}:${ayah.number}`;
                      const isSelected = selectedKey === key;
                      const isPlayingAyah =
                        activeAudioSurah === block.surahNumber &&
                        activeAudioAyah === ayah.number;
                      const hifzStatus = getHifzStatus(key);
                      const bookmarked = isBookmarked(`quran:${key}`);

                      return (
                        <span
                          key={key}
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            onSelectAyah({
                              surah: block.surahNumber,
                              surahNameTh: sMeta.nameTh,
                              surahNameEn: sMeta.nameEn,
                              surahNameAr: sMeta.nameAr,
                              ayah,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelectAyah({
                                surah: block.surahNumber,
                                surahNameTh: sMeta.nameTh,
                                surahNameEn: sMeta.nameEn,
                                surahNameAr: sMeta.nameAr,
                                ayah,
                              });
                            }
                          }}
                          className={`cursor-pointer rounded-md px-0.5 transition-colors ${
                            isPlayingAyah
                              ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] ring-1 ring-[var(--accent)]'
                              : isSelected
                                ? 'bg-[var(--gold-soft)] ring-1 ring-[var(--gold)]'
                                : 'hover:bg-[var(--bg-subtle)]/70'
                          }`}
                        >
                          {ayah.arabic}{' '}
                          <span
                            className={`mx-0.5 inline-block text-[0.75em] ${
                              hifzStatus === 'memorized'
                                ? 'text-[var(--accent)]'
                                : bookmarked
                                  ? 'text-[var(--gold)] underline decoration-dotted'
                                  : 'text-[var(--gold)]'
                            }`}
                          >
                            ﴿{toArabicDigits(ayah.number)}﴾
                          </span>{' '}
                        </span>
                      );
                    })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Page Number */}
      <div className="mt-4 flex items-center justify-center border-t border-[var(--border-color)] pt-2 text-xs font-semibold text-[var(--text-muted)]">
        <span>
          —{' '}
          <span className="font-arabic text-sm text-[var(--text-primary)]">
            {toArabicDigits(pageInfo.page)}
          </span>{' '}
          ({pageInfo.page} / 604) —
        </span>
      </div>
    </div>
  );
}

export function MushafView() {
  const {
    settings,
    updateSettings,
    surahsIndex,
    mushafPages,
    juzIndex,
    mushafPage,
    updateMushafPage,
    mushafTarget,
    getHifzStatus,
    setHifzStatus,
    isBookmarked,
    toggleBookmark,
    isAyahRead,
    markAyahsRead,
    jumpToReader,
    jumpToHifz,
  } = useApp();

  const {
    playAyah,
    playSurah,
    currentSurah,
    currentAyah,
    currentTrack,
    isPlaying,
    sheikhManifest,
    activeReciterId,
  } = useAudio();

  const [currentPage, setCurrentPage] = useState<number>(() => mushafPage.page || 1);
  const [pageInput, setPageInput] = useState<string>(() => String(mushafPage.page || 1));
  const [qcfPages, setQcfPages] = useState<QcfPageData[] | null>(null);
  const [payloadMap, setPayloadMap] = useState<Map<number, SurahPayload>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedAyah, setSelectedAyah] = useState<SelectedAyahContext | null>(null);
  const [showBriefThai, setShowBriefThai] = useState(false);

  const [isLargeViewport, setIsLargeViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const surahsByNum = useMemo(() => {
    const map = new Map<number, SurahMeta>();
    for (const s of surahsIndex) map.set(s.number, s);
    return map;
  }, [surahsIndex]);

  useEffect(() => {
    const onResize = () => setIsLargeViewport(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Load compact QCF 604-page line dataset once
  useEffect(() => {
    let active = true;
    getMushafQcfPages()
      .then((list) => {
        if (active) setQcfPages(list);
      })
      .catch(() => {
        // Gracefully falls back to flowing Uthmani if unavailable
      });
    return () => {
      active = false;
    };
  }, []);

  // Handle cross-module jump into Mushaf
  useEffect(() => {
    if (mushafTarget) {
      const clamped = Math.max(1, Math.min(604, mushafTarget.page));
      setCurrentPage(clamped);
      setPageInput(String(clamped));
      setSelectedAyah(null);
    }
  }, [mushafTarget]);

  const twoPageMode = isLargeViewport && settings.mushafTwoPageSpread;

  const visiblePages: MushafPageInfo[] = useMemo(() => {
    if (mushafPages.length === 0) return [];
    if (!twoPageMode) {
      const single = mushafPages[currentPage - 1];
      return single ? [single] : [];
    }
    const oddPageNum = currentPage % 2 === 1 ? currentPage : Math.max(1, currentPage - 1);
    const evenPageNum = oddPageNum + 1 <= 604 ? oddPageNum + 1 : null;
    const list: MushafPageInfo[] = [];
    if (mushafPages[oddPageNum - 1]) list.push(mushafPages[oddPageNum - 1]);
    if (evenPageNum && mushafPages[evenPageNum - 1]) {
      list.push(mushafPages[evenPageNum - 1]);
    }
    return list;
  }, [mushafPages, currentPage, twoPageMode]);

  const primaryPageInfo = visiblePages[0] ?? null;

  // Persist current page
  useEffect(() => {
    updateMushafPage(currentPage);
    setPageInput(String(currentPage));
  }, [currentPage, updateMushafPage]);

  // Load surah payloads + prefetch neighbor fonts & payloads
  useEffect(() => {
    if (visiblePages.length === 0) return;
    let active = true;
    setLoading(true);
    setLoadError(null);

    Promise.all(visiblePages.map((p) => getPageSurahPayloads(p)))
      .then((maps) => {
        if (!active) return;
        const merged = new Map<number, SurahPayload>();
        for (const m of maps) {
          m.forEach((v, k) => merged.set(k, v));
        }
        setPayloadMap(merged);
        setLoading(false);

        const lastVis = visiblePages[visiblePages.length - 1]?.page ?? currentPage;
        const firstVis = visiblePages[0]?.page ?? currentPage;
        const neighborNums = [firstVis - 1, lastVis + 1, lastVis + 2].filter(
          (n) => n >= 1 && n <= 604
        );
        for (const n of neighborNums) {
          const pInfo = mushafPages[n - 1];
          if (pInfo) void getPageSurahPayloads(pInfo).catch(() => undefined);
          void ensureQcfPageFont(n).catch(() => undefined);
        }
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : 'โหลดหน้ามุศฮัฟไม่สำเร็จ');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [visiblePages, currentPage, mushafPages]);

  const goToPage = useCallback((pageNum: number) => {
    const clamped = Math.max(1, Math.min(604, Math.floor(pageNum)));
    setCurrentPage(clamped);
    setSelectedAyah(null);
    setShowBriefThai(false);
  }, []);

  const stepPage = useCallback(
    (delta: number) => {
      const step = twoPageMode ? 2 : 1;
      const base = twoPageMode
        ? currentPage % 2 === 1
          ? currentPage
          : currentPage - 1
        : currentPage;
      goToPage(base + delta * step);
    },
    [twoPageMode, currentPage, goToPage]
  );

  // Keyboard navigation: ArrowLeft = next page (RTL book), ArrowRight = prev page
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepPage(1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepPage(-1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stepPage]);

  const visibleAyahKeys = useMemo(() => {
    const keys: string[] = [];
    for (const p of visiblePages) {
      for (const seg of p.segments) {
        for (let a = seg.from; a <= seg.to; a++) {
          keys.push(`${seg.surah}:${a}`);
        }
      }
    }
    return keys;
  }, [visiblePages]);

  const allVisibleRead = useMemo(() => {
    if (visibleAyahKeys.length === 0) return false;
    return visibleAyahKeys.every((k) => {
      const [s, a] = k.split(':').map(Number);
      return isAyahRead(s, a);
    });
  }, [visibleAyahKeys, isAyahRead]);

  const handleMarkPageRead = useCallback(() => {
    if (visibleAyahKeys.length > 0) {
      markAyahsRead(visibleAyahKeys);
    }
  }, [visibleAyahKeys, markAyahsRead]);

  const dwellKey =
    !loading && visiblePages.length > 0
      ? `mushaf:${visiblePages.map((p) => p.page).join('-')}`
      : null;

  const mushafDwellMs = Math.max(1, visiblePages.length) * 90_000;

  usePageDwellTracker(
    settings.autoTrackReading && !loading,
    dwellKey,
    mushafDwellMs,
    handleMarkPageRead
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (dx > 0) stepPage(1);
    else stepPage(-1);
  };

  const commitPageInput = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(pageInput);
    if (Number.isFinite(num) && num >= 1 && num <= 604) {
      goToPage(num);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const currentSurahInView = primaryPageInfo?.surahs[0] ?? 1;
  const currentJuzInView = primaryPageInfo?.juz ?? 1;
  const selectedKey = selectedAyah
    ? `${selectedAyah.surah}:${selectedAyah.ayah.number}`
    : null;
  const selectedHifzStatus = selectedKey ? getHifzStatus(selectedKey) : 'none';
  const selectedBookmarkId = selectedKey ? `quran:${selectedKey}` : '';
  const selectedBookmarked = selectedBookmarkId ? isBookmarked(selectedBookmarkId) : false;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Mushaf Toolbar (3-Zone Layout with Centered Page Navigator) */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-[var(--border-color)] bg-[var(--bg-surface)]/90 px-3 sm:px-5 py-2.5">
        {/* Left Zone: Surah & Juz Jump */}
        <div className="flex flex-wrap items-center justify-center xl:justify-start gap-2">
          {/* Surah Jump */}
          <select
            aria-label="เลือกซูเราะฮ์"
            value={currentSurahInView}
            onChange={(e) => {
              const s = surahsIndex.find((item) => item.number === Number(e.target.value));
              if (s?.startPage) goToPage(s.startPage);
            }}
            className="min-h-[38px] max-w-[185px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2.5 text-xs font-medium text-[var(--text-primary)]"
          >
            {surahsIndex.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number}. {s.nameTh} ({s.nameEn}) • หน้า {s.startPage ?? 1}
              </option>
            ))}
          </select>

          {/* Juz Jump */}
          <select
            aria-label="เลือกญุซอ์"
            value={currentJuzInView}
            onChange={(e) => {
              const j = juzIndex.find((item) => item.juz === Number(e.target.value));
              if (j) goToPage(j.startPage);
            }}
            className="min-h-[38px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2.5 text-xs font-medium text-[var(--text-primary)]"
          >
            {(juzIndex.length > 0
              ? juzIndex
              : Array.from({ length: 30 }, (_, i) => ({ juz: i + 1, startPage: 1 }))
            ).map((j) => (
              <option key={j.juz} value={j.juz}>
                ญุซอ์ {j.juz} (หน้า {j.startPage})
              </option>
            ))}
          </select>
        </div>

        {/* Center Zone: Prominent Page Navigator (ถัดไป • หน้า X/604 • ก่อนหน้า) */}
        <div className="flex items-center justify-center gap-1.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2 py-1 shadow-xs mx-auto">
          <button
            type="button"
            disabled={(visiblePages[visiblePages.length - 1]?.page ?? currentPage) >= 604}
            onClick={() => stepPage(1)}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-[var(--accent)] px-3.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-40"
            title="หน้าถัดไป (ลูกศรซ้าย / ปัดขวา)"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>ถัดไป</span>
          </button>

          <form onSubmit={commitPageInput} className="flex items-center gap-1 px-1.5">
            <span className="hidden sm:inline text-xs text-[var(--text-muted)]">หน้า</span>
            <input
              type="number"
              min={1}
              max={604}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={commitPageInput}
              aria-label="ข้ามไปหน้าที่"
              className="min-h-[34px] w-16 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-1.5 text-center text-xs font-bold tabular-nums text-[var(--text-primary)]"
            />
            <span className="text-xs text-[var(--text-muted)]">/ 604</span>
          </form>

          <button
            type="button"
            disabled={(visiblePages[0]?.page ?? currentPage) <= 1}
            onClick={() => stepPage(-1)}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] disabled:opacity-40"
            title="หน้าก่อนหน้า (ลูกศรขวา / ปัดซ้าย)"
          >
            <span>ก่อนหน้า</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Right Zone: Font, Spread, Mark Read */}
        <div className="flex flex-wrap items-center justify-center xl:justify-end gap-1.5">
          <div className="flex items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-0.5 text-xs">
            <button
              type="button"
              onClick={() =>
                updateSettings({
                  mushafFontSize: Math.max(20, settings.mushafFontSize - 2),
                })
              }
              className="min-h-[32px] px-2 font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              title="ลดขนาดตัวอักษรมุศฮัฟ"
            >
              ع-
            </button>
            <span className="px-1 text-[11px] tabular-nums text-[var(--text-muted)]">
              {settings.mushafFontSize}
            </span>
            <button
              type="button"
              onClick={() =>
                updateSettings({
                  mushafFontSize: Math.min(48, settings.mushafFontSize + 2),
                })
              }
              className="min-h-[32px] px-2 font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              title="เพิ่มขนาดตัวอักษรมุศฮัฟ"
            >
              ع+
            </button>
          </div>

          {isLargeViewport && (
            <button
              type="button"
              onClick={() =>
                updateSettings({ mushafTwoPageSpread: !settings.mushafTwoPageSpread })
              }
              className={`inline-flex min-h-[36px] items-center gap-1 rounded-xl border px-2.5 text-xs font-medium ${
                settings.mushafTwoPageSpread
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
              }`}
              title="สลับแสดง 1 หน้า หรือ 2 หน้าคู่เหมือนเล่มจริง"
            >
              {settings.mushafTwoPageSpread ? (
                <Columns2 className="h-3.5 w-3.5" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              <span>{settings.mushafTwoPageSpread ? '2 หน้าคู่' : '1 หน้า'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleMarkPageRead}
            className={`inline-flex min-h-[36px] items-center gap-1 rounded-xl border px-2.5 text-xs font-semibold transition-colors ${
              allVisibleRead
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:border-[var(--accent)]'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{allVisibleRead ? 'อ่านหน้านี้แล้ว' : 'บันทึกอ่านหน้านี้'}</span>
          </button>
        </div>
      </div>

      {/* Scrollable Mushaf Canvas (scrollbarGutter: stable prevents PC scrollbar jitter) */}
      <div
        className="min-h-0 flex-1 overflow-y-auto px-2 sm:px-6 py-4 sm:py-5"
        style={{ scrollbarGutter: 'stable' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className={`mx-auto ${twoPageMode ? 'max-w-6xl' : 'max-w-2xl'} space-y-4`}>
          {loading && (
            <div className="flex items-center justify-center py-20 text-sm text-[var(--text-muted)]">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              กำลังเปิดหน้ามุศฮัฟ...
            </div>
          )}

          {loadError && (
            <div className="rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]">
              {loadError}
            </div>
          )}

          {!loading && !loadError && visiblePages.length > 0 && (
            <div
              className={`grid gap-4 sm:gap-5 ${
                twoPageMode && visiblePages.length === 2 ? 'lg:grid-cols-2' : 'grid-cols-1'
              }`}
              style={
                twoPageMode && visiblePages.length === 2
                  ? { direction: 'rtl' }
                  : undefined
              }
            >
              {visiblePages.map((pageInfo) => (
                <div key={pageInfo.page} style={{ direction: 'ltr' }}>
                  <MushafPageSheet
                    pageInfo={pageInfo}
                    qcfPage={qcfPages ? qcfPages[pageInfo.page - 1] ?? null : null}
                    renderMode="qcf-v2"
                    surahsByNum={surahsByNum}
                    payloadMap={payloadMap}
                    fontSize={settings.mushafFontSize}
                    selectedKey={selectedKey}
                    activeAudioSurah={currentSurah}
                    activeAudioAyah={currentAyah}
                    getHifzStatus={getHifzStatus}
                    isBookmarked={isBookmarked}
                    isAyahRead={isAyahRead}
                    onSelectAyah={(ctx) => {
                      setSelectedAyah(ctx);
                      setShowBriefThai(false);
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Bottom Centered Page Navigator */}
          {!loading && !loadError && visiblePages.length > 0 && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                disabled={(visiblePages[visiblePages.length - 1]?.page ?? currentPage) >= 604}
                onClick={() => stepPage(1)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[var(--accent-hover)] disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>หน้าถัดไป</span>
              </button>

              <span className="text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                หน้า{' '}
                {visiblePages.length === 2
                  ? `${visiblePages[0].page}–${visiblePages[1].page}`
                  : currentPage}{' '}
                / 604
              </span>

              <button
                type="button"
                disabled={(visiblePages[0]?.page ?? currentPage) <= 1}
                onClick={() => stepPage(-1)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 text-xs font-semibold text-[var(--text-primary)] shadow-sm hover:border-[var(--accent)] disabled:opacity-40"
              >
                <span>หน้าก่อนหน้า</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="pb-2 text-center text-[11px] text-[var(--text-muted)]">
            ฟอนต์มุศฮัฟ QCF V2 (อุษมาน ฏอฮา • 15 บรรทัดแบบ Quran.com) • แตะคำ/อายะฮ์เพื่อฟังเสียงหรือเปิดคำแปล • ปัดขวาเพื่อไปหน้าถัดไป
          </div>
        </div>
      </div>

      {/* Selected Ayah Action Dock */}
      {selectedAyah && (
        <div className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 shadow-lg">
          <div className="mx-auto max-w-4xl space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--accent-text)]">
                  {selectedAyah.surah}:{selectedAyah.ayah.number}
                </span>
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  {selectedAyah.surahNameTh}
                  {selectedAyah.surahNameEn && (
                    <span className="ml-1.5 text-xs font-normal text-[var(--text-muted)]">
                      ({selectedAyah.surahNameEn})
                    </span>
                  )}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  หน้า {selectedAyah.ayah.page ?? currentPage} • ญุซอ์{' '}
                  {selectedAyah.ayah.juz ?? currentJuzInView}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAyah(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
                title="ปิดแถบเครื่องมืออายะฮ์"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() =>
                  playAyah(selectedAyah.surah, selectedAyah.ayah.number)
                }
                className={`inline-flex min-h-[36px] items-center gap-1 rounded-xl px-3 font-semibold ${
                  currentSurah === selectedAyah.surah &&
                  currentAyah === selectedAyah.ayah.number &&
                  isPlaying
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                }`}
              >
                <Play className="h-3.5 w-3.5" />
                ฟังอายะฮ์นี้
              </button>

              {(() => {
                const sheikhTracks =
                  activeReciterId === 'sheikh-abdallah-humeid'
                    ? sheikhManifest?.surahs[String(selectedAyah.surah)] ?? []
                    : [];
                if (sheikhTracks.length > 1) {
                  return sheikhTracks.map((tr) => {
                    const playingThisTrack =
                      currentSurah === selectedAyah.surah &&
                      currentTrack?.id === tr.id &&
                      isPlaying;
                    return (
                      <button
                        key={tr.id}
                        type="button"
                        onClick={() =>
                          playSurah(selectedAyah.surah, 'sheikh-abdallah-humeid', tr.id)
                        }
                        className={`inline-flex min-h-[36px] items-center gap-1 rounded-xl border px-3 font-medium ${
                          playingThisTrack
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                            : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                        }`}
                      >
                        <Play className="h-3.5 w-3.5" />
                        ฟังทั้งซูเราะฮ์ ({tr.partLabel})
                      </button>
                    );
                  });
                }
                return (
                  <button
                    type="button"
                    onClick={() => playSurah(selectedAyah.surah)}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 font-medium text-[var(--text-primary)]"
                  >
                    <Play className="h-3.5 w-3.5 text-[var(--accent)]" />
                    ฟังทั้งซูเราะฮ์
                  </button>
                );
              })()}

              <button
                type="button"
                onClick={() =>
                  jumpToReader(selectedAyah.surah, selectedAyah.ayah.number)
                }
                className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 font-medium text-[var(--text-primary)]"
              >
                <BookOpen className="h-3.5 w-3.5 text-[var(--accent)]" />
                เปิดในหน้าคำแปล
              </button>

              <button
                type="button"
                onClick={() =>
                  jumpToHifz(
                    selectedAyah.surah,
                    selectedAyah.ayah.number,
                    selectedAyah.ayah.number
                  )
                }
                className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 font-medium text-[var(--text-primary)]"
              >
                <Brain className="h-3.5 w-3.5 text-[var(--accent)]" />
                โหมดท่องจำ
              </button>

              <button
                type="button"
                onClick={() =>
                  toggleBookmark({
                    id: selectedBookmarkId,
                    type: 'quran',
                    title: `${selectedAyah.surahNameTh} (${selectedAyah.surah}:${selectedAyah.ayah.number})`,
                    subtitle: selectedAyah.ayah.translations.th_kfgqpc.slice(0, 80),
                    surah: selectedAyah.surah,
                    ayah: selectedAyah.ayah.number,
                  })
                }
                className={`inline-flex min-h-[36px] items-center gap-1 rounded-xl border px-3 font-medium ${
                  selectedBookmarked
                    ? 'border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--text-primary)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                }`}
              >
                <Bookmark
                  className="h-3.5 w-3.5 text-[var(--gold)]"
                  fill={selectedBookmarked ? 'currentColor' : 'none'}
                />
                {selectedBookmarked ? 'บุ๊กมาร์กแล้ว' : 'บุ๊กมาร์ก'}
              </button>

              <button
                type="button"
                onClick={() => setShowBriefThai((v) => !v)}
                className={`inline-flex min-h-[36px] items-center gap-1 rounded-xl border px-3 font-medium ${
                  showBriefThai
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                }`}
              >
                <Languages className="h-3.5 w-3.5" />
                {showBriefThai ? 'ซ่อนคำแปลย่อ' : 'ดูคำแปลไทยย่อ'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="font-semibold text-[var(--text-muted)]">สถานะท่องจำ:</span>
              {HIFZ_PILLS.map((pill) => {
                const active = selectedHifzStatus === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => {
                      if (selectedKey) setHifzStatus(selectedKey, pill.id);
                    }}
                    className={`rounded-lg border px-2.5 py-1 font-semibold transition-colors ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                        : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            {showBriefThai && (
              <div className="font-thai rounded-xl border border-[var(--border-color)] bg-[var(--bg-subtle)]/60 px-3 py-2 text-xs leading-relaxed text-[var(--text-primary)]">
                {selectedAyah.ayah.translations.th_kfgqpc}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
