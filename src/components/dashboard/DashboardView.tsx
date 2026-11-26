import {
  Award,
  BookCheck,
  BookOpen,
  BookText,
  Bookmark,
  Brain,
  CheckCircle2,
  Cloud,
  CloudOff,
  Flame,
  Headphones,
  Layers,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Settings,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  computeAthkarDashboardStats,
  loadAthkarStats,
} from '../../lib/athkarStats';
import {
  getAthkarDataset,
  getAudioCatalog,
  getHadeethEncIndex,
  getNawawi40,
} from '../../lib/dataLoader';
import { computeContentStats, computePersonalStats } from '../../lib/stats';
import type { AthkarDataset } from '../../types/models';

type DashboardSegment = 'overview' | 'quran' | 'athkar';

type SurahGridFilter =
  | 'all'
  | 'juz30'
  | 'read_done'
  | 'mem_done'
  | 'in_progress'
  | 'not_started';

function ProgressRing({
  percent,
  colorVar,
  label,
  sublabel,
}: {
  percent: number;
  colorVar: string;
  label: string;
  sublabel: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  return (
    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="var(--bg-subtle)"
          strokeWidth="7"
        />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={colorVar}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-sm font-bold tabular-nums text-[var(--text-primary)]">
          {label}
        </span>
        <span className="text-[10px] text-[var(--text-muted)]">{sublabel}</span>
      </div>
    </div>
  );
}

export function DashboardView() {
  const {
    surahsIndex,
    mushafPages,
    juzIndex,
    readingLog,
    hifzProgress,
    bookmarks,
    lastRead,
    mushafPage,
    jumpToReader,
    jumpToMushaf,
    jumpToHadith,
    setActiveTab,
    completeKhatmAndReset,
    syncConfig,
    syncState,
    syncNow,
  } = useApp();

  const [catalogCounts, setCatalogCounts] = useState({
    nawawiCount: 42,
    hadeethEncCount: 846,
    recitersCount: 5,
    sheikhCoveredSurahs: 91,
    sheikhTotalTracks: 103,
  });
  const [segment, setSegment] = useState<DashboardSegment>('overview');
  const [athkarDataset, setAthkarDataset] = useState<AthkarDataset | null>(null);
  const [athkarStatsState] = useState(loadAthkarStats);
  const [surahFilter, setSurahFilter] = useState<SurahGridFilter>('all');
  const [confirmKhatm, setConfirmKhatm] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      getNawawi40().catch(() => []),
      getHadeethEncIndex().catch(() => []),
      getAudioCatalog().catch(() => null),
      getAthkarDataset().catch(() => null),
    ]).then(([nawawi, encIdx, audio, athkar]) => {
      if (!active) return;
      setAthkarDataset(athkar);
      setCatalogCounts({
        nawawiCount: nawawi.length || 42,
        hadeethEncCount: encIdx.length || 846,
        recitersCount: audio?.reciters.length || 5,
        sheikhCoveredSurahs: audio?.sheikhManifest.coveredSurahsCount || 91,
        sheikhTotalTracks: audio?.sheikhManifest.totalTracksCount || 103,
      });
    });
    return () => {
      active = false;
    };
  }, []);

  const athkarStats = useMemo(
    () => computeAthkarDashboardStats(athkarStatsState, athkarDataset),
    [athkarStatsState, athkarDataset]
  );

  const contentStats = useMemo(
    () =>
      computeContentStats({
        surahsIndex,
        mushafPagesCount: mushafPages.length || 604,
        juzCount: juzIndex.length || 30,
        ...catalogCounts,
      }),
    [surahsIndex, mushafPages.length, juzIndex.length, catalogCounts]
  );

  const personal = useMemo(
    () =>
      computePersonalStats({
        readingLog,
        hifzProgress,
        surahsIndex,
        mushafPages,
        juzIndex,
        bookmarks,
      }),
    [readingLog, hifzProgress, surahsIndex, mushafPages, juzIndex, bookmarks]
  );

  const filteredSurahs = useMemo(() => {
    return personal.perSurah.filter((s) => {
      if (surahFilter === 'juz30') return s.number >= 78;
      if (surahFilter === 'read_done') return s.isFullyRead;
      if (surahFilter === 'mem_done') return s.isFullyMemorized;
      if (surahFilter === 'in_progress') {
        return (
          !s.isFullyMemorized &&
          (s.readCount > 0 ||
            s.memorizedCount > 0 ||
            s.learningCount > 0 ||
            s.reviewCount > 0)
        );
      }
      if (surahFilter === 'not_started') {
        return (
          s.readCount === 0 &&
          s.memorizedCount === 0 &&
          s.learningCount === 0 &&
          s.reviewCount === 0
        );
      }
      return true;
    });
  }, [personal.perSurah, surahFilter]);

  const maxDailyCount = useMemo(
    () => Math.max(1, ...personal.dailySeries.map((d) => d.count)),
    [personal.dailySeries]
  );

  const lastReadSurahMeta = surahsIndex.find((s) => s.number === lastRead.surah);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 sm:px-6 py-5">
      {/* Top Segmented Control */}
      <div
        className="flex flex-wrap items-center justify-between gap-3"
        role="tablist"
        aria-label="มุมมองสถิติ"
      >
        <div className="inline-flex w-full sm:w-auto rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-card)]">
          {(
            [
              { id: 'overview', label: 'ภาพรวมทั้งหมด' },
              { id: 'quran', label: 'อัลกุรอาน' },
              { id: 'athkar', label: 'อัซการ & การท่องจำ' },
            ] as const
          ).map((tab) => {
            const active = segment === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSegment(tab.id)}
                className={`flex-1 sm:flex-initial min-h-[40px] rounded-xl px-4 py-1.5 text-xs sm:text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sync Status Banner (Overview) */}
      {segment === 'overview' && (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              syncConfig.enabled
                ? syncState.status === 'error'
                  ? 'bg-[var(--danger-soft)] text-[var(--danger)]'
                  : 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
            }`}
          >
            {syncState.status === 'offline' ? (
              <CloudOff className="h-4 w-4" />
            ) : (
              <Cloud className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[var(--text-primary)]">
              {syncConfig.enabled
                ? `ซิงก์ผ่าน Google Sheets (${syncConfig.deviceName})`
                : 'ซิงก์ข้ามอุปกรณ์ (Google Sheets) — ยังไม่ได้ตั้งค่า'}
            </div>
            <div className="truncate text-[11px] text-[var(--text-muted)]">
              {syncConfig.enabled ? (
                syncState.lastError ? (
                  <span className="text-[var(--danger)]">{syncState.lastError}</span>
                ) : (
                  <>
                    ซิงก์ล่าสุด:{' '}
                    {syncState.lastSyncedAt > 0
                      ? new Date(syncState.lastSyncedAt).toLocaleString('th-TH')
                      : 'ยังไม่เคยซิงก์'}
                    {syncState.pendingCount > 0
                      ? ` • รอส่ง ${syncState.pendingCount} รายการ`
                      : ''}
                  </>
                )
              ) : (
                'เชื่อมต่อ Google Sheet เพื่อรวมสถิติและบุ๊กมาร์กจาก iPad และอุปกรณ์อื่น'
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {syncConfig.enabled ? (
            <button
              type="button"
              disabled={syncState.status === 'syncing'}
              onClick={() => void syncNow()}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  syncState.status === 'syncing' ? 'animate-spin' : ''
                }`}
              />
              {syncState.status === 'syncing' ? 'กำลังซิงก์...' : 'ซิงก์ตอนนี้'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)]"
            >
              <Settings className="h-3.5 w-3.5 text-[var(--accent)]" />
              ตั้งค่าซิงก์
            </button>
          )}
        </div>
      </section>
      )}

      {/* Section 1: App Content Overview */}
      {segment === 'overview' && (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
            <Layers className="h-4 w-4 text-[var(--accent)]" />
            ข้อมูลคลังเนื้อหาในเว็บ
          </h2>
          <span className="text-xs text-[var(--text-muted)]">
            พร้อมใช้งานแบบ Offline ในแอป
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)]">
              <span>อัลกุรอานทั้งหมด</span>
              <BookOpen className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
              {contentStats.totalSurahs} ซูเราะฮ์
            </div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">
              {contentStats.totalAyahs.toLocaleString()} อายะฮ์ • มักกียะฮ์{' '}
              {contentStats.meccanSurahs} / มะดะนียะฮ์ {contentStats.medinanSurahs}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)]">
              <span>มุศฮัฟและคำแปลไทย</span>
              <BookText className="h-4 w-4 text-[var(--gold)]" />
            </div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
              {contentStats.totalMushafPages} หน้า
            </div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">
              {contentStats.totalJuz} ญุซอ์ • คำแปลไทย {contentStats.thaiTranslationsCount} สำนวน + ตัฟซีรมุคตะศ็อร
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)]">
              <span>คลังฮะดีษ</span>
              <ScrollText className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
              {contentStats.totalHadith.toLocaleString()} บท
            </div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">
              นะวาวีย์ {contentStats.nawawiCount} บท • HadeethEnc ไทย{' '}
              {contentStats.hadeethEncCount} บท
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)]">
              <span>คลังเสียงอ่าน</span>
              <Headphones className="h-4 w-4 text-[var(--gold)]" />
            </div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
              {contentStats.recitersCount} นักอ่าน
            </div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">
              เชค อับดุลลอฮ์ {contentStats.sheikhCoveredSurahs}/114 ซูเราะฮ์ (
              {contentStats.sheikhTotalTracks} ไฟล์)
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Section: Athkar & Memorization Dashboard */}
      {segment === 'athkar' && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
              <Sparkles className="h-4 w-4 text-[var(--accent)]" />
              สถิติอัซการและการท่องจำ
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab('athkar')}
              className="rounded-xl bg-[var(--accent-soft)] px-3.5 py-2 text-xs font-semibold text-[var(--accent-text)] hover:opacity-90"
            >
              ไปหน้าอัซการ →
            </button>
          </div>

          {/* 3 KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* KPI 1: Streak */}
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)]">
                <span>ต่อเนื่อง (Streak)</span>
                <Flame className="h-5 w-5 text-[var(--gold)]" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tabular-nums text-[var(--text-primary)]">
                  {athkarStats.currentStreak}
                </span>
                <span className="text-sm font-semibold text-[var(--text-secondary)]">
                  วัน
                </span>
              </div>
              <div className="mt-1.5 text-xs text-[var(--text-muted)]">
                สถิติสูงสุด {athkarStats.longestStreak} วันติดกัน
              </div>
            </div>

            {/* KPI 2: Memorized */}
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)]">
                <span>จำได้แล้ว (Memorized)</span>
                <Brain className="h-5 w-5 text-[var(--accent)]" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tabular-nums text-[var(--accent-text)]">
                  {athkarStats.memorizedCount}
                </span>
                <span className="text-sm font-medium text-[var(--text-muted)]">
                  / {athkarStats.totalItems} บท
                </span>
              </div>
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                  style={{ width: `${athkarStats.memorizedPercent}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>ทบทวน {athkarStats.reviewingCount} • กำลังฝึก {athkarStats.learningCount}</span>
                <span className="font-semibold tabular-nums text-[var(--accent-text)]">
                  {athkarStats.memorizedPercent}%
                </span>
              </div>
            </div>

            {/* KPI 3: Today's Taps */}
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)]">
                <span>รอบที่กล่าววันนี้</span>
                <Sparkles className="h-5 w-5 text-[var(--gold)]" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tabular-nums text-[var(--text-primary)]">
                  {athkarStats.todayTapCount.toLocaleString()}
                </span>
                <span className="text-sm font-semibold text-[var(--text-secondary)]">
                  ครั้ง
                </span>
              </div>
              <div className="mt-1.5 text-xs text-[var(--text-muted)]">
                นับอัตโนมัติจากการแตะ Tap-to-Count
              </div>
            </div>
          </div>

          {/* Weekly Habit Tracker (Monday - Sunday) */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                ตารางความสม่ำเสมอรายสัปดาห์ (จันทร์ – อาทิตย์)
              </h3>
              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-1">
                  <Sun className="h-3.5 w-3.5 text-[var(--gold)]" />
                  ช่วงเช้า
                </span>
                <span className="inline-flex items-center gap-1">
                  <Moon className="h-3.5 w-3.5 text-[var(--accent)]" />
                  ช่วงเย็น
                </span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {athkarStats.weeklyHabit.map((day) => (
                <div
                  key={day.dateKey}
                  title={`${day.dayFull} (${day.dateKey}): ${day.tapCount} รอบ`}
                  className={`flex flex-col items-center justify-between gap-2 rounded-xl border p-2.5 text-center transition-colors ${
                    day.isToday
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)]/30'
                      : 'border-[var(--border-color)] bg-[var(--bg-elevated)]'
                  } ${day.isFuture ? 'opacity-50' : ''}`}
                >
                  <div>
                    <div
                      className={`text-xs font-bold ${
                        day.isToday
                          ? 'text-[var(--accent-text)]'
                          : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {day.dayShort}
                    </div>
                    <div className="text-[10px] tabular-nums text-[var(--text-muted)]">
                      {day.dateNum}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs ${
                        day.sabahCompleted
                          ? 'border-[var(--gold)]/50 bg-[var(--gold-soft)] text-[var(--gold)]'
                          : 'border-[var(--border-color)]/60 bg-[var(--bg-subtle)]/50 text-[var(--text-muted)]/40'
                      }`}
                      title={day.sabahCompleted ? 'อัซการยามเช้าครบ 100%' : 'ยังไม่ครบช่วงเช้า'}
                    >
                      ☀️
                    </div>
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs ${
                        day.masaaCompleted
                          ? 'border-[var(--accent)]/50 bg-[var(--accent-soft)] text-[var(--accent-text)]'
                          : 'border-[var(--border-color)]/60 bg-[var(--bg-subtle)]/50 text-[var(--text-muted)]/40'
                      }`}
                      title={day.masaaCompleted ? 'อัซการยามเย็นครบ 100%' : 'ยังไม่ครบช่วงเย็น'}
                    >
                      🌙
                    </div>
                  </div>

                  <div className="text-[10px] tabular-nums text-[var(--text-muted)]">
                    {day.tapCount > 0 ? `${day.tapCount}` : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category Mastery */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                ความคืบหน้าการท่องจำแยกตามหมวด (Category Mastery)
              </h3>
              <span className="text-xs text-[var(--text-muted)]">
                คิดจากบทที่ตั้งสถานะ “จำขึ้นใจ”
              </span>
            </div>

            <div className="space-y-3">
              {athkarStats.categoryMastery.map((cat) => (
                <div
                  key={cat.id}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-bold text-[var(--text-primary)]">
                        {cat.title_th}
                      </span>
                      <span
                        className="font-hadith text-xs text-[var(--text-muted)]"
                        dir="rtl"
                      >
                        {cat.title_ar}
                      </span>
                      {cat.completedToday && (
                        <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-text)]">
                          ✓ ครบวันนี้แล้ว
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs tabular-nums">
                      <span className="text-[var(--text-muted)]">
                        จำได้ {cat.memorizedCount}/{cat.totalItems} บท
                        {cat.reviewingCount > 0 ? ` • ทบทวน ${cat.reviewingCount}` : ''}
                      </span>
                      <span className="font-bold text-[var(--accent-text)]">
                        {cat.masteryPercent}%
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                      style={{ width: `${cat.masteryPercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Section 2: Personal Progress (Overview & Quran) */}
      {(segment === 'overview' || segment === 'quran') && (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
            <Award className="h-4 w-4 text-[var(--accent)]" />
            สถิติส่วนตัวของคุณ
          </h2>
          <span className="text-xs text-[var(--text-muted)]">
            รวมข้อมูลจากอุปกรณ์นี้และที่ซิงก์ไว้
          </span>
        </div>

        {/* Quick Resume Row */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)]">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[var(--text-muted)]">
                อ่านล่าสุด (หน้าคำแปล)
              </div>
              <div className="mt-0.5 truncate text-sm font-bold text-[var(--text-primary)]">
                {lastReadSurahMeta
                  ? `${lastRead.surah}. ${lastReadSurahMeta.nameTh} (${lastReadSurahMeta.nameEn})`
                  : `ซูเราะฮ์ที่ ${lastRead.surah}`}{' '}
                • อายะฮ์ {lastRead.ayah}
              </div>
            </div>
            <button
              type="button"
              onClick={() => jumpToReader(lastRead.surah, lastRead.ayah)}
              className="shrink-0 rounded-xl bg-[var(--accent-soft)] px-3.5 py-2 text-xs font-semibold text-[var(--accent-text)] hover:opacity-90"
            >
              อ่านต่อ →
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)]">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[var(--text-muted)]">
                หน้ามุศฮัฟล่าสุด (อาหรับล้วน)
              </div>
              <div className="mt-0.5 truncate text-sm font-bold text-[var(--text-primary)]">
                หน้า {mushafPage.page} / 604
              </div>
            </div>
            <button
              type="button"
              onClick={() => jumpToMushaf({ page: mushafPage.page })}
              className="shrink-0 rounded-xl bg-[var(--gold-soft)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:opacity-90"
            >
              เปิดมุศฮัฟ →
            </button>
          </div>
        </div>

        {/* Reading, Hifz & Streak Summary Row */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Reading Card */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] flex flex-col justify-between gap-4">
            <div className="flex items-center gap-4">
              <ProgressRing
                percent={personal.ayahsReadPercent}
                colorVar="var(--accent)"
                label={`${personal.ayahsReadPercent}%`}
                sublabel="อ่านแล้ว"
              />
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-primary)]">
                  <BookCheck className="h-4 w-4 text-[var(--accent)]" />
                  ความคืบหน้าการอ่าน
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  <strong>{personal.ayahsReadCount.toLocaleString()}</strong> /{' '}
                  {contentStats.totalAyahs.toLocaleString()} อายะฮ์
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  อ่านครบ <strong>{personal.surahsCompletedRead}</strong> / 114 ซูเราะฮ์ •{' '}
                  <strong>{personal.mushafPagesCompleted}</strong> / 604 หน้า
                </div>
                <div className="text-xs font-semibold text-[var(--gold)]">
                  จบคอตัมแล้ว {personal.khatmCount} รอบ
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--border-color)] pt-3">
              {!confirmKhatm ? (
                <button
                  type="button"
                  onClick={() => setConfirmKhatm(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)]"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-[var(--accent)]" />
                  บันทึกจบคอตัม & เริ่มรอบใหม่
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-[var(--text-secondary)]">
                    ยืนยันเพิ่มสถิติคอตัมเป็น {personal.khatmCount + 1} รอบ และเริ่มนับอายะฮ์รอบใหม่?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      completeKhatmAndReset();
                      setConfirmKhatm(false);
                    }}
                    className="rounded-lg bg-[var(--accent)] px-2.5 py-1 font-semibold text-white"
                  >
                    ยืนยัน
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmKhatm(false)}
                    className="rounded-lg border border-[var(--border-color)] px-2.5 py-1 font-medium text-[var(--text-secondary)]"
                  >
                    ยกเลิก
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Hifz Card */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] flex flex-col justify-between gap-4">
            <div className="flex items-center gap-4">
              <ProgressRing
                percent={personal.memorizedPercent}
                colorVar="var(--gold)"
                label={`${personal.memorizedPercent}%`}
                sublabel="จำได้แล้ว"
              />
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-primary)]">
                  <Brain className="h-4 w-4 text-[var(--gold)]" />
                  ความคืบหน้าท่องจำ (Hifz)
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  จำแม่นแล้ว <strong>{personal.memorizedAyahs.toLocaleString()}</strong> /{' '}
                  {contentStats.totalAyahs.toLocaleString()} อายะฮ์
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  จำครบทั้งซูเราะฮ์ <strong>{personal.surahsFullyMemorized}</strong> / 114 ซูเราะฮ์
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  เริ่มท่องจำแล้ว {personal.startedSurahs} ซูเราะฮ์
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[var(--border-color)] pt-3 text-center text-xs">
              <div className="rounded-xl bg-[var(--accent-soft)]/70 p-2">
                <div className="font-bold tabular-nums text-[var(--accent-text)]">
                  {personal.memorizedAyahs}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">จำแม่นแล้ว</div>
              </div>
              <div className="rounded-xl bg-[var(--gold-soft)]/80 p-2">
                <div className="font-bold tabular-nums text-[var(--text-primary)]">
                  {personal.learningAyahs}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">กำลังท่อง</div>
              </div>
              <div className="rounded-xl bg-[var(--danger-soft)]/80 p-2">
                <div className="font-bold tabular-nums text-[var(--danger)]">
                  {personal.reviewAyahs}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">ต้องทบทวน</div>
              </div>
            </div>
          </div>

          {/* Streak & 14-day Activity Card */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] flex flex-col justify-between gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-primary)]">
                  <Flame className="h-4 w-4 text-[var(--gold)]" />
                  ความต่อเนื่อง (Streak)
                </div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">
                  วันนี้อ่านแล้ว <strong>{personal.todayCount}</strong> อายะฮ์ • สูงสุด{' '}
                  <strong>{personal.longestStreak}</strong> วัน
                </div>
              </div>
              <div className="rounded-xl bg-[var(--gold-soft)] px-3 py-1.5 text-center">
                <div className="text-lg font-bold tabular-nums leading-tight text-[var(--text-primary)]">
                  {personal.currentStreak}
                </div>
                <div className="text-[10px] font-semibold text-[var(--text-secondary)]">
                  วันติดกัน
                </div>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex justify-between text-[10px] text-[var(--text-muted)]">
                <span>สถิติ 14 วันล่าสุด (รวมทุกอุปกรณ์)</span>
                <span>รวม {personal.totalActiveDays} วันที่อ่าน</span>
              </div>
              <div className="flex h-20 items-end gap-1 rounded-xl bg-[var(--bg-subtle)]/50 px-2 pt-2 pb-1.5">
                {personal.dailySeries.map((pt) => {
                  const pct =
                    pt.count > 0 ? Math.max(12, Math.round((pt.count / maxDailyCount) * 100)) : 4;
                  return (
                    <div
                      key={pt.dateKey}
                      className="group flex flex-1 flex-col items-center justify-end gap-1 h-full"
                      title={`${pt.label}: ${pt.count} อายะฮ์`}
                    >
                      <div
                        className={`w-full rounded-t transition-all ${
                          pt.count > 0
                            ? 'bg-[var(--accent)]'
                            : 'bg-[var(--border-color)]/70'
                        }`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[var(--text-muted)]">
                <span>{personal.dailySeries[0]?.label}</span>
                <span>วันนี้</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hadith & Bookmarks Row (Overview only) */}
        {segment === 'overview' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                <ScrollText className="h-4 w-4 text-[var(--accent)]" />
                สถิติฮะดีษส่วนตัว
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('hadith')}
                className="text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                ไปหน้าฮะดีษ →
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-[var(--bg-subtle)]/60 p-3">
                <div className="text-[var(--text-muted)]">อ่านแล้ว</div>
                <div className="mt-0.5 text-lg font-bold tabular-nums text-[var(--text-primary)]">
                  {personal.hadith.totalRead}{' '}
                  <span className="text-xs font-normal text-[var(--text-muted)]">
                    / {contentStats.totalHadith}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                  นะวาวีย์ {personal.hadith.nawawiRead}/{contentStats.nawawiCount} • HadeethEnc{' '}
                  {personal.hadith.encRead}/{contentStats.hadeethEncCount}
                </div>
              </div>

              <div className="rounded-xl bg-[var(--bg-subtle)]/60 p-3">
                <div className="text-[var(--text-muted)]">จำได้แล้ว</div>
                <div className="mt-0.5 text-lg font-bold tabular-nums text-[var(--accent-text)]">
                  {personal.hadith.totalMemorized}{' '}
                  <span className="text-xs font-normal text-[var(--text-muted)]">
                    / {contentStats.totalHadith}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                  นะวาวีย์ {personal.hadith.nawawiMemorized}/{contentStats.nawawiCount} • กำลังท่อง{' '}
                  {personal.hadith.learning}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                <Bookmark className="h-4 w-4 text-[var(--gold)]" />
                บุ๊กมาร์กที่บันทึกไว้
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                ดูทั้งหมด →
              </button>
            </div>
            {bookmarks.length === 0 ? (
              <div className="rounded-xl bg-[var(--bg-subtle)]/50 p-3 text-xs text-[var(--text-muted)]">
                ยังไม่มีบุ๊กมาร์ก ({personal.bookmarks.total} รายการ)
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-xs text-[var(--text-secondary)]">
                  รวม <strong>{personal.bookmarks.total}</strong> รายการ (อัลกุรอาน{' '}
                  {personal.bookmarks.quran} • ฮะดีษ {personal.bookmarks.hadith})
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {bookmarks.slice(0, 4).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        if (b.type === 'quran' && b.surah) {
                          jumpToReader(b.surah, b.ayah ?? 1);
                        } else if (b.type === 'hadith' && b.collection && b.hadithId) {
                          jumpToHadith(b.collection, b.hadithId);
                        }
                      }}
                      className="truncate rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-left text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent)]"
                    >
                      {b.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Compact Athkar Summary Card in Overview */}
        {segment === 'overview' && (
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                อัซการประจำวัน & การท่องจำ
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                ต่อเนื่อง <strong>{athkarStats.currentStreak}</strong> วัน • วันนี้กล่าวแล้ว{' '}
                <strong>{athkarStats.todayTapCount}</strong> รอบ • จำได้แล้ว{' '}
                <strong>
                  {athkarStats.memorizedCount}/{athkarStats.totalItems}
                </strong>{' '}
                บท ({athkarStats.memorizedPercent}%)
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSegment('athkar')}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)]"
              >
                ดูรายละเอียดสถิติ
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('athkar')}
                className="rounded-xl bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]"
              >
                อ่านอัซการ →
              </button>
            </div>
          </div>
        )}

        {/* 30 Juz Progress Grid */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              ความก้าวหน้ารายญุซอ์ (30 ญุซอ์)
            </h3>
            <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
                อ่านแล้ว
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--gold)]" />
                จำได้แล้ว
              </span>
            </div>
          </div>

          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
            {personal.perJuz.map((j) => (
              <button
                key={j.juz}
                type="button"
                onClick={() => jumpToMushaf({ page: j.startPage })}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-2.5 text-left transition-colors hover:border-[var(--accent)]"
              >
                <div className="flex items-center justify-between text-xs font-bold text-[var(--text-primary)]">
                  <span>ญุซอ์ {j.juz}</span>
                  <span className="text-[10px] font-normal text-[var(--text-muted)]">
                    น.{j.startPage}
                  </span>
                </div>
                <div className="mt-1.5 space-y-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${j.readPercent}%` }}
                    />
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                    <div
                      className="h-full rounded-full bg-[var(--gold)]"
                      style={{ width: `${j.memorizedPercent}%` }}
                    />
                  </div>
                </div>
                <div className="mt-1 flex justify-between text-[10px] tabular-nums text-[var(--text-muted)]">
                  <span>อ่าน {j.readPercent}%</span>
                  <span>จำ {j.memorizedPercent}%</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 114 Surah Heatmap */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              แผนภาพความคืบหน้า 114 ซูเราะฮ์ (แตะเพื่อเปิดอ่าน)
            </h3>
            <div className="flex flex-wrap items-center gap-1 text-xs">
              {(
                [
                  { id: 'all', label: 'ทั้งหมด (114)' },
                  { id: 'juz30', label: 'ญุซอ์ 30' },
                  { id: 'read_done', label: 'อ่านครบ' },
                  { id: 'mem_done', label: 'จำครบ' },
                  { id: 'in_progress', label: 'กำลังทำ' },
                  { id: 'not_started', label: 'ยังไม่เริ่ม' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSurahFilter(f.id)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    surahFilter === f.id
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filteredSurahs.map((s) => {
              const readPct = Math.round((s.readCount / (s.ayahCount || 1)) * 100);
              const memPct = Math.round((s.memorizedCount / (s.ayahCount || 1)) * 100);
              const hasActivity =
                s.readCount > 0 ||
                s.memorizedCount > 0 ||
                s.learningCount > 0 ||
                s.reviewCount > 0;

              return (
                <div
                  key={s.number}
                  className={`rounded-xl border p-2.5 transition-colors ${
                    s.isFullyMemorized
                      ? 'border-[var(--gold)] bg-[var(--gold-soft)]/55'
                      : s.isFullyRead
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]/50'
                        : hasActivity
                          ? 'border-[var(--accent)]/40 bg-[var(--bg-elevated)]'
                          : 'border-[var(--border-color)] bg-[var(--bg-elevated)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold text-[var(--text-muted)]">
                      {s.number}.
                    </span>
                    <div className="flex items-center gap-1">
                      {s.isFullyRead && (
                        <span title="อ่านครบแล้ว">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent)]" />
                        </span>
                      )}
                      {s.isFullyMemorized && (
                        <span title="จำครบแล้ว">
                          <Award className="h-3.5 w-3.5 text-[var(--gold)]" />
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => jumpToReader(s.number, 1)}
                    className="mt-0.5 block w-full truncate text-left text-xs font-bold text-[var(--text-primary)] hover:text-[var(--accent)]"
                    title={`${s.nameTh} (${s.nameEn})`}
                  >
                    {s.nameTh}
                  </button>
                  <div className="truncate text-[10px] text-[var(--text-muted)]">
                    {s.nameEn}
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[10px] tabular-nums text-[var(--text-muted)]">
                    <span>อ่าน {readPct}%</span>
                    <span>จำ {memPct}%</span>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => jumpToReader(s.number, 1)}
                      className="rounded-md bg-[var(--bg-subtle)] px-1.5 py-0.5 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      คำแปล
                    </button>
                    <button
                      type="button"
                      onClick={() => jumpToMushaf({ page: s.startPage })}
                      className="rounded-md bg-[var(--bg-subtle)] px-1.5 py-0.5 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      มุศฮัฟ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}
    </div>
  );
}
