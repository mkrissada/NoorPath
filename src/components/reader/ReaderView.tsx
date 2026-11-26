import {
  Bookmark,
  BookOpenText,
  BookText,
  Brain,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Columns2,
  FileText,
  Headphones,
  Loader2,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAudio } from '../../context/AudioContext';
import { getMushafQcfPages, getSurah } from '../../lib/dataLoader';
import {
  ensureQcfPageFont,
  getQcfFontFamily,
  isQcfPageFontLoaded,
} from '../../lib/qcfFontLoader';
import { useAyahViewportTracker } from '../../lib/readingTracker';
import type { AyahData, QcfPageData, SurahPayload, TranslationKey } from '../../types/models';

const JUZ_START_MAP: Array<{ juz: number; surah: number; ayah: number }> = [
  { juz: 1, surah: 1, ayah: 1 },
  { juz: 2, surah: 2, ayah: 142 },
  { juz: 3, surah: 2, ayah: 253 },
  { juz: 4, surah: 3, ayah: 93 },
  { juz: 5, surah: 4, ayah: 24 },
  { juz: 6, surah: 4, ayah: 148 },
  { juz: 7, surah: 5, ayah: 82 },
  { juz: 8, surah: 6, ayah: 111 },
  { juz: 9, surah: 7, ayah: 88 },
  { juz: 10, surah: 8, ayah: 41 },
  { juz: 11, surah: 9, ayah: 93 },
  { juz: 12, surah: 11, ayah: 6 },
  { juz: 13, surah: 12, ayah: 53 },
  { juz: 14, surah: 15, ayah: 1 },
  { juz: 15, surah: 17, ayah: 1 },
  { juz: 16, surah: 18, ayah: 75 },
  { juz: 17, surah: 21, ayah: 1 },
  { juz: 18, surah: 23, ayah: 1 },
  { juz: 19, surah: 25, ayah: 21 },
  { juz: 20, surah: 27, ayah: 56 },
  { juz: 21, surah: 29, ayah: 46 },
  { juz: 22, surah: 33, ayah: 31 },
  { juz: 23, surah: 36, ayah: 28 },
  { juz: 24, surah: 39, ayah: 32 },
  { juz: 25, surah: 41, ayah: 47 },
  { juz: 26, surah: 46, ayah: 1 },
  { juz: 27, surah: 51, ayah: 31 },
  { juz: 28, surah: 58, ayah: 1 },
  { juz: 29, surah: 67, ayah: 1 },
  { juz: 30, surah: 78, ayah: 1 },
];

function toArabicDigits(n: number): string {
  const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(n)
    .split('')
    .map((d) => digits[Number(d)] ?? d)
    .join('');
}

export function ReaderView() {
  const {
    settings,
    updateSettings,
    surahsIndex,
    setCustomSurahNameTh,
    resetCustomSurahNameTh,
    lastRead,
    updateLastRead,
    isBookmarked,
    toggleBookmark,
    bookmarks,
    updateBookmarkNote,
    getHifzStatus,
    isAyahRead,
    markAyahsRead,
    markSurahRead,
    readerTarget,
    jumpToMushaf,
    jumpToHifz,
  } = useApp();

  const {
    playSurah,
    playAyah,
    currentSurah,
    currentAyah,
    currentTrack,
    isPlaying,
    sheikhManifest,
    activeReciterId,
  } = useAudio();

  const [selectedSurah, setSelectedSurah] = useState<number>(() => lastRead.surah || 1);
  const [surahData, setSurahData] = useState<SurahPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [qcfPages, setQcfPages] = useState<QcfPageData[] | null>(null);
  const [qcfFontTick, setQcfFontTick] = useState(0);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlySheikhAudio, setOnlySheikhAudio] = useState(false);

  const [editingSurahName, setEditingSurahName] = useState(false);
  const [surahNameDraft, setSurahNameDraft] = useState('');

  const [openTafsirAyahs, setOpenTafsirAyahs] = useState<Set<number>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [scrollToAyah, setScrollToAyah] = useState<number | null>(null);

  const ayahRefs = useRef<Map<number, HTMLElement>>(new Map());

  useEffect(() => {
    let active = true;
    getMushafQcfPages()
      .then((pages) => {
        if (active) setQcfPages(pages);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const { surahQcfMap, surahQcfPages } = useMemo(() => {
    const map = new Map<number, Array<{ page: number; code: string; isEnd: 0 | 1 }>>();
    const pages: number[] = [];
    if (!qcfPages) return { surahQcfMap: map, surahQcfPages: pages };
    for (const pageObj of qcfPages) {
      let pageUsed = false;
      for (const lineItem of pageObj.lines) {
        if (lineItem.t !== 'words') continue;
        for (const [sNum, aNum, isEnd, code] of lineItem.w) {
          if (sNum !== selectedSurah) continue;
          pageUsed = true;
          let arr = map.get(aNum);
          if (!arr) {
            arr = [];
            map.set(aNum, arr);
          }
          arr.push({ page: pageObj.p, code, isEnd });
        }
      }
      if (pageUsed) pages.push(pageObj.p);
    }
    return { surahQcfMap: map, surahQcfPages: pages };
  }, [qcfPages, selectedSurah]);

  useEffect(() => {
    if (surahQcfPages.length === 0) return;
    let active = true;
    const missing = surahQcfPages.filter((p) => !isQcfPageFontLoaded(p));
    if (missing.length === 0) return;

    (async () => {
      const firstBatch = missing.slice(0, 2);
      await Promise.all(firstBatch.map((p) => ensureQcfPageFont(p).catch(() => undefined)));
      if (!active) return;
      setQcfFontTick((t) => t + 1);

      const rest = missing.slice(2);
      const BATCH_SIZE = 8;
      for (let i = 0; i < rest.length; i += BATCH_SIZE) {
        if (!active) return;
        const chunk = rest.slice(i, i + BATCH_SIZE);
        await Promise.all(chunk.map((p) => ensureQcfPageFont(p).catch(() => undefined)));
        if (!active) return;
        setQcfFontTick((t) => t + 1);
      }
    })();

    return () => {
      active = false;
    };
  }, [surahQcfPages]);

  useAyahViewportTracker(
    settings.autoTrackReading && !loading && Boolean(surahData),
    selectedSurah,
    ayahRefs,
    `${selectedSurah}:${surahData?.ayahs.length ?? 0}`,
    markAyahsRead,
    3000
  );

  // Handle cross-module jumps into Reader
  useEffect(() => {
    if (readerTarget) {
      setSelectedSurah(readerTarget.surah);
      setScrollToAyah(readerTarget.ayah);
    }
  }, [readerTarget]);

  // Load Surah JSON
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    setOpenTafsirAyahs(new Set());
    setEditingSurahName(false);
    getSurah(selectedSurah)
      .then((payload) => {
        if (!active) return;
        setSurahData(payload);
        setLoading(false);
        updateLastRead(selectedSurah, scrollToAyah ?? 1);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : 'โหลดข้อมูลซูเราะฮ์ไม่สำเร็จ');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedSurah, updateLastRead]);

  // Scroll to target Ayah or currently playing Ayah
  useEffect(() => {
    const target =
      scrollToAyah ??
      (currentSurah === selectedSurah && currentAyah !== null ? currentAyah : null);
    if (!target || loading) return;
    const el = ayahRefs.current.get(target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (scrollToAyah !== null) {
        setScrollToAyah(null);
      }
    }
  }, [scrollToAyah, currentSurah, currentAyah, selectedSurah, loading]);

  const sheikhCount = useMemo(
    () => surahsIndex.filter((s) => s.hasSheikhAbdallahAudio).length,
    [surahsIndex]
  );

  const filteredSurahs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return surahsIndex.filter((s) => {
      if (onlySheikhAudio && !s.hasSheikhAbdallahAudio) return false;
      if (!q) return true;
      return (
        String(s.number) === q ||
        s.nameTh.toLowerCase().includes(q) ||
        (s.defaultNameTh?.toLowerCase().includes(q) ?? false) ||
        s.meaningTh.toLowerCase().includes(q) ||
        s.nameEn.toLowerCase().includes(q) ||
        s.nameAr.includes(searchQuery.trim())
      );
    });
  }, [surahsIndex, searchQuery, onlySheikhAudio]);

  const toggleTranslation = (key: TranslationKey) => {
    const current = settings.activeTranslations;
    if (current.includes(key)) {
      if (current.length === 1) return; // keep at least one active
      updateSettings({
        activeTranslations: current.filter((k) => k !== key),
        compareTranslations: false,
      });
    } else {
      const next: TranslationKey[] = [...current, key];
      updateSettings({
        activeTranslations: next,
        compareTranslations: next.length === 2,
      });
    }
  };

  const toggleCompareMode = () => {
    if (settings.compareTranslations) {
      updateSettings({
        compareTranslations: false,
        activeTranslations: [settings.activeTranslations[0] ?? 'th_kfgqpc'],
      });
    } else {
      updateSettings({
        compareTranslations: true,
        activeTranslations: ['th_kfgqpc', 'th_rowwad'],
      });
    }
  };

  const toggleTafsir = (ayahNum: number) => {
    setOpenTafsirAyahs((prev) => {
      const next = new Set(prev);
      if (next.has(ayahNum)) next.delete(ayahNum);
      else next.add(ayahNum);
      return next;
    });
  };

  const currentMeta =
    surahsIndex.find((s) => s.number === selectedSurah) ?? surahData?.metadata;

  const handleBookmarkAyah = (ayah: AyahData) => {
    if (!surahData) return;
    const displayNameTh = currentMeta?.nameTh ?? surahData.metadata.nameTh;
    const id = `quran:${surahData.number}:${ayah.number}`;
    toggleBookmark({
      id,
      type: 'quran',
      title: `ซูเราะฮ์ ${displayNameTh} (${surahData.number}:${ayah.number})`,
      subtitle: ayah.translations.th_kfgqpc.slice(0, 80),
      surah: surahData.number,
      ayah: ayah.number,
    });
    updateLastRead(surahData.number, ayah.number);
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Surah Sidebar (iPad split panel / toggleable) */}
      {sidebarOpen && (
        <aside className="flex w-72 sm:w-80 shrink-0 flex-col border-r border-[var(--border-color)] bg-[var(--bg-surface)]">
          <div className="space-y-2.5 border-b border-[var(--border-color)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-[var(--text-primary)]">
                สารบัญ 114 ซูเราะฮ์
              </span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
                aria-label="ซ่อนรายชื่อซูเราะฮ์"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อไทย / อังกฤษ / อาหรับ / เลข..."
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setOnlySheikhAudio((v) => !v)}
                className={`flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  onlySheikhAudio
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                }`}
              >
                เฉพาะมีเสียงเชคฯ ({sheikhCount})
              </button>

              <select
                aria-label="ข้ามไปจุซอ์"
                defaultValue=""
                onChange={(e) => {
                  const juzNum = Number(e.target.value);
                  const entry = JUZ_START_MAP.find((j) => j.juz === juzNum);
                  if (entry) {
                    setSelectedSurah(entry.surah);
                    setScrollToAyah(entry.ayah);
                  }
                  e.target.value = '';
                }}
                className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2 py-1.5 text-xs text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
              >
                <option value="" disabled>
                  ข้ามไปจุซอ์...
                </option>
                {JUZ_START_MAP.map((j) => (
                  <option key={j.juz} value={j.juz}>
                    จุซอ์ {j.juz} ({j.surah}:{j.ayah})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1">
            {filteredSurahs.map((s) => {
              const active = s.number === selectedSurah;
              return (
                <button
                  key={s.number}
                  type="button"
                  onClick={() => {
                    setSelectedSurah(s.number);
                    if (window.innerWidth < 1024) setSidebarOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    active
                      ? 'bg-[var(--accent)] text-white shadow-sm'
                      : 'hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {s.number}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{s.nameTh}</span>
                        {s.hasSheikhAbdallahAudio && (
                          <Headphones
                            className={`h-3.5 w-3.5 shrink-0 ${
                              active ? 'text-white/90' : 'text-[var(--gold)]'
                            }`}
                          />
                        )}
                      </div>
                      <div
                        className={`truncate text-xs ${
                          active ? 'text-white/80' : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {s.nameEn} • {s.meaningTh} • {s.ayahCount} อายะฮ์
                      </div>
                    </div>
                  </div>
                  <span
                    dir="rtl"
                    className={`font-arabic shrink-0 text-base ${
                      active ? 'text-white' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {s.nameAr.replace('سُورَةُ ', '')}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      )}

      {/* Main Reader Pane */}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Reader Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] bg-[var(--bg-surface)]/80 px-3 sm:px-5 py-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent)]"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">รายชื่อซูเราะฮ์</span>
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={selectedSurah <= 1}
                onClick={() => setSelectedSurah((n) => Math.max(1, n - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] disabled:opacity-40"
                title="ซูเราะฮ์ก่อนหน้า"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={selectedSurah >= 114}
                onClick={() => setSelectedSurah((n) => Math.min(114, n + 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] disabled:opacity-40"
                title="ซูเราะฮ์ถัดไป"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Translation controls */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => toggleTranslation('th_kfgqpc')}
              className={`min-h-[36px] rounded-lg border px-2.5 font-medium transition-colors ${
                settings.activeTranslations.includes('th_kfgqpc')
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
              }`}
            >
              แปล: กษัตริย์ฟะฮัดฯ
            </button>
            <button
              type="button"
              onClick={() => toggleTranslation('th_rowwad')}
              className={`min-h-[36px] rounded-lg border px-2.5 font-medium transition-colors ${
                settings.activeTranslations.includes('th_rowwad')
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
              }`}
            >
              แปล: ศูนย์ร็อยวาด
            </button>
            <button
              type="button"
              onClick={toggleCompareMode}
              className={`inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-2.5 font-medium ${
                settings.compareTranslations
                  ? 'border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--text-primary)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
              }`}
            >
              <Columns2 className="h-3.5 w-3.5" />
              เทียบ 2 สำนวน
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ showFootnotes: !settings.showFootnotes })}
              className={`min-h-[36px] rounded-lg border px-2.5 font-medium ${
                settings.showFootnotes
                  ? 'border-[var(--accent)]/50 bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-muted)]'
              }`}
            >
              เชิงอรรถ
            </button>
          </div>
        </div>

        {/* Scrollable Ayahs */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 sm:px-6 py-5">
          <div className="mx-auto max-w-4xl space-y-4">
            {/* Resume Last Read Pill */}
            {(lastRead.surah !== selectedSurah || lastRead.ayah > 1) && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2.5 text-xs shadow-sm">
                <span className="text-[var(--text-secondary)]">
                  ตำแหน่งอ่านล่าสุดของคุณ: ซูเราะฮ์ที่{' '}
                  <strong className="text-[var(--text-primary)]">
                    {lastRead.surah}:{lastRead.ayah}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSurah(lastRead.surah);
                    setScrollToAyah(lastRead.ayah);
                  }}
                  className="rounded-lg bg-[var(--accent-soft)] px-3 py-1.5 font-semibold text-[var(--accent-text)] hover:opacity-90"
                >
                  กลับไปจุดเดิม
                </button>
              </div>
            )}

            {/* Surah Hero Card */}
            {currentMeta && (
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--accent-text)]">
                        ซูเราะฮ์ที่ {currentMeta.number}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {currentMeta.revelationType === 'Meccan' ? 'มักกียะฮ์' : 'มะดะนียะฮ์'} •{' '}
                        {currentMeta.ayahCount} อายะฮ์
                        {currentMeta.startPage
                          ? ` • หน้า ${currentMeta.startPage}${
                              currentMeta.endPage && currentMeta.endPage !== currentMeta.startPage
                                ? `–${currentMeta.endPage}`
                                : ''
                            }`
                          : ''}
                      </span>
                      {currentMeta.hasSheikhAbdallahAudio && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--gold-soft)] px-2 py-0.5 text-xs font-medium text-[var(--text-primary)]">
                          <Headphones className="h-3 w-3 text-[var(--gold)]" />
                          มีเสียงเชค อับดุลลอฮ์ ({currentMeta.sheikhTrackCount} ไฟล์)
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {editingSurahName ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            setCustomSurahNameTh(currentMeta.number, surahNameDraft);
                            setEditingSurahName(false);
                          }}
                          className="flex flex-wrap items-center gap-1.5"
                        >
                          <input
                            type="text"
                            value={surahNameDraft}
                            onChange={(e) => setSurahNameDraft(e.target.value)}
                            placeholder={currentMeta.defaultNameTh ?? currentMeta.nameTh}
                            autoFocus
                            className="min-h-[36px] rounded-xl border border-[var(--accent)] bg-[var(--bg-elevated)] px-3 text-base font-bold text-[var(--text-primary)] focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-[var(--accent)] px-2.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]"
                          >
                            <Check className="h-3.5 w-3.5" />
                            บันทึก
                          </button>
                          {currentMeta.defaultNameTh &&
                            currentMeta.nameTh !== currentMeta.defaultNameTh && (
                              <button
                                type="button"
                                onClick={() => {
                                  resetCustomSurahNameTh(currentMeta.number);
                                  setEditingSurahName(false);
                                }}
                                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent)]"
                                title="กลับไปใช้ชื่อเดิม"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                ค่าเดิม
                              </button>
                            )}
                          <button
                            type="button"
                            onClick={() => setEditingSurahName(false)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
                            aria-label="ยกเลิก"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </form>
                      ) : (
                        <>
                          <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                            {currentMeta.nameTh}{' '}
                            <span className="text-base font-medium text-[var(--accent-text)]">
                              ({currentMeta.nameEn})
                            </span>{' '}
                            <span className="text-base font-normal text-[var(--text-secondary)]">
                              • {currentMeta.meaningTh}
                            </span>
                          </h2>
                          <button
                            type="button"
                            onClick={() => {
                              setSurahNameDraft(currentMeta.nameTh);
                              setEditingSurahName(true);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--accent)]"
                            title="แก้ไขชื่อภาษาไทยของซูเราะฮ์นี้"
                            aria-label="แก้ไขชื่อภาษาไทยของซูเราะฮ์นี้"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      dir="rtl"
                      className="font-arabic mr-2 text-3xl text-[var(--accent)]"
                    >
                      {currentMeta.nameAr}
                    </div>
                    {(() => {
                      const sheikhTracks =
                        activeReciterId === 'sheikh-abdallah-humeid'
                          ? sheikhManifest?.surahs[String(currentMeta.number)] ?? []
                          : [];
                      if (sheikhTracks.length > 1) {
                        return sheikhTracks.map((tr) => {
                          const playingThisTrack =
                            currentSurah === currentMeta.number &&
                            currentTrack?.id === tr.id &&
                            isPlaying;
                          return (
                            <button
                              key={tr.id}
                              type="button"
                              onClick={() =>
                                playSurah(currentMeta.number, 'sheikh-abdallah-humeid', tr.id)
                              }
                              className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold shadow-sm transition-colors ${
                                playingThisTrack
                                  ? 'bg-[var(--accent-hover)] text-white ring-2 ring-[var(--gold)]'
                                  : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
                              }`}
                            >
                              <Play className="h-4 w-4" />
                              ฟัง ({tr.partLabel})
                            </button>
                          );
                        });
                      }
                      return (
                        <button
                          type="button"
                          onClick={() => playSurah(currentMeta.number)}
                          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--accent-hover)]"
                        >
                          <Play className="h-4 w-4" />
                          ฟังทั้งซูเราะฮ์
                        </button>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={() =>
                        jumpToMushaf({
                          page: currentMeta.startPage,
                          surah: currentMeta.number,
                          ayah: 1,
                        })
                      }
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3.5 py-2 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--accent)]"
                    >
                      <BookText className="h-4 w-4 text-[var(--gold)]" />
                      เปิดหน้ามุศฮัฟ
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        jumpToHifz(
                          currentMeta.number,
                          1,
                          Math.min(5, currentMeta.ayahCount)
                        )
                      }
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3.5 py-2 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--accent)]"
                    >
                      <Brain className="h-4 w-4 text-[var(--accent)]" />
                      เข้าโหมดท่องจำ
                    </button>
                    {(() => {
                      const surahAllRead =
                        Boolean(surahData) &&
                        surahData?.number === currentMeta.number &&
                        surahData.ayahs.every((a) => isAyahRead(currentMeta.number, a.number));
                      return (
                        <button
                          type="button"
                          onClick={() =>
                            markSurahRead(currentMeta.number, currentMeta.ayahCount)
                          }
                          className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${
                            surahAllRead
                              ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                              : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:border-[var(--accent)]'
                          }`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {surahAllRead ? 'อ่านจบซูเราะฮ์แล้ว' : 'อ่านจบซูเราะฮ์นี้'}
                        </button>
                      );
                    })()}
                  </div>
                </div>

                {currentMeta.number !== 1 && currentMeta.number !== 9 && (
                  <div
                    dir="rtl"
                    className="font-arabic mt-4 border-t border-[var(--border-color)] pt-4 text-center text-2xl sm:text-3xl text-[var(--text-primary)]"
                  >
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                  </div>
                )}
              </div>
            )}

            {/* Loading / Error */}
            {loading && (
              <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                กำลังโหลดตัวบทและตัฟซีร...
              </div>
            )}

            {loadError && (
              <div className="rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]">
                {loadError}
              </div>
            )}

            {/* Ayah List */}
            {!loading &&
              surahData?.ayahs.map((ayah) => {
                const isActiveAudio =
                  currentSurah === surahData.number && currentAyah === ayah.number;
                const bookmarkId = `quran:${surahData.number}:${ayah.number}`;
                const bookmarked = isBookmarked(bookmarkId);
                const bookmarkEntry = bookmarks.find((b) => b.id === bookmarkId);
                const hifzStatus = getHifzStatus(`${surahData.number}:${ayah.number}`);
                const tafsirOpen = openTafsirAyahs.has(ayah.number);

                const showKfgqpc = settings.activeTranslations.includes('th_kfgqpc');
                const showRowwad = settings.activeTranslations.includes('th_rowwad');

                return (
                  <article
                    key={ayah.number}
                    ref={(el) => {
                      if (el) ayahRefs.current.set(ayah.number, el);
                      else ayahRefs.current.delete(ayah.number);
                    }}
                    className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-[var(--shadow-card)] ${
                      isActiveAudio
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]/35 ring-1 ring-[var(--accent)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-surface)]'
                    }`}
                  >
                    {/* Ayah Top Action Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg bg-[var(--bg-subtle)] px-2 text-xs font-bold tabular-nums text-[var(--accent-text)]">
                          {surahData.number}:{ayah.number}
                        </span>

                        {ayah.page && (
                          <button
                            type="button"
                            onClick={() =>
                              jumpToMushaf({
                                page: ayah.page,
                                surah: surahData.number,
                                ayah: ayah.number,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-subtle)]/70 px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent)]"
                            title="เปิดหน้านี้ในโหมดมุศฮัฟอาหรับล้วน"
                          >
                            <BookText className="h-3 w-3" />
                            หน้า {ayah.page} • ญุซอ์ {ayah.juz ?? 1}
                          </button>
                        )}

                        {isAyahRead(surahData.number, ayah.number) && (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-[var(--accent-soft)]/70 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent-text)]">
                            <Check className="h-3 w-3" />
                            อ่านแล้ว
                          </span>
                        )}

                        {hifzStatus !== 'none' && (
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                              hifzStatus === 'memorized'
                                ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                                : hifzStatus === 'learning'
                                  ? 'bg-[var(--gold-soft)] text-[var(--text-primary)]'
                                  : 'bg-[var(--danger-soft)] text-[var(--danger)]'
                            }`}
                          >
                            {hifzStatus === 'memorized'
                              ? 'จำแม่นแล้ว'
                              : hifzStatus === 'learning'
                                ? 'กำลังท่อง'
                                : 'ต้องทบทวน'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => playAyah(surahData.number, ayah.number)}
                          className={`inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-colors ${
                            isActiveAudio && isPlaying
                              ? 'bg-[var(--accent)] text-white'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
                          }`}
                          title="ฟังอายะฮ์นี้"
                        >
                          <Play className="h-3.5 w-3.5" />
                          <span>ฟัง</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            jumpToHifz(surahData.number, ayah.number, ayah.number)
                          }
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                          title="ส่งเข้าโหมดท่องจำ"
                        >
                          <Brain className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">ท่องจำ</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleTafsir(ayah.number)}
                          className={`inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 text-xs font-medium ${
                            tafsirOpen
                              ? 'bg-[var(--gold-soft)] text-[var(--text-primary)]'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
                          }`}
                        >
                          <BookOpenText className="h-3.5 w-3.5" />
                          <span>ตัฟซีร</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleBookmarkAyah(ayah)}
                          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                            bookmarked
                              ? 'bg-[var(--gold-soft)] text-[var(--gold)]'
                              : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]'
                          }`}
                          title={bookmarked ? 'เอาบุ๊กมาร์กออก' : 'บุ๊กมาร์กอายะฮ์นี้'}
                        >
                          <Bookmark className="h-4 w-4" fill={bookmarked ? 'currentColor' : 'none'} />
                        </button>

                        {bookmarked && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditingNoteId((prev) =>
                                prev === bookmarkId ? null : bookmarkId
                              )
                            }
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                            title="จดโน้ตส่วนตัว"
                          >
                            <MessageSquarePlus className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Arabic KFGQPC QCF V2 Text (fallback to UthmanicHafs while page fonts load) */}
                    {(() => {
                      const qcfWords = surahQcfMap.get(ayah.number);
                      const useQcfAyah =
                        qcfFontTick >= 0 &&
                        Boolean(qcfWords && qcfWords.length > 0) &&
                        qcfWords!.every((w) => isQcfPageFontLoaded(w.page));

                      if (useQcfAyah && qcfWords) {
                        return (
                          <div
                            dir="rtl"
                            className="text-right leading-[2.2] text-[var(--text-primary)] select-text"
                            style={{ fontSize: `${settings.arabicFontSize}px` }}
                          >
                            {qcfWords.map((w, idx) => (
                              <Fragment key={idx}>
                                {idx > 0 ? ' ' : ''}
                                <span
                                  className={w.isEnd ? 'text-[var(--gold)]' : undefined}
                                  style={{
                                    fontFamily: `"${getQcfFontFamily(w.page)}", "UthmanicHafs", serif`,
                                  }}
                                >
                                  {w.code}
                                </span>
                              </Fragment>
                            ))}
                          </div>
                        );
                      }

                      return (
                        <div
                          dir="rtl"
                          className="font-arabic text-right text-[var(--text-primary)]"
                          style={{ fontSize: `${settings.arabicFontSize}px` }}
                        >
                          {ayah.arabic}{' '}
                          <span className="mx-1 inline-block text-[0.78em] text-[var(--gold)]">
                            ﴿{toArabicDigits(ayah.number)}﴾
                          </span>
                        </div>
                      );
                    })()}

                    {/* Thai Translations (Single or Side-by-Side Comparison) */}
                    <div
                      className={`mt-4 grid gap-3 ${
                        settings.compareTranslations && showKfgqpc && showRowwad
                          ? 'md:grid-cols-2'
                          : 'grid-cols-1'
                      }`}
                      style={{ fontSize: `${settings.thaiFontSize}px` }}
                    >
                      {showKfgqpc && (
                        <div className="font-thai rounded-xl bg-[var(--bg-subtle)]/55 p-3">
                          <div className="mb-1 text-[11px] font-semibold tracking-wide text-[var(--accent-text)]">
                            สำนวนกษัตริย์ฟะฮัดฯ (สมาคมศิษย์เก่าอาหรับฯ)
                          </div>
                          <p className="m-0 text-[var(--text-primary)]">
                            {ayah.translations.th_kfgqpc}
                          </p>
                        </div>
                      )}

                      {showRowwad && (
                        <div className="font-thai rounded-xl bg-[var(--bg-subtle)]/55 p-3">
                          <div className="mb-1 text-[11px] font-semibold tracking-wide text-[var(--gold)]">
                            สำนวนศูนย์แปลร็อยวาด (Rowwad)
                          </div>
                          <p className="m-0 text-[var(--text-primary)]">
                            {ayah.translations.th_rowwad}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Rowwad Footnotes */}
                    {settings.showFootnotes && ayah.footnotes && (
                      <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)]/70 px-3 py-2 text-xs text-[var(--text-secondary)]">
                        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                        <span className="leading-relaxed">{ayah.footnotes}</span>
                      </div>
                    )}

                    {/* Collapsible Thai Mokhtasar Tafsir */}
                    {tafsirOpen && (
                      <div className="mt-3 rounded-xl border border-[var(--gold)]/35 bg-[var(--gold-soft)]/50 p-3.5">
                        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[var(--gold)]">
                          <Sparkles className="h-3.5 w-3.5" />
                          ตัฟซีร อัล-มุคตะศ็อร (ภาษาไทย)
                        </div>
                        <p
                          className="font-thai m-0 text-[var(--text-primary)]"
                          style={{ fontSize: `${Math.max(14, settings.thaiFontSize - 1)}px` }}
                        >
                          {ayah.tafsir || 'ยังไม่มีคำอธิบายตัฟซีรสำหรับอายะฮ์นี้'}
                        </p>
                      </div>
                    )}

                    {/* Bookmark Personal Note */}
                    {bookmarked && (editingNoteId === bookmarkId || bookmarkEntry?.note) && (
                      <div className="mt-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-2.5">
                        <label className="block text-[11px] font-semibold text-[var(--text-muted)]">
                          โน้ตส่วนตัวสำหรับ {surahData.number}:{ayah.number}
                        </label>
                        <input
                          type="text"
                          value={bookmarkEntry?.note ?? ''}
                          onChange={(e) => updateBookmarkNote(bookmarkId, e.target.value)}
                          placeholder="พิมพ์ข้อคิด หรือจุดที่ต้องระวังในการอ่าน..."
                          className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                        />
                      </div>
                    )}
                  </article>
                );
              })}
          </div>
        </div>
      </section>
    </div>
  );
}
