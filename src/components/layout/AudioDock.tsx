import {
  AlertCircle,
  Loader2,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Timer,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAudio } from '../../context/AudioContext';

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function AudioDock() {
  const { surahsIndex } = useApp();
  const {
    sheikhManifest,
    effectiveReciter,
    fallbackReason,
    isPlaying,
    isLoadingAudio,
    audioError,
    currentTime,
    duration,
    playbackRate,
    setPlaybackRate,
    currentSurah,
    currentAyah,
    currentTrack,
    abLoop,
    setPointA,
    setPointB,
    toggleABLoop,
    clearABLoop,
    hifzLoop,
    stopHifzLoop,
    sleepRemainingSec,
    playSurah,
    togglePlayPause,
    stopPlayback,
    seekTo,
    skipNext,
    skipPrev,
  } = useAudio();

  if (currentSurah === null && !isLoadingAudio) return null;

  const surahMeta = surahsIndex.find((s) => s.number === currentSurah);
  const surahTracks =
    currentTrack && currentSurah !== null
      ? sheikhManifest?.surahs[String(currentSurah)] ?? []
      : [];
  const nextSpeed = () => {
    const speeds = [0.75, 1, 1.25, 1.5];
    const idx = speeds.indexOf(playbackRate);
    setPlaybackRate(speeds[(idx + 1) % speeds.length]);
  };

  return (
    <div className="border-t border-[var(--border-color)] bg-[var(--bg-surface)]/95 backdrop-blur-md px-3 py-2.5 shadow-lg">
      <div className="mx-auto max-w-6xl space-y-1.5">
        {fallbackReason && (
          <div className="flex items-center gap-1.5 rounded-lg bg-[var(--gold-soft)] px-2.5 py-1 text-xs text-[var(--text-primary)]">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[var(--gold)]" />
            <span className="truncate">{fallbackReason}</span>
          </div>
        )}

        {audioError && (
          <div className="flex items-center gap-1.5 rounded-lg bg-[var(--danger-soft)] px-2.5 py-1 text-xs text-[var(--danger)]">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{audioError}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Track info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                {surahMeta
                  ? `${surahMeta.number}. ${surahMeta.nameTh} (${surahMeta.nameEn})`
                  : `ซูเราะฮ์ที่ ${currentSurah}`}
              </span>
              {currentAyah !== null && (
                <span className="rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent-text)]">
                  อายะฮ์ที่ {currentAyah}
                </span>
              )}
              {currentTrack &&
                (surahTracks.length > 1 && currentSurah !== null ? (
                  <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] p-0.5">
                    {surahTracks.map((tr) => {
                      const activeTrack = currentTrack.id === tr.id;
                      return (
                        <button
                          key={tr.id}
                          type="button"
                          onClick={() => playSurah(currentSurah, effectiveReciter?.id, tr.id)}
                          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                            activeTrack
                              ? 'bg-[var(--gold)] text-white'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
                          }`}
                          title={`สลับเล่น ${tr.partLabel}`}
                        >
                          {tr.partLabel}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <span className="rounded-md bg-[var(--gold-soft)] px-2 py-0.5 text-xs font-medium text-[var(--text-primary)]">
                    {currentTrack.partLabel}
                  </span>
                ))}
              {hifzLoop?.active && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)] px-2 py-0.5 text-xs font-medium text-white">
                  <Repeat className="h-3 w-3" />
                  Hifz {hifzLoop.startAyah}-{hifzLoop.endAyah} (รอบ {hifzLoop.currentRepeat}/
                  {hifzLoop.repeatPerAyah === 0 ? '∞' : hifzLoop.repeatPerAyah})
                  {hifzLoop.isWaitingPause ? ' • รออ่านตาม...' : ''}
                  <button
                    type="button"
                    onClick={stopHifzLoop}
                    className="ml-1 rounded hover:bg-white/20"
                    title="หยุดลูปท่องจำ"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {sleepRemainingSec !== null && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-subtle)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                  <Timer className="h-3 w-3" />
                  {formatTime(sleepRemainingSec)}
                </span>
              )}
            </div>
            <div className="truncate text-xs text-[var(--text-muted)]">
              {effectiveReciter?.nameTh ?? 'กำลังเตรียมนักอ่าน...'}
            </div>
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={nextSpeed}
              className="min-h-[36px] rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)]"
              title="ปรับความเร็วเสียง"
            >
              {playbackRate}x
            </button>

            {currentTrack && (
              <div className="hidden sm:flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-xs">
                <button
                  type="button"
                  onClick={setPointA}
                  className={`rounded px-1.5 py-1 font-medium ${
                    abLoop.pointA !== null
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  A {abLoop.pointA !== null ? formatTime(abLoop.pointA) : ''}
                </button>
                <button
                  type="button"
                  onClick={setPointB}
                  className={`rounded px-1.5 py-1 font-medium ${
                    abLoop.pointB !== null
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  B {abLoop.pointB !== null ? formatTime(abLoop.pointB) : ''}
                </button>
                {abLoop.pointA !== null && abLoop.pointB !== null && (
                  <>
                    <button
                      type="button"
                      onClick={toggleABLoop}
                      className={`rounded px-1.5 py-1 font-semibold ${
                        abLoop.enabled
                          ? 'bg-[var(--accent)] text-white'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      วน A-B
                    </button>
                    <button
                      type="button"
                      onClick={clearABLoop}
                      className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--danger)]"
                      title="ล้าง A-B"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={skipPrev}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              aria-label="ก่อนหน้า"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={togglePlayPause}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-sm hover:bg-[var(--accent-hover)] active:scale-95"
              aria-label={isPlaying ? 'พักเสียง' : 'เล่นเสียง'}
            >
              {isLoadingAudio ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 translate-x-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={skipNext}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              aria-label="ถัดไป"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={stopPlayback}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--danger)]"
              aria-label="ปิดเครื่องเล่น"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrubber */}
        <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
          <span className="w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.5}
            value={Math.min(currentTime, duration || 100)}
            onChange={(e) => seekTo(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-[var(--accent)]"
            aria-label="แถบเวลาเสียงอ่าน"
          />
          <span className="w-10 tabular-nums">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
