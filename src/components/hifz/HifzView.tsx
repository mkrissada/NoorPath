import {
  BarChart3,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Play,
  RefreshCw,
  Repeat,
  Square,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAudio } from '../../context/AudioContext';
import { getSurah } from '../../lib/dataLoader';
import type { HifzStatus, MaskMode, SurahPayload } from '../../types/models';
import { WordMasker } from '../shared/WordMasker';

const MASK_MODES: Array<{ id: MaskMode; label: string }> = [
  { id: 'full', label: 'แสดงเต็ม' },
  { id: 'first-words', label: '3 คำแรก' },
  { id: 'first-letter', label: 'ตัวอักษรแรก' },
  { id: 'cloze-50', label: 'ซ่อน 50%' },
  { id: 'hidden', label: 'ซ่อนทั้งหมด' },
];

const HIFZ_PRESETS: Array<{ label: string; surah: number; start: number; end: number }> = [
  { label: 'อัล-ฟาติหะฮ์ (1:1-7)', surah: 1, start: 1, end: 7 },
  { label: 'อายะฮ์ อัล-กุรซีย์ (2:255)', surah: 2, start: 255, end: 255 },
  { label: 'ท้ายอัล-บะเกาะเราะฮ์ (2:285-286)', surah: 2, start: 285, end: 286 },
  { label: 'อัล-มุลก์ (67:1-10)', surah: 67, start: 1, end: 10 },
  { label: 'อัน-นะบะอ์ (78:1-10)', surah: 78, start: 1, end: 10 },
  { label: 'อัล-อิคลาศ (112:1-4)', surah: 112, start: 1, end: 4 },
];

export function HifzView() {
  const {
    surahsIndex,
    settings,
    hifzProgress,
    getHifzStatus,
    setHifzStatus,
    hifzTarget,
    jumpToReader,
  } = useApp();

  const {
    reciters,
    sheikhManifest,
    hifzLoop,
    startHifzRangeLoop,
    stopHifzLoop,
    currentSurah,
    currentAyah,
    currentTrack,
    isPlaying,
    playSurah,
  } = useAudio();

  const [subTab, setSubTab] = useState<'practice' | 'dashboard'>('practice');
  const [selectedSurah, setSelectedSurah] = useState(1);
  const [startAyah, setStartAyah] = useState(1);
  const [endAyah, setEndAyah] = useState(7);

  const [surahData, setSurahData] = useState<SurahPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const [maskMode, setMaskMode] = useState<MaskMode>('cloze-50');
  const [hideThai, setHideThai] = useState(false);
  const [peekThaiAyahs, setPeekThaiAyahs] = useState<Set<number>>(new Set());

  const [loopReciterId, setLoopReciterId] = useState('husary');
  const [repeatPerAyah, setRepeatPerAyah] = useState(3);
  const [pauseSec, setPauseSec] = useState(2);

  const [dashFilter, setDashFilter] = useState<'all' | 'juz30' | 'active'>('all');

  useEffect(() => {
    if (hifzTarget) {
      setSubTab('practice');
      setSelectedSurah(hifzTarget.surah);
      setStartAyah(hifzTarget.startAyah);
      setEndAyah(hifzTarget.endAyah);
    }
  }, [hifzTarget]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPeekThaiAyahs(new Set());
    getSurah(selectedSurah)
      .then((payload) => {
        if (!active) return;
        setSurahData(payload);
        setLoading(false);
        const max = payload.metadata.ayahCount;
        setStartAyah((prev) => Math.max(1, Math.min(prev, max)));
        setEndAyah((prev) => Math.max(1, Math.min(prev, max)));
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedSurah]);

  const ayahReciters = useMemo(
    () => reciters.filter((r) => r.mode === 'ayah'),
    [reciters]
  );

  const selectedMeta = surahsIndex.find((s) => s.number === selectedSurah);
  const maxAyah = selectedMeta?.ayahCount ?? 286;

  const visibleAyahs = useMemo(() => {
    if (!surahData) return [];
    const s = Math.max(1, Math.min(startAyah, endAyah));
    const e = Math.min(surahData.metadata.ayahCount, Math.max(startAyah, endAyah));
    return surahData.ayahs.filter((a) => a.number >= s && a.number <= e);
  }, [surahData, startAyah, endAyah]);

  // Dashboard stats
  const dashboardStats = useMemo(() => {
    let memorized = 0;
    let learning = 0;
    let review = 0;
    const perSurah: Record<number, { memorized: number; learning: number; review: number }> = {};

    Object.entries(hifzProgress).forEach(([key, entry]) => {
      if (key.startsWith('hadith:') || entry.status === 'none' || entry.deleted) return;
      const [sStr] = key.split(':');
      const sNum = Number(sStr);
      if (!Number.isFinite(sNum)) return;
      const bucket = (perSurah[sNum] ??= { memorized: 0, learning: 0, review: 0 });
      if (entry.status === 'memorized') {
        memorized++;
        bucket.memorized++;
      } else if (entry.status === 'learning') {
        learning++;
        bucket.learning++;
      } else if (entry.status === 'review') {
        review++;
        bucket.review++;
      }
    });

    return {
      memorized,
      learning,
      review,
      startedSurahs: Object.keys(perSurah).length,
      perSurah,
    };
  }, [hifzProgress]);

  const filteredDashboardSurahs = useMemo(() => {
    return surahsIndex.filter((s) => {
      if (dashFilter === 'juz30') return s.number >= 78;
      if (dashFilter === 'active') return Boolean(dashboardStats.perSurah[s.number]);
      return true;
    });
  }, [surahsIndex, dashFilter, dashboardStats.perSurah]);

  const handleSurahChange = (nextSurah: number) => {
    const meta = surahsIndex.find((s) => s.number === nextSurah);
    setSelectedSurah(nextSurah);
    setStartAyah(1);
    setEndAyah(Math.min(7, meta?.ayahCount ?? 7));
  };

  const applyRangeStatus = (status: HifzStatus) => {
    visibleAyahs.forEach((a) => {
      setHifzStatus(`${selectedSurah}:${a.number}`, status);
    });
  };

  const toggleLoop = () => {
    if (hifzLoop?.active) {
      stopHifzLoop();
    } else {
      startHifzRangeLoop({
        surah: selectedSurah,
        startAyah: Math.min(startAyah, endAyah),
        endAyah: Math.max(startAyah, endAyah),
        repeatPerAyah,
        pauseSec,
        reciterId: loopReciterId,
      });
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-3 sm:px-6 py-5">
      {/* Sub-tab header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-1">
          <button
            type="button"
            onClick={() => setSubTab('practice')}
            className={`min-h-[40px] rounded-lg px-4 text-sm font-semibold transition-colors ${
              subTab === 'practice'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            ฝึกท่องจำ (Hifz Studio)
          </button>
          <button
            type="button"
            onClick={() => setSubTab('dashboard')}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-colors ${
              subTab === 'dashboard'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            ความคืบหน้า ({dashboardStats.memorized} อายะฮ์)
          </button>
        </div>

        {/* Quick stats pill */}
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 font-semibold text-[var(--accent-text)]">
            จำแม่น: {dashboardStats.memorized}
          </span>
          <span className="rounded-lg bg-[var(--gold-soft)] px-2.5 py-1 font-semibold text-[var(--text-primary)]">
            กำลังท่อง: {dashboardStats.learning}
          </span>
          <span className="rounded-lg bg-[var(--danger-soft)] px-2.5 py-1 font-semibold text-[var(--danger)]">
            ทบทวน: {dashboardStats.review}
          </span>
        </div>
      </div>

      {subTab === 'practice' ? (
        <div className="space-y-4">
          {/* Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-[var(--text-muted)]">ชุดแนะนำ:</span>
            {HIFZ_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setSelectedSurah(p.surah);
                  setStartAyah(p.start);
                  setEndAyah(p.end);
                }}
                className="rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Controls Card */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)] space-y-4">
            {/* Row 1: Surah & Ayah Range */}
            <div className="grid gap-3 sm:grid-cols-12">
              <div className="sm:col-span-6">
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  ซูเราะฮ์
                </label>
                <select
                  value={selectedSurah}
                  onChange={(e) => handleSurahChange(Number(e.target.value))}
                  className="min-h-[42px] w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 text-sm font-medium text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                >
                  {surahsIndex.map((s) => (
                    <option key={s.number} value={s.number}>
                      {s.number}. {s.nameTh} ({s.nameEn}) • {s.ayahCount} อายะฮ์
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  ตั้งแต่อายะฮ์ที่
                </label>
                <input
                  type="number"
                  min={1}
                  max={maxAyah}
                  value={startAyah}
                  onChange={(e) => setStartAyah(Math.max(1, Math.min(maxAyah, Number(e.target.value) || 1)))}
                  className="min-h-[42px] w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 text-sm font-semibold tabular-nums text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  ถึงอายะฮ์ที่
                </label>
                <input
                  type="number"
                  min={1}
                  max={maxAyah}
                  value={endAyah}
                  onChange={(e) => setEndAyah(Math.max(1, Math.min(maxAyah, Number(e.target.value) || 1)))}
                  className="min-h-[42px] w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 text-sm font-semibold tabular-nums text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
            </div>

            {/* Row 2: Mask Mode Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-color)] pt-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {MASK_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMaskMode(m.id)}
                    className={`min-h-[38px] rounded-xl border px-3 text-xs font-semibold transition-colors ${
                      maskMode === m.id
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                        : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setHideThai((v) => !v)}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold ${
                  hideThai
                    ? 'border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--text-primary)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                }`}
              >
                {hideThai ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {hideThai ? 'ซ่อนคำแปลอยู่' : 'แสดงคำแปลไทย'}
              </button>
            </div>

            {/* Row 3: Audio Hifz Loop Controller */}
            <div className="flex flex-wrap items-end gap-3 border-t border-[var(--border-color)] pt-3">
              <div className="min-w-[200px] flex-1">
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  นักอ่านสำหรับวนลูปรายอายะฮ์
                </label>
                <select
                  value={loopReciterId}
                  onChange={(e) => setLoopReciterId(e.target.value)}
                  className="min-h-[40px] w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 text-xs font-medium text-[var(--text-primary)]"
                >
                  {ayahReciters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nameTh}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  วนซ้ำต่ออายะฮ์
                </label>
                <select
                  value={repeatPerAyah}
                  onChange={(e) => setRepeatPerAyah(Number(e.target.value))}
                  className="min-h-[40px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-[var(--text-primary)]"
                >
                  <option value={1}>1 รอบ</option>
                  <option value={2}>2 รอบ</option>
                  <option value={3}>3 รอบ</option>
                  <option value={5}>5 รอบ</option>
                  <option value={0}>วนไม่จำกัด (∞)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  เว้นช่วงอ่านตาม
                </label>
                <select
                  value={pauseSec}
                  onChange={(e) => setPauseSec(Number(e.target.value))}
                  className="min-h-[40px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-[var(--text-primary)]"
                >
                  <option value={0}>ไม่เว้น (0 วินาที)</option>
                  <option value={2}>2 วินาที</option>
                  <option value={4}>4 วินาที</option>
                  <option value={6}>6 วินาที</option>
                </select>
              </div>

              <button
                type="button"
                onClick={toggleLoop}
                className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition-colors ${
                  hifzLoop?.active
                    ? 'bg-[var(--danger)] hover:opacity-90'
                    : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
                }`}
              >
                {hifzLoop?.active ? (
                  <>
                    <Square className="h-4 w-4" />
                    หยุดลูปท่องจำ
                  </>
                ) : (
                  <>
                    <Repeat className="h-4 w-4" />
                    เริ่มวนลูปช่วงนี้
                  </>
                )}
              </button>

              {selectedMeta?.hasSheikhAbdallahAudio && (() => {
                const sheikhTracks = sheikhManifest?.surahs[String(selectedSurah)] ?? [];
                if (sheikhTracks.length > 1) {
                  return sheikhTracks.map((tr) => {
                    const playingThisTrack =
                      currentSurah === selectedSurah &&
                      currentTrack?.id === tr.id &&
                      isPlaying;
                    return (
                      <button
                        key={tr.id}
                        type="button"
                        onClick={() =>
                          playSurah(selectedSurah, 'sheikh-abdallah-humeid', tr.id)
                        }
                        className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold ${
                          playingThisTrack
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                            : 'border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--text-primary)]'
                        }`}
                        title="เปิดเสียงของเชค อับดุลลอฮ์ ฮุมัยด์ (ใช้ลูป A-B ในแถบด้านล่างได้)"
                      >
                        <Play className="h-3.5 w-3.5" />
                        ฟังเชคฯ {tr.partLabel} (A-B)
                      </button>
                    );
                  });
                }
                return (
                  <button
                    type="button"
                    onClick={() => playSurah(selectedSurah, 'sheikh-abdallah-humeid')}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[var(--gold)] bg-[var(--gold-soft)] px-3 text-xs font-semibold text-[var(--text-primary)]"
                    title="เปิดเสียงทั้งซูเราะฮ์ของเชค อับดุลลอฮ์ ฮุมัยด์ (ใช้ลูป A-B ในแถบด้านล่างได้)"
                  >
                    <Play className="h-3.5 w-3.5 text-[var(--gold)]" />
                    ฟังเสียงเชคฯ (A-B)
                  </button>
                );
              })()}
            </div>

            {/* Bulk grading row */}
            {visibleAyahs.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-color)] pt-3 text-xs">
                <span className="text-[var(--text-muted)]">
                  กำลังฝึก {visibleAyahs.length} อายะฮ์ ({selectedMeta?.nameTh})
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[var(--text-muted)]">ตั้งสถานะทั้งช่วง:</span>
                  <button
                    type="button"
                    onClick={() => applyRangeStatus('learning')}
                    className="rounded-lg bg-[var(--gold-soft)] px-2.5 py-1 font-semibold text-[var(--text-primary)]"
                  >
                    กำลังท่อง
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRangeStatus('memorized')}
                    className="rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 font-semibold text-[var(--accent-text)]"
                  >
                    จำแม่นแล้ว
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRangeStatus('review')}
                    className="rounded-lg bg-[var(--danger-soft)] px-2.5 py-1 font-semibold text-[var(--danger)]"
                  >
                    ต้องทบทวน
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Ayah Practice Cards */}
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[var(--text-muted)]">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              กำลังเตรียมตัวบทฝึกท่องจำ...
            </div>
          ) : (
            <div className="space-y-4">
              {visibleAyahs.map((ayah) => {
                const key = `${selectedSurah}:${ayah.number}`;
                const status = getHifzStatus(key);
                const isLoopingThis =
                  currentSurah === selectedSurah && currentAyah === ayah.number;
                const thaiVisible = !hideThai || peekThaiAyahs.has(ayah.number);

                return (
                  <div
                    key={ayah.number}
                    className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-[var(--shadow-card)] ${
                      isLoopingThis
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]/30 ring-1 ring-[var(--accent)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-surface)]'
                    }`}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-bold tabular-nums text-[var(--accent-text)]">
                          {selectedSurah}:{ayah.number}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            startHifzRangeLoop({
                              surah: selectedSurah,
                              startAyah: ayah.number,
                              endAyah: ayah.number,
                              repeatPerAyah,
                              pauseSec,
                              reciterId: loopReciterId,
                            })
                          }
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent)]"
                        >
                          <Repeat className="h-3 w-3" />
                          วนลูปเฉพาะอายะฮ์นี้
                        </button>
                      </div>

                      {/* Per-ayah Hifz status buttons */}
                      <div className="flex items-center gap-1 text-xs">
                        {(
                          [
                            { id: 'learning', label: 'กำลังท่อง', icon: Clock },
                            { id: 'memorized', label: 'จำแม่นแล้ว', icon: CheckCircle2 },
                            { id: 'review', label: 'ต้องทบทวน', icon: RefreshCw },
                          ] as const
                        ).map((st) => {
                          const Icon = st.icon;
                          const active = status === st.id;
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => setHifzStatus(key, active ? 'none' : st.id)}
                              className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg border px-2.5 font-medium transition-colors ${
                                active
                                  ? st.id === 'memorized'
                                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                                    : st.id === 'learning'
                                      ? 'border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--text-primary)]'
                                      : 'border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]'
                                  : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">{st.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <WordMasker
                      words={ayah.words}
                      mode={maskMode}
                      resetKey={`${selectedSurah}-${ayah.number}`}
                      arabicFontSize={settings.arabicFontSize}
                    />

                    {/* Thai translation (tap to peek if hidden) */}
                    <div className="mt-3">
                      {thaiVisible ? (
                        <div className="font-thai rounded-xl bg-[var(--bg-subtle)]/50 p-3 text-sm text-[var(--text-secondary)]">
                          {ayah.translations.th_kfgqpc}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setPeekThaiAyahs((prev) => new Set(prev).add(ayah.number))
                          }
                          className="w-full rounded-xl border border-dashed border-[var(--border-color)] py-2 text-xs font-medium text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        >
                          แตะเพื่อดูคำแปลภาษาไทย
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Progress Dashboard */
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
              <div className="text-xs text-[var(--text-muted)]">จำแม่นแล้ว</div>
              <div className="mt-1 text-2xl font-bold text-[var(--accent)]">
                {dashboardStats.memorized}{' '}
                <span className="text-xs font-normal text-[var(--text-muted)]">/ 6,236</span>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
              <div className="text-xs text-[var(--text-muted)]">กำลังฝึกท่อง</div>
              <div className="mt-1 text-2xl font-bold text-[var(--gold)]">
                {dashboardStats.learning}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
              <div className="text-xs text-[var(--text-muted)]">ต้องทบทวน</div>
              <div className="mt-1 text-2xl font-bold text-[var(--danger)]">
                {dashboardStats.review}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
              <div className="text-xs text-[var(--text-muted)]">ซูเราะฮ์ที่เริ่มแล้ว</div>
              <div className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                {dashboardStats.startedSurahs}{' '}
                <span className="text-xs font-normal text-[var(--text-muted)]">/ 114</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'all', label: 'ทั้งหมด 114 ซูเราะฮ์' },
                { id: 'juz30', label: 'เฉพาะจุซอ์ 30 (78-114)' },
                { id: 'active', label: 'เฉพาะที่กำลังท่อง/จำแล้ว' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDashFilter(f.id)}
                className={`min-h-[36px] rounded-xl border px-3 text-xs font-semibold ${
                  dashFilter === f.id
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDashboardSurahs.map((s) => {
              const bucket = dashboardStats.perSurah[s.number] ?? {
                memorized: 0,
                learning: 0,
                review: 0,
              };
              const pct = Math.round((bucket.memorized / s.ayahCount) * 100);
              return (
                <div
                  key={s.number}
                  className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-[var(--text-primary)]">
                        {s.number}. {s.nameTh}{' '}
                        <span className="text-xs font-normal text-[var(--text-muted)]">
                          ({s.nameEn})
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        จำแล้ว {bucket.memorized} / {s.ayahCount} อายะฮ์ ({pct}%)
                      </div>
                    </div>
                    <span dir="rtl" className="font-arabic text-lg text-[var(--accent)]">
                      {s.nameAr.replace('سُورَةُ ', '')}
                    </span>
                  </div>

                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSurah(s.number);
                        setStartAyah(1);
                        setEndAyah(Math.min(7, s.ayahCount));
                        setSubTab('practice');
                      }}
                      className="rounded-lg bg-[var(--accent-soft)] px-3 py-1.5 font-semibold text-[var(--accent-text)]"
                    >
                      ฝึกท่องต่อ
                    </button>
                    <button
                      type="button"
                      onClick={() => jumpToReader(s.number, 1)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      เปิดอ่าน
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
