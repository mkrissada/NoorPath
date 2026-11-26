import {
  CheckCircle2,
  Headphones,
  Play,
  Radio,
  Search,
  Timer,
  Volume2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAudio } from '../../context/AudioContext';

export function AudioLibraryView() {
  const { surahsIndex, settings, updateSettings, jumpToReader } = useApp();
  const {
    reciters,
    sheikhManifest,
    activeReciterId,
    setActiveReciterId,
    currentSurah,
    currentTrack,
    effectiveReciter,
    isPlaying,
    playSurah,
    sleepRemainingSec,
    setSleepTimer,
  } = useAudio();

  const [selectedReciterTab, setSelectedReciterTab] = useState<string>(activeReciterId);
  const [filterMode, setFilterMode] = useState<'all' | 'covered' | 'missing'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const viewingReciter =
    reciters.find((r) => r.id === selectedReciterTab) ?? reciters[0] ?? null;
  const ayahReciters = useMemo(() => reciters.filter((r) => r.mode === 'ayah'), [reciters]);

  const coveredCount = sheikhManifest?.coveredSurahsCount ?? 0;
  const totalTracks = sheikhManifest?.totalTracksCount ?? 0;
  const missingCount = Math.max(0, 114 - coveredCount);

  const filteredSurahs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return surahsIndex.filter((s) => {
      if (viewingReciter?.mode === 'surah-tracks') {
        if (filterMode === 'covered' && !s.hasSheikhAbdallahAudio) return false;
        if (filterMode === 'missing' && s.hasSheikhAbdallahAudio) return false;
      }
      if (!q) return true;
      return (
        String(s.number) === q ||
        s.nameTh.toLowerCase().includes(q) ||
        (s.defaultNameTh?.toLowerCase().includes(q) ?? false) ||
        s.nameEn.toLowerCase().includes(q) ||
        s.meaningTh.toLowerCase().includes(q) ||
        s.nameAr.includes(searchQuery.trim())
      );
    });
  }, [surahsIndex, viewingReciter, filterMode, searchQuery]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-3 sm:px-6 py-5">
      {/* Reciter Selector Cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {reciters.map((r) => {
          const isViewing = selectedReciterTab === r.id;
          const isDefault = activeReciterId === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedReciterTab(r.id)}
              className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition-all shadow-[var(--shadow-card)] ${
                isViewing
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)]/45 ring-1 ring-[var(--accent)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--accent)]/60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                      r.isPartial
                        ? 'bg-[var(--gold-soft)] text-[var(--text-primary)]'
                        : 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    }`}
                  >
                    {r.isPartial ? <Radio className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                    {r.isPartial
                      ? `${coveredCount}/114 ซูเราะฮ์ (${totalTracks} ไฟล์)`
                      : r.mode === 'surah'
                        ? 'ครบ 114 ซูเราะฮ์ (รายซูเราะฮ์)'
                        : 'ครบ 114 ซูเราะฮ์ (รายอายะฮ์)'}
                  </span>
                  {isDefault && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-text)]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      นักอ่านหลัก
                    </span>
                  )}
                </div>
                <div className="mt-2.5 text-base font-bold text-[var(--text-primary)]">
                  {r.nameTh}
                </div>
                <div className="text-xs text-[var(--text-muted)]">{r.nameEn}</div>
              </div>
              <div className="mt-3 text-xs text-[var(--text-secondary)]">{r.styleTh}</div>
            </button>
          );
        })}
      </div>

      {/* Active Reciter Control Bar */}
      {viewingReciter && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)]">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Headphones className="h-4 w-4 text-[var(--accent)]" />
              <span className="text-sm font-bold text-[var(--text-primary)]">
                {viewingReciter.nameTh}
              </span>
              {activeReciterId !== viewingReciter.id && (
                <button
                  type="button"
                  onClick={() => setActiveReciterId(viewingReciter.id)}
                  className="rounded-lg bg-[var(--accent)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]"
                >
                  ตั้งเป็นนักอ่านหลัก
                </button>
              )}
            </div>
            {viewingReciter.isPartial && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span>นักอ่านสำรองเมื่อซูเราะฮ์ไม่มีเสียง:</span>
                <select
                  value={settings.fallbackReciterId}
                  onChange={(e) => updateSettings({ fallbackReciterId: e.target.value })}
                  className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2 py-1 text-xs font-medium text-[var(--text-primary)]"
                >
                  {ayahReciters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nameTh}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Sleep Timer */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1 text-[var(--text-muted)] mr-1">
              <Timer className="h-3.5 w-3.5" />
              ตั้งเวลาปิด:
            </span>
            {[null, 15, 30, 60].map((mins) => (
              <button
                key={String(mins)}
                type="button"
                onClick={() => setSleepTimer(mins)}
                className={`min-h-[34px] rounded-lg border px-2.5 font-medium ${
                  (mins === null && sleepRemainingSec === null) ||
                  (mins !== null &&
                    sleepRemainingSec !== null &&
                    Math.ceil(sleepRemainingSec / 60) === mins)
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                }`}
              >
                {mins === null ? 'ปิด' : `${mins} นาที`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาซูเราะฮ์ในคลังเสียง (ไทย / อังกฤษ / อาหรับ / เลข)..."
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        {viewingReciter?.mode === 'surah-tracks' && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`min-h-[38px] rounded-xl border px-3 font-semibold ${
                filterMode === 'all'
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
              }`}
            >
              ทั้งหมด (114)
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('covered')}
              className={`min-h-[38px] rounded-xl border px-3 font-semibold ${
                filterMode === 'covered'
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
              }`}
            >
              มีเสียงเชคฯ ({coveredCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('missing')}
              className={`min-h-[38px] rounded-xl border px-3 font-semibold ${
                filterMode === 'missing'
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
              }`}
            >
              ไม่มีเสียงเชคฯ ({missingCount})
            </button>
          </div>
        )}
      </div>

      {/* Surahs Audio Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredSurahs.map((s) => {
          const tracks =
            viewingReciter?.mode === 'surah-tracks'
              ? sheikhManifest?.surahs[String(s.number)] ?? []
              : [];
          const hasCustomTracks = tracks.length > 0;
          const isMissingForSheikh =
            viewingReciter?.mode === 'surah-tracks' && !hasCustomTracks;
          const isThisSurahPlaying =
            currentSurah === s.number &&
            isPlaying &&
            effectiveReciter?.id === viewingReciter?.id;

          return (
            <div
              key={s.number}
              className={`flex flex-col justify-between rounded-2xl border p-4 transition-all shadow-[var(--shadow-card)] ${
                currentSurah === s.number
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)]/30'
                  : 'border-[var(--border-color)] bg-[var(--bg-surface)]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-lg bg-[var(--bg-subtle)] px-1.5 text-xs font-bold tabular-nums text-[var(--accent-text)]">
                      {s.number}
                    </span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      {s.nameTh}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    {s.nameEn} • {s.meaningTh} • {s.ayahCount} อายะฮ์
                  </div>
                </div>
                <span dir="rtl" className="font-arabic text-lg text-[var(--accent)]">
                  {s.nameAr.replace('سُورَةُ ', '')}
                </span>
              </div>

              {/* Track / Play Action Row */}
              <div className="mt-3 space-y-2 border-t border-[var(--border-color)] pt-3">
                {viewingReciter?.mode === 'surah-tracks' ? (
                  hasCustomTracks ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {tracks.map((tr) => {
                        const playingTrack = currentTrack?.id === tr.id && isPlaying;
                        return (
                          <button
                            key={tr.id}
                            type="button"
                            onClick={() => playSurah(s.number, viewingReciter.id, tr.id)}
                            className={`inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors ${
                              playingTrack
                                ? 'bg-[var(--accent)] text-white'
                                : 'bg-[var(--accent-soft)] text-[var(--accent-text)] hover:opacity-90'
                            }`}
                          >
                            <Play className="h-3.5 w-3.5" />
                            <span>{tracks.length > 1 ? tr.partLabel : 'เล่นเสียงเชคฯ'}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[var(--text-muted)]">
                        ไม่มีไฟล์เชคฯ
                      </span>
                      <button
                        type="button"
                        onClick={() => playSurah(s.number, viewingReciter.id)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent)]"
                      >
                        <Play className="h-3 w-3" />
                        เล่นด้วยนักอ่านสำรอง
                      </button>
                    </div>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => playSurah(s.number, viewingReciter?.id)}
                    className={`inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold ${
                      isThisSurahPlaying
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    }`}
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>เล่นทั้งซูเราะฮ์</span>
                  </button>
                )}

                {!isMissingForSheikh && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => jumpToReader(s.number, 1)}
                      className="text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)]"
                    >
                      เปิดตัวบทซูเราะฮ์นี้ →
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
