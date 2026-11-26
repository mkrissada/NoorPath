import {
  Award,
  Brain,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Flame,
  Loader2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  athkarItemKey,
  computeAthkarDashboardStats,
  loadAthkarStats,
  recordAthkarTap,
  saveAthkarStats,
  updateAthkarMemoryStatus,
} from '../../lib/athkarStats';
import { getAthkarDataset } from '../../lib/dataLoader';
import type {
  AthkarCategory,
  AthkarDataset,
  AthkarMemoryStatus,
  AthkarStatsState,
} from '../../types/models';
import { WordMasker } from '../shared/WordMasker';

const PREFS_KEY = 'noorpath:athkar-prefs';
const COUNTS_KEY = 'noorpath:athkar-counts';

interface AthkarPrefs {
  selectedCategoryId: string;
  showTransliteration: boolean;
  showTranslation: boolean;
}

const DEFAULT_PREFS: AthkarPrefs = {
  selectedCategoryId: 'sabah',
  showTransliteration: true,
  showTranslation: true,
};

const MEMORY_LEVELS: Array<{
  id: AthkarMemoryStatus;
  label: string;
  activeClass: string;
}> = [
  {
    id: 'learning',
    label: 'กำลังฝึก',
    activeClass:
      'border-[var(--border-color)] bg-[var(--bg-subtle)] text-[var(--text-primary)] font-semibold',
  },
  {
    id: 'review',
    label: 'ทบทวน',
    activeClass:
      'border-[var(--gold)]/60 bg-[var(--gold-soft)] text-[var(--text-primary)] font-semibold',
  },
  {
    id: 'memorized',
    label: 'จำขึ้นใจ',
    activeClass:
      'border-[var(--accent)]/60 bg-[var(--accent-soft)] text-[var(--accent-text)] font-semibold',
  },
];

function loadPrefs(): AthkarPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function loadCounts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(COUNTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function itemKey(categoryId: string, itemId: number): string {
  return `${categoryId}:${itemId}`;
}

export function AthkarView() {
  const { settings, updateSettings } = useApp();
  const [dataset, setDataset] = useState<AthkarDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<AthkarPrefs>(loadPrefs);
  const [counts, setCounts] = useState<Record<string, number>>(loadCounts);
  const [stats, setStats] = useState<AthkarStatsState>(loadAthkarStats);
  const [revealedFullCards, setRevealedFullCards] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    getAthkarDataset()
      .then((data) => {
        if (!active) return;
        setDataset(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'โหลดข้อมูลอัซการไม่สำเร็จ');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage quota errors
    }
  }, [prefs]);

  useEffect(() => {
    try {
      localStorage.setItem(COUNTS_KEY, JSON.stringify(counts));
    } catch {
      // Ignore storage quota errors
    }
  }, [counts]);

  useEffect(() => {
    saveAthkarStats(stats);
  }, [stats]);

  const categories = dataset?.categories ?? [];

  const activeCategory: AthkarCategory | undefined = useMemo(() => {
    return (
      categories.find((c) => c.id === prefs.selectedCategoryId) ?? categories[0]
    );
  }, [categories, prefs.selectedCategoryId]);

  const summaryStats = useMemo(
    () => computeAthkarDashboardStats(stats, dataset),
    [stats, dataset]
  );

  const getRemaining = useCallback(
    (categoryId: string, itemId: number, defaultRepeat: number): number => {
      const key = itemKey(categoryId, itemId);
      const val = counts[key];
      return typeof val === 'number' ? Math.max(0, val) : defaultRepeat;
    },
    [counts]
  );

  const handleDecrement = useCallback(
    (category: AthkarCategory, itemId: number, defaultRepeat: number) => {
      const key = itemKey(category.id, itemId);
      const current =
        typeof counts[key] === 'number' ? counts[key] : defaultRepeat;
      if (current <= 0) return;

      const nextRemaining = current - 1;
      const nextCounts = { ...counts, [key]: nextRemaining };
      setCounts(nextCounts);

      const allCompleted = category.items.every((it) => {
        const k = itemKey(category.id, it.id);
        const rem =
          typeof nextCounts[k] === 'number' ? nextCounts[k] : it.repeat;
        return rem === 0;
      });

      setStats((prev) =>
        recordAthkarTap(prev, category, itemId, nextRemaining, allCompleted)
      );
    },
    [counts]
  );

  const handleResetItem = useCallback(
    (categoryId: string, itemId: number, defaultRepeat: number) => {
      const key = itemKey(categoryId, itemId);
      setCounts((prev) => ({ ...prev, [key]: defaultRepeat }));
    },
    []
  );

  const handleResetCategory = useCallback((category: AthkarCategory) => {
    setCounts((prev) => {
      const next = { ...prev };
      for (const item of category.items) {
        next[itemKey(category.id, item.id)] = item.repeat;
      }
      return next;
    });
  }, []);

  const handleMemoryStatusChange = useCallback(
    (categoryId: string, itemId: number, status: AthkarMemoryStatus) => {
      setStats((prev) => updateAthkarMemoryStatus(prev, categoryId, itemId, status));
      const k = athkarItemKey(categoryId, itemId);
      setRevealedFullCards((prev) => ({ ...prev, [k]: false }));
    },
    []
  );

  const adjustArabicSize = (delta: number) => {
    const next = Math.max(20, Math.min(48, settings.arabicFontSize + delta));
    updateSettings({ arabicFontSize: next });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-[var(--text-secondary)]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-[var(--accent)]" />
        <span>กำลังโหลดบทอัซการ...</span>
      </div>
    );
  }

  if (error || !dataset || !activeCategory) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center">
        <div className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-6 text-sm text-[var(--danger)]">
          {error ?? 'ไม่พบข้อมูลอัซการ'}
        </div>
      </div>
    );
  }

  const completedCount = activeCategory.items.filter(
    (item) => getRemaining(activeCategory.id, item.id, item.repeat) === 0
  ).length;
  const totalCount = activeCategory.items.length;
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const categoryDone = totalCount > 0 && completedCount === totalCount;

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      {/* Category Selector */}
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="หมวดหมู่อัซการ"
      >
        {categories.map((cat) => {
          const selected = cat.id === activeCategory.id;
          const catDone = cat.items.filter(
            (i) => getRemaining(cat.id, i.id, i.repeat) === 0
          ).length;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() =>
                setPrefs((p) => ({ ...p, selectedCategoryId: cat.id }))
              }
              className={`flex min-h-[48px] shrink-0 items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-left transition-all ${
                selected
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-sm'
                  : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight">
                  {cat.title_th}
                </div>
                <div
                  className={`font-hadith text-xs leading-tight ${
                    selected ? 'text-white/85' : 'text-[var(--text-muted)]'
                  }`}
                  dir="rtl"
                >
                  {cat.title_ar}
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                  selected
                    ? 'bg-white/20 text-white'
                    : catDone === cat.items.length && cat.items.length > 0
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                }`}
              >
                {catDone}/{cat.items.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Category Header + Reader Controls */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {activeCategory.title_th}
              </h2>
              <span
                className="font-hadith text-base text-[var(--accent-text)]"
                dir="rtl"
              >
                {activeCategory.title_ar}
              </span>
            </div>
            <p className="mt-0.5 text-xs sm:text-sm text-[var(--text-secondary)]">
              {activeCategory.description}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Compact Streak & Today Pill */}
            <div className="hidden sm:flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs">
              <Flame className="h-3.5 w-3.5 text-[var(--gold)]" />
              <span className="font-semibold tabular-nums text-[var(--text-primary)]">
                {summaryStats.currentStreak} วัน
              </span>
              <span className="text-[var(--text-muted)]">•</span>
              <span className="tabular-nums text-[var(--text-secondary)]">
                วันนี้ {summaryStats.todayTapCount} รอบ
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleResetCategory(activeCategory)}
              className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] active:scale-[0.98]"
              title="รีเซ็ตตัวนับทั้งหมดในหมวดนี้"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>รีเซ็ตหมวดนี้</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>
              ความคืบหน้า: {completedCount} จาก {totalCount} บท
            </span>
            <span className="font-semibold tabular-nums text-[var(--accent-text)]">
              {progressPct}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {categoryDone && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-3.5 py-2 text-xs font-semibold text-[var(--accent-text)]">
            <Award className="h-4 w-4 shrink-0" />
            <span>
              อัลฮัมดุลิลลาฮ์! อ่านหมวด {activeCategory.title_th} ครบ 100% แล้ว และบันทึกสถิติวันนี้เรียบร้อย
            </span>
          </div>
        )}

        {/* Reader Controls Toolbar */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-color)] pt-3">
          {/* Arabic Font Size */}
          <div className="flex items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => adjustArabicSize(-2)}
              className="min-h-[36px] min-w-[38px] px-2 font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              aria-label="ลดขนาดตัวอักษรอาหรับ"
            >
              A-
            </button>
            <span className="px-1.5 text-[11px] tabular-nums text-[var(--text-muted)]">
              {settings.arabicFontSize}px
            </span>
            <button
              type="button"
              onClick={() => adjustArabicSize(2)}
              className="min-h-[36px] min-w-[38px] px-2 font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              aria-label="เพิ่มขนาดตัวอักษรอาหรับ"
            >
              A+
            </button>
          </div>

          {/* Toggle Transliteration */}
          <button
            type="button"
            onClick={() =>
              setPrefs((p) => ({
                ...p,
                showTransliteration: !p.showTransliteration,
              }))
            }
            className={`flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
              prefs.showTransliteration
                ? 'border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent-text)]'
                : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-muted)]'
            }`}
          >
            {prefs.showTransliteration ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
            <span>คำอ่านไทย</span>
          </button>

          {/* Toggle Translation */}
          <button
            type="button"
            onClick={() =>
              setPrefs((p) => ({
                ...p,
                showTranslation: !p.showTranslation,
              }))
            }
            className={`flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
              prefs.showTranslation
                ? 'border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent-text)]'
                : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-muted)]'
            }`}
          >
            {prefs.showTranslation ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
            <span>คำแปลไทย</span>
          </button>
        </div>
      </div>

      {/* Athkar Cards List */}
      <div className="space-y-4 pb-6">
        {activeCategory.items.map((item, idx) => {
          const remaining = getRemaining(
            activeCategory.id,
            item.id,
            item.repeat
          );
          const isDone = remaining === 0;
          const k = athkarItemKey(activeCategory.id, item.id);
          const readCount = stats.readCounts[k] ?? 0;
          const memStatus: AthkarMemoryStatus =
            stats.memoryStatus[k] ?? 'learning';
          const forceFullText = Boolean(revealedFullCards[k]);
          const isMaskActive =
            !forceFullText &&
            (memStatus === 'review' || memStatus === 'memorized');

          const arabicWords = item.arabic.split(/\s+/).filter(Boolean);

          return (
            <article
              key={`${activeCategory.id}-${item.id}`}
              className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-[var(--shadow-card)] ${
                isDone
                  ? 'border-[var(--accent)]/50 bg-[var(--accent-soft)]/30 opacity-85'
                  : 'border-[var(--border-color)] bg-[var(--bg-surface)]'
              }`}
            >
              {/* Card Header */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-lg bg-[var(--bg-subtle)] px-1.5 text-xs font-bold tabular-nums text-[var(--text-secondary)]">
                      {idx + 1}
                    </span>
                    {item.title_th && (
                      <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                        {item.title_th}
                      </h3>
                    )}
                    {isDone && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent-text)]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        เสร็จสิ้น
                      </span>
                    )}
                    {readCount > 0 && (
                      <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--text-muted)]">
                        อ่านครบ {readCount} ครั้ง
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {/* 3-level Self-Rating Toggle */}
                  <div
                    className="inline-flex items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-0.5"
                    role="group"
                    aria-label="ระดับการท่องจำ"
                  >
                    {MEMORY_LEVELS.map((lvl) => {
                      const active = memStatus === lvl.id;
                      return (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() =>
                            handleMemoryStatusChange(
                              activeCategory.id,
                              item.id,
                              lvl.id
                            )
                          }
                          className={`min-h-[30px] rounded-lg border border-transparent px-2 py-1 text-[11px] transition-colors ${
                            active
                              ? lvl.activeClass
                              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {lvl.label}
                        </button>
                      );
                    })}
                  </div>

                  {remaining < item.repeat && (
                    <button
                      type="button"
                      onClick={() =>
                        handleResetItem(activeCategory.id, item.id, item.repeat)
                      }
                      className="flex min-h-[34px] shrink-0 items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      title="รีเซ็ตบทนี้"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>เริ่มใหม่</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Memory Mode Banner when reviewing or memorized */}
              {(memStatus === 'review' || memStatus === 'memorized') && (
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--bg-subtle)]/60 px-3 py-1.5 text-[11px] text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5 text-[var(--gold)]" />
                    {memStatus === 'review'
                      ? 'โหมดทบทวน: ซ่อนคำบางส่วน (แตะที่คำเพื่อดูเฉลย)'
                      : 'โหมดจำขึ้นใจ: ซ่อนตัวบทเพื่อทดสอบความจำ'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setRevealedFullCards((prev) => ({
                        ...prev,
                        [k]: !forceFullText,
                      }))
                    }
                    className="font-semibold text-[var(--accent-text)] hover:underline"
                  >
                    {forceFullText ? 'กลับสู่โหมดทดสอบ' : 'แสดงตัวบทเต็ม'}
                  </button>
                </div>
              )}

              {/* Arabic Text */}
              {isMaskActive ? (
                <div className="mt-3 rounded-xl bg-[var(--bg-elevated)]/60 p-3.5 sm:p-4">
                  <WordMasker
                    words={arabicWords}
                    mode={memStatus === 'review' ? 'cloze-50' : 'hidden'}
                    resetKey={`${k}-${memStatus}`}
                    arabicFontSize={settings.arabicFontSize}
                    fontClassName={item.is_quran ? 'font-arabic' : 'font-hadith'}
                  />
                </div>
              ) : (
                <div
                  onClick={() =>
                    handleDecrement(activeCategory, item.id, item.repeat)
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleDecrement(activeCategory, item.id, item.repeat);
                    }
                  }}
                  aria-label={`แตะเพื่อนับ ${item.title_th || 'บทอัซการ'} เหลือ ${remaining} ครั้ง`}
                  className="mt-3 cursor-pointer select-none rounded-xl bg-[var(--bg-elevated)]/60 p-3.5 sm:p-4 transition-colors active:bg-[var(--bg-subtle)]"
                >
                  <p
                    dir="rtl"
                    lang="ar"
                    className={`${
                      item.is_quran ? 'font-arabic' : 'font-hadith'
                    } whitespace-pre-line text-right text-[var(--text-primary)]`}
                    style={{ fontSize: `${settings.arabicFontSize}px` }}
                  >
                    {item.arabic}
                  </p>
                </div>
              )}

              {/* Transliteration */}
              {prefs.showTransliteration &&
                item.transliteration &&
                !isMaskActive && (
                  <div className="mt-3 rounded-xl border border-[var(--border-color)]/60 bg-[var(--bg-subtle)]/40 px-3.5 py-2.5">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      คำอ่าน
                    </div>
                    <p className="whitespace-pre-line text-sm sm:text-[15px] leading-relaxed text-[var(--text-secondary)]">
                      {item.transliteration}
                    </p>
                  </div>
                )}

              {/* Thai Translation */}
              {prefs.showTranslation && item.translation_th && (
                <div className="mt-2.5 px-1">
                  <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    ความหมาย
                  </div>
                  <p className="whitespace-pre-line text-sm sm:text-[15px] leading-relaxed text-[var(--text-primary)]">
                    {item.translation_th}
                  </p>
                </div>
              )}

              {/* Virtue + Reference + Tap-to-Count Button */}
              <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border-color)] pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1 text-xs text-[var(--text-muted)]">
                  {item.virtue && (
                    <p className="leading-relaxed text-[var(--text-secondary)]">
                      <span className="font-semibold text-[var(--gold)]">
                        อานิสงส์ / หมายเหตุ:{' '}
                      </span>
                      {item.virtue}
                    </p>
                  )}
                  {item.reference && <p>{item.reference}</p>}
                </div>

                {/* Touch-friendly Tap-to-Count Button */}
                <button
                  type="button"
                  onClick={() =>
                    handleDecrement(activeCategory, item.id, item.repeat)
                  }
                  disabled={isDone}
                  className={`flex min-h-[52px] min-w-[136px] shrink-0 items-center justify-center gap-2.5 rounded-2xl px-5 py-2.5 text-sm font-bold transition-all active:scale-95 ${
                    isDone
                      ? 'cursor-default border border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent-text)]'
                      : 'bg-[var(--accent)] text-white shadow-sm hover:bg-[var(--accent-hover)]'
                  }`}
                >
                  {isDone ? (
                    <>
                      <Check className="h-5 w-5" />
                      <span>ครบ {item.repeat} ครั้ง</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xl tabular-nums leading-none">
                        {remaining}
                      </span>
                      <span className="text-xs font-medium opacity-85">
                        / {item.repeat} ครั้ง
                      </span>
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
