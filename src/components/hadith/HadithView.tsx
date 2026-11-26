import {
  Bookmark,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sparkles,
} from 'lucide-react';
import { Fragment, type ReactNode, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getHadeethEncFull, getNawawi40 } from '../../lib/dataLoader';
import { usePageDwellTracker } from '../../lib/readingTracker';
import type { HadithItem, MaskMode } from '../../types/models';
import { WordMasker } from '../shared/WordMasker';

const MASK_MODES: Array<{ id: MaskMode; label: string }> = [
  { id: 'full', label: 'แสดงเต็ม' },
  { id: 'first-words', label: '3 คำแรก' },
  { id: 'first-letter', label: 'ตัวอักษรแรก' },
  { id: 'cloze-50', label: 'ซ่อน 50%' },
  { id: 'hidden', label: 'ซ่อนทั้งหมด' },
];

/**
 * Renders Hadith Arabic text in Kitab font while switching quoted Quran segments
 * (`{...}` or `﴿...﴾`) to the KFGQPC Quran font.
 */
function renderHadithArabicWithQuranQuotes(text: string): ReactNode {
  const parts = text.split(/(\{[^{}]+\}|﴿[^﴾]+﴾)/g);
  if (parts.length <= 1) return text;
  return parts.map((part, idx) => {
    if (!part) return null;
    const isQuranQuote =
      (part.startsWith('{') && part.endsWith('}')) ||
      (part.startsWith('﴿') && part.endsWith('﴾'));
    if (isQuranQuote) {
      return (
        <span key={idx} className="font-arabic text-[var(--accent-text)]">
          {part}
        </span>
      );
    }
    return <Fragment key={idx}>{part}</Fragment>;
  });
}

export function HadithView() {
  const {
    settings,
    isBookmarked,
    toggleBookmark,
    getHifzStatus,
    setHifzStatus,
    isHadithRead,
    markHadithRead,
    hadithTarget,
  } = useApp();

  const [collection, setCollection] = useState<'nawawi40' | 'hadeethenc'>('nawawi40');
  const [nawawiItems, setNawawiItems] = useState<HadithItem[]>([]);
  const [encItems, setEncItems] = useState<HadithItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string>('nawawi-1');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<'all' | 'sahih' | 'hasan'>('all');

  const [studyMode, setStudyMode] = useState<'read' | 'memorize'>('read');
  const [maskMode, setMaskMode] = useState<MaskMode>('cloze-50');
  const [hideThai, setHideThai] = useState(false);
  const [showEnglish, setShowEnglish] = useState(false);

  // Load Nawawi40 immediately
  useEffect(() => {
    let active = true;
    setLoading(true);
    getNawawi40()
      .then((list) => {
        if (!active) return;
        setNawawiItems(list);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'โหลดฮะดีษนะวาวีย์ไม่สำเร็จ');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Lazy-load HadeethEnc 846 hadiths when switched
  useEffect(() => {
    if (collection !== 'hadeethenc' || encItems !== null) return;
    let active = true;
    setLoading(true);
    getHadeethEncFull()
      .then((list) => {
        if (!active) return;
        setEncItems(list);
        setLoading(false);
        if (!selectedId || selectedId.startsWith('nawawi-')) {
          if (list[0]) setSelectedId(list[0].id);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'โหลดสารานุกรมฮะดีษไม่สำเร็จ');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [collection, encItems, selectedId]);

  useEffect(() => {
    if (hadithTarget) {
      setCollection(hadithTarget.collection);
      setSelectedId(hadithTarget.id);
    }
  }, [hadithTarget]);

  const activeList = useMemo(
    () => (collection === 'nawawi40' ? nawawiItems : encItems ?? []),
    [collection, nawawiItems, encItems]
  );

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeList.filter((item) => {
      if (gradeFilter === 'sahih' && !item.gradeTh.includes('เศาะฮีห')) return false;
      if (gradeFilter === 'hasan' && !item.gradeTh.includes('ฮะซัน')) return false;
      if (!q) return true;
      return (
        String(item.number) === q ||
        item.titleTh.toLowerCase().includes(q) ||
        item.thaiText.toLowerCase().includes(q) ||
        item.arabic.includes(searchQuery.trim())
      );
    });
  }, [activeList, searchQuery, gradeFilter]);

  const currentIdx = filteredList.findIndex((h) => h.id === selectedId);
  const currentItem =
    (currentIdx >= 0 ? filteredList[currentIdx] : filteredList[0]) ?? null;

  const handleCollectionSwitch = (next: 'nawawi40' | 'hadeethenc') => {
    setCollection(next);
    setSearchQuery('');
    if (next === 'nawawi40' && nawawiItems[0]) {
      setSelectedId(nawawiItems[0].id);
    } else if (next === 'hadeethenc' && encItems?.[0]) {
      setSelectedId(encItems[0].id);
    }
  };

  const hifzKey = currentItem ? `hadith:${currentItem.collection}:${currentItem.id}` : '';
  const hifzStatus = hifzKey ? getHifzStatus(hifzKey) : 'none';
  const hadithRead = currentItem
    ? isHadithRead(currentItem.collection, currentItem.id)
    : false;
  const bookmarkId = currentItem ? `hadith:${currentItem.collection}:${currentItem.id}` : '';
  const bookmarked = bookmarkId ? isBookmarked(bookmarkId) : false;

  usePageDwellTracker(
    settings.autoTrackReading && !loading && Boolean(currentItem),
    currentItem ? `hadith:${currentItem.collection}:${currentItem.id}` : null,
    8000,
    () => {
      if (currentItem) markHadithRead(currentItem.collection, currentItem.id);
    }
  );

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Hadith List Sidebar */}
      {sidebarOpen && (
        <aside className="flex w-72 sm:w-80 shrink-0 flex-col border-r border-[var(--border-color)] bg-[var(--bg-surface)]">
          <div className="space-y-2.5 border-b border-[var(--border-color)] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="grid flex-1 grid-cols-2 gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleCollectionSwitch('nawawi40')}
                  className={`min-h-[34px] rounded-lg font-semibold ${
                    collection === 'nawawi40'
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  นะวาวีย์ (42)
                </button>
                <button
                  type="button"
                  onClick={() => handleCollectionSwitch('hadeethenc')}
                  className={`min-h-[34px] rounded-lg font-semibold ${
                    collection === 'hadeethenc'
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  คลังแปลไทย (846)
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] lg:hidden"
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
                placeholder="ค้นหาฮะดีษ (ไทย / อาหรับ)..."
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            {collection === 'hadeethenc' && (
              <div className="flex gap-1 text-[11px]">
                {(
                  [
                    { id: 'all', label: 'ทั้งหมด' },
                    { id: 'sahih', label: 'เศาะฮีหฺ' },
                    { id: 'hasan', label: 'ฮะซัน' },
                  ] as const
                ).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGradeFilter(g.id)}
                    className={`flex-1 rounded-lg border py-1 font-medium ${
                      gradeFilter === g.id
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1">
            {filteredList.slice(0, 250).map((item) => {
              const active = currentItem?.id === item.id;
              const memorized =
                getHifzStatus(`hadith:${item.collection}:${item.id}`) === 'memorized';
              const readDone = isHadithRead(item.collection, item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    if (window.innerWidth < 1024) setSidebarOpen(false);
                  }}
                  className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    active
                      ? 'bg-[var(--accent)] text-white shadow-sm'
                      : 'hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-7 min-w-[28px] shrink-0 items-center justify-center rounded-lg px-1 text-xs font-bold tabular-nums ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {item.collection === 'nawawi40' ? item.number : '#'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-xs font-semibold leading-snug">
                      {item.titleTh}
                    </div>
                    {(memorized || readDone) && (
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold">
                        {memorized && (
                          <span className={active ? 'text-white/90' : 'text-[var(--accent)]'}>
                            ✓ ท่องจำแล้ว
                          </span>
                        )}
                        {readDone && !memorized && (
                          <span className={active ? 'text-white/80' : 'text-[var(--text-muted)]'}>
                            ✓ อ่านแล้ว
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
            {filteredList.length > 250 && (
              <div className="px-3 py-2 text-center text-xs text-[var(--text-muted)]">
                แสดง 250 จาก {filteredList.length} รายการ — พิมพ์คำค้นเพื่อกรองให้แคบลง
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Hadith Reader & Memorizer Pane */}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] bg-[var(--bg-surface)]/80 px-3 sm:px-5 py-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 text-xs font-medium"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">รายการฮะดีษ</span>
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentIdx <= 0}
                onClick={() => {
                  const prev = filteredList[currentIdx - 1];
                  if (prev) setSelectedId(prev.id);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={currentIdx < 0 || currentIdx >= filteredList.length - 1}
                onClick={() => {
                  const next = filteredList[currentIdx + 1];
                  if (next) setSelectedId(next.id);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Read vs Memorize shared engine switch */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="inline-flex rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-0.5">
              <button
                type="button"
                onClick={() => setStudyMode('read')}
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 font-semibold ${
                  studyMode === 'read'
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                อ่านศึกษา
              </button>
              <button
                type="button"
                onClick={() => setStudyMode('memorize')}
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 font-semibold ${
                  studyMode === 'memorize'
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                <Brain className="h-3.5 w-3.5" />
                โหมดท่องจำ (ซ่อนคำ)
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 sm:px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              กำลังโหลดคลังฮะดีษ...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]">
              {error}
            </div>
          ) : currentItem ? (
            <div className="mx-auto max-w-4xl space-y-4">
              {/* Hadith Card */}
              <article className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-lg bg-[var(--accent-soft)] px-2.5 py-0.5 font-bold text-[var(--accent-text)]">
                        {currentItem.collection === 'nawawi40'
                          ? `40 ฮะดีษ นะวาวีย์ • บทที่ ${currentItem.number}`
                          : `HadeethEnc #${currentItem.number}`}
                      </span>
                      {currentItem.gradeTh && (
                        <span className="rounded-lg bg-[var(--gold-soft)] px-2.5 py-0.5 font-medium text-[var(--text-primary)]">
                          {currentItem.gradeTh}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                      {currentItem.titleTh}
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        markHadithRead(currentItem.collection, currentItem.id)
                      }
                      className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold ${
                        hadithRead
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                          : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                      }`}
                    >
                      <Check className="h-4 w-4" />
                      {hadithRead ? 'อ่านแล้ว' : 'บันทึกว่าอ่านแล้ว'}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setHifzStatus(
                          hifzKey,
                          hifzStatus === 'memorized' ? 'none' : 'memorized'
                        )
                      }
                      className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold ${
                        hifzStatus === 'memorized'
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                          : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {hifzStatus === 'memorized' ? 'ท่องจำแล้ว' : 'บันทึกว่าจำได้'}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        toggleBookmark({
                          id: bookmarkId,
                          type: 'hadith',
                          title: currentItem.titleTh,
                          subtitle: currentItem.thaiText.slice(0, 90),
                          hadithId: currentItem.id,
                          collection: currentItem.collection,
                        })
                      }
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                        bookmarked
                          ? 'border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold)]'
                          : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                      }`}
                    >
                      <Bookmark className="h-4 w-4" fill={bookmarked ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>

                {/* Mask mode toolbar when memorizing */}
                {studyMode === 'memorize' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subtle)]/70 p-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {MASK_MODES.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMaskMode(m.id)}
                          className={`min-h-[34px] rounded-lg border px-2.5 text-xs font-semibold ${
                            maskMode === m.id
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                              : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setHideThai((v) => !v)}
                      className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold ${
                        hideThai
                          ? 'border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--text-primary)]'
                          : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {hideThai ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {hideThai ? 'ซ่อนคำแปล' : 'แสดงคำแปล'}
                    </button>
                  </div>
                )}

                {/* Arabic Text / Shared WordMasker */}
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-elevated)]/60 p-4">
                  {studyMode === 'memorize' ? (
                    <WordMasker
                      words={currentItem.words}
                      mode={maskMode}
                      resetKey={currentItem.id}
                      arabicFontSize={settings.arabicFontSize}
                      fontClassName="font-hadith"
                    />
                  ) : (
                    <div
                      dir="rtl"
                      className="font-hadith text-right text-[var(--text-primary)]"
                      style={{ fontSize: `${settings.arabicFontSize}px` }}
                    >
                      {renderHadithArabicWithQuranQuotes(currentItem.arabic)}
                    </div>
                  )}
                </div>

                {/* Thai Translation */}
                {(!hideThai || studyMode === 'read') ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--accent-text)]">
                        คำแปลภาษาไทย
                      </span>
                      {currentItem.englishText && (
                        <button
                          type="button"
                          onClick={() => setShowEnglish((v) => !v)}
                          className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)]"
                        >
                          {showEnglish ? 'ซ่อนภาษาอังกฤษ' : 'แสดงภาษาอังกฤษควบคู่'}
                        </button>
                      )}
                    </div>
                    <p
                      className="font-thai m-0 rounded-xl bg-[var(--bg-subtle)]/55 p-3.5 text-[var(--text-primary)] whitespace-pre-line"
                      style={{ fontSize: `${settings.thaiFontSize}px` }}
                    >
                      {currentItem.thaiText || 'ไม่มีคำแปลภาษาไทยสำหรับรายการนี้'}
                    </p>
                    {showEnglish && currentItem.englishText && (
                      <p className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                        {currentItem.englishText}
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setHideThai(false)}
                    className="w-full rounded-xl border border-dashed border-[var(--border-color)] py-2.5 text-xs font-medium text-[var(--text-muted)] hover:border-[var(--accent)]"
                  >
                    คำแปลถูกซ่อนอยู่ — แตะเพื่อแสดงคำแปลไทย
                  </button>
                )}

                {/* Explanation & Benefits */}
                {currentItem.explanationTh && (
                  <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-soft)]/45 p-4 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--gold)]">
                      <Sparkles className="h-3.5 w-3.5" />
                      คำอธิบายฮะดีษ
                    </div>
                    <p
                      className="font-thai m-0 whitespace-pre-line text-[var(--text-primary)]"
                      style={{ fontSize: `${Math.max(14, settings.thaiFontSize - 1)}px` }}
                    >
                      {currentItem.explanationTh}
                    </p>
                  </div>
                )}

                {currentItem.benefitsTh && (
                  <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-subtle)]/45 p-4 space-y-1.5">
                    <div className="text-xs font-bold text-[var(--accent-text)]">
                      ประโยชน์และบทเรียนที่ได้รับ
                    </div>
                    <p
                      className="font-thai m-0 whitespace-pre-line text-[var(--text-secondary)]"
                      style={{ fontSize: `${Math.max(14, settings.thaiFontSize - 1)}px` }}
                    >
                      {currentItem.benefitsTh}
                    </p>
                  </div>
                )}

                {currentItem.takhrijTh && (
                  <div className="text-xs text-[var(--text-muted)]">
                    <strong>ที่มา (ตัครีจญ์):</strong> {currentItem.takhrijTh}
                  </div>
                )}
              </article>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
