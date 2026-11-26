import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getAudioCatalog, getDataFileUrl } from '../lib/dataLoader';
import type { ReciterConfig, SheikhManifest, SheikhTrack } from '../types/models';
import { useApp } from './AppContext';

export interface HifzLoopConfig {
  surah: number;
  startAyah: number;
  endAyah: number;
  repeatPerAyah: number; // 0 = infinite loop on single ayah
  pauseSec: number;
  reciterId?: string;
}

interface HifzLoopRuntime extends HifzLoopConfig {
  active: boolean;
  currentRepeat: number;
  isWaitingPause: boolean;
}

interface ABLoopState {
  pointA: number | null;
  pointB: number | null;
  enabled: boolean;
}

interface AudioContextValue {
  reciters: ReciterConfig[];
  sheikhManifest: SheikhManifest | null;
  activeReciterId: string;
  setActiveReciterId: (id: string) => void;
  effectiveReciter: ReciterConfig | null;
  fallbackReason: string | null;
  isPlaying: boolean;
  isLoadingAudio: boolean;
  audioError: string | null;
  currentTime: number;
  duration: number;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  currentSurah: number | null;
  currentAyah: number | null;
  currentTrack: SheikhTrack | null;
  abLoop: ABLoopState;
  setPointA: () => void;
  setPointB: () => void;
  toggleABLoop: () => void;
  clearABLoop: () => void;
  hifzLoop: HifzLoopRuntime | null;
  startHifzRangeLoop: (cfg: HifzLoopConfig) => void;
  stopHifzLoop: () => void;
  sleepRemainingSec: number | null;
  setSleepTimer: (minutes: number | null) => void;
  playSurah: (surahNumber: number, preferredReciterId?: string, trackId?: string) => void;
  playAyah: (surahNumber: number, ayahNumber: number, preferredReciterId?: string) => void;
  togglePlayPause: () => void;
  stopPlayback: () => void;
  seekTo: (seconds: number) => void;
  skipNext: () => void;
  skipPrev: () => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { settings, surahsIndex, updateSettings } = useApp();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pauseTimerRef = useRef<number | null>(null);

  const [reciters, setReciters] = useState<ReciterConfig[]>([]);
  const [sheikhManifest, setSheikhManifest] = useState<SheikhManifest | null>(null);

  const [activeReciterId, setActiveReciterIdState] = useState<string>(settings.primaryReciterId);
  const [effectiveReciterId, setEffectiveReciterId] = useState<string>(settings.primaryReciterId);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);

  const [currentSurah, setCurrentSurah] = useState<number | null>(null);
  const [currentAyah, setCurrentAyah] = useState<number | null>(null);
  const [currentTrack, setCurrentTrack] = useState<SheikhTrack | null>(null);

  const [abLoop, setAbLoop] = useState<ABLoopState>({
    pointA: null,
    pointB: null,
    enabled: false,
  });

  const [hifzLoop, setHifzLoop] = useState<HifzLoopRuntime | null>(null);
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number | null>(null);

  // Refs to keep event handlers fresh
  const stateRef = useRef({
    reciters,
    sheikhManifest,
    surahsIndex,
    activeReciterId,
    effectiveReciterId,
    fallbackReason,
    currentSurah,
    currentAyah,
    currentTrack,
    abLoop,
    hifzLoop,
    settings,
  });
  stateRef.current = {
    reciters,
    sheikhManifest,
    surahsIndex,
    activeReciterId,
    effectiveReciterId,
    fallbackReason,
    currentSurah,
    currentAyah,
    currentTrack,
    abLoop,
    hifzLoop,
    settings,
  };

  useEffect(() => {
    getAudioCatalog()
      .then((cat) => {
        setReciters(cat.reciters);
        setSheikhManifest(cat.sheikhManifest);
      })
      .catch(() => {
        // Handled cleanly in UI
      });
  }, []);

  const clearPauseTimer = useCallback(() => {
    if (pauseTimerRef.current !== null) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, []);

  const setActiveReciterId = useCallback(
    (id: string) => {
      setActiveReciterIdState(id);
      updateSettings({ primaryReciterId: id });
    },
    [updateSettings]
  );

  const getReciterById = useCallback(
    (id: string): ReciterConfig | undefined =>
      stateRef.current.reciters.find((r) => r.id === id),
    []
  );

  const resolveAyahReciter = useCallback(
    (preferredId?: string): { reciter: ReciterConfig | null; reason: string | null } => {
      const targetId = preferredId ?? stateRef.current.activeReciterId;
      const candidate = getReciterById(targetId);
      if (candidate && candidate.mode === 'ayah') {
        return { reciter: candidate, reason: null };
      }
      const fallback =
        getReciterById(stateRef.current.settings.fallbackReciterId) ??
        stateRef.current.reciters.find((r) => r.mode === 'ayah') ??
        null;
      return {
        reciter: fallback,
        reason:
          `${candidate?.nameTh ?? 'นักอ่านที่เลือก'} เป็นไฟล์เสียงรวมรายซูเราะฮ์ จึงสลับใช้นักอ่านสำรองสำหรับเล่น/วนลูปรายอายะฮ์ชั่วคราว`,
      };
    },
    [getReciterById]
  );

  const loadAndPlayUrl = useCallback(async (url: string, fallbackRemoteUrl?: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    setAudioError(null);
    setIsLoadingAudio(true);

    let chosenUrl = url;
    if (fallbackRemoteUrl && url !== fallbackRemoteUrl) {
      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (!res.ok) chosenUrl = fallbackRemoteUrl;
      } catch {
        chosenUrl = fallbackRemoteUrl;
      }
    }

    if (audio.src !== chosenUrl) {
      audio.src = chosenUrl;
    }
    audio.playbackRate = stateRef.current.settings ? audio.playbackRate : 1;

    try {
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถเล่นเสียงได้';
      if (!msg.toLowerCase().includes('abort')) {
        setAudioError('เล่นเสียงไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อหรือลองใหม่อีกครั้ง');
      }
      setIsPlaying(false);
    } finally {
      setIsLoadingAudio(false);
    }
  }, []);

  const updateMediaSession = useCallback(
    (surahNum: number, ayahNum: number | null, reciterName: string, trackLabel?: string) => {
      if (!('mediaSession' in navigator)) return;
      const meta = stateRef.current.surahsIndex.find((s) => s.number === surahNum);
      const title = meta
        ? ayahNum
          ? `ซูเราะฮ์ ${meta.nameTh} — อายะฮ์ที่ ${ayahNum}`
          : `ซูเราะฮ์ ${meta.nameTh}${trackLabel ? ` (${trackLabel})` : ''}`
        : `ซูเราะฮ์ที่ ${surahNum}`;
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: reciterName,
        album: 'NoorPath — อัลกุรอาน',
      });
    },
    []
  );

  const playAyahInternal = useCallback(
    (surahNumber: number, ayahNumber: number, reciter: ReciterConfig, reason: string | null) => {
      clearPauseTimer();
      const url = `${reciter.baseUrl}/${pad3(surahNumber)}${pad3(ayahNumber)}.mp3`;
      setEffectiveReciterId(reciter.id);
      setFallbackReason(reason);
      setCurrentSurah(surahNumber);
      setCurrentAyah(ayahNumber);
      setCurrentTrack(null);
      setAbLoop({ pointA: null, pointB: null, enabled: false });
      updateMediaSession(surahNumber, ayahNumber, reciter.nameTh);
      void loadAndPlayUrl(url);
    },
    [clearPauseTimer, loadAndPlayUrl, updateMediaSession]
  );

  const playAyah = useCallback(
    (surahNumber: number, ayahNumber: number, preferredReciterId?: string) => {
      setHifzLoop(null);
      const { reciter, reason } = resolveAyahReciter(preferredReciterId);
      if (!reciter) {
        setAudioError('ยังไม่ได้โหลดรายการนักอ่าน');
        return;
      }
      playAyahInternal(surahNumber, ayahNumber, reciter, reason);
    },
    [playAyahInternal, resolveAyahReciter]
  );

  const playSurah = useCallback(
    (surahNumber: number, preferredReciterId?: string, trackId?: string) => {
      clearPauseTimer();
      setHifzLoop(null);
      const targetReciterId = preferredReciterId ?? stateRef.current.activeReciterId;
      const reciter = getReciterById(targetReciterId);

      if (reciter?.mode === 'surah-tracks') {
        const tracks = stateRef.current.sheikhManifest?.surahs[String(surahNumber)] ?? [];
        if (tracks.length > 0) {
          const track = trackId ? tracks.find((t) => t.id === trackId) ?? tracks[0] : tracks[0];
          const localResolved = getDataFileUrl(track.localUrl);
          const urlToUse = stateRef.current.settings.useLocalSheikhAudio
            ? localResolved
            : track.remoteUrl;

          setEffectiveReciterId(reciter.id);
          setFallbackReason(null);
          setCurrentSurah(surahNumber);
          setCurrentAyah(null);
          setCurrentTrack(track);
          setAbLoop({ pointA: null, pointB: null, enabled: false });
          updateMediaSession(surahNumber, null, reciter.nameTh, track.partLabel);
          void loadAndPlayUrl(
            urlToUse,
            stateRef.current.settings.useLocalSheikhAudio ? track.remoteUrl : undefined
          );
          return;
        }

        // Sheikh Abdallah does not cover this Surah -> graceful fallback
        const { reciter: fallback } = resolveAyahReciter(stateRef.current.settings.fallbackReciterId);
        if (fallback) {
          playAyahInternal(
            surahNumber,
            1,
            fallback,
            `เชค อับดุลลอฮ์ ฮุมัยด์ ไม่มีไฟล์เสียงซูเราะฮ์ที่ ${surahNumber} — เล่นด้วยนักอ่านสำรอง (${fallback.nameTh}) แทน`
          );
          return;
        }
      }

      if (reciter?.mode === 'surah' && reciter.baseUrl) {
        const url = `${reciter.baseUrl}/${pad3(surahNumber)}.mp3`;
        setEffectiveReciterId(reciter.id);
        setFallbackReason(null);
        setCurrentSurah(surahNumber);
        setCurrentAyah(null);
        setCurrentTrack(null);
        setAbLoop({ pointA: null, pointB: null, enabled: false });
        updateMediaSession(surahNumber, null, reciter.nameTh);
        void loadAndPlayUrl(url);
        return;
      }

      const { reciter: ayahReciter, reason } = resolveAyahReciter(targetReciterId);
      if (ayahReciter) {
        playAyahInternal(surahNumber, 1, ayahReciter, reason);
      }
    },
    [clearPauseTimer, getReciterById, loadAndPlayUrl, playAyahInternal, resolveAyahReciter, updateMediaSession]
  );

  const startHifzRangeLoop = useCallback(
    (cfg: HifzLoopConfig) => {
      clearPauseTimer();
      const { reciter, reason } = resolveAyahReciter(cfg.reciterId);
      if (!reciter) return;
      const start = Math.max(1, cfg.startAyah);
      const end = Math.max(start, cfg.endAyah);
      setHifzLoop({
        ...cfg,
        startAyah: start,
        endAyah: end,
        active: true,
        currentRepeat: 1,
        isWaitingPause: false,
      });
      playAyahInternal(cfg.surah, start, reciter, reason);
    },
    [clearPauseTimer, playAyahInternal, resolveAyahReciter]
  );

  const stopHifzLoop = useCallback(() => {
    clearPauseTimer();
    setHifzLoop(null);
  }, [clearPauseTimer]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (audio.paused) {
      void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      clearPauseTimer();
      audio.pause();
      setIsPlaying(false);
    }
  }, [clearPauseTimer]);

  const stopPlayback = useCallback(() => {
    clearPauseTimer();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setHifzLoop(null);
  }, [clearPauseTimer]);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
    setCurrentTime(audio.currentTime);
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  const skipNext = useCallback(() => {
    const st = stateRef.current;
    if (!st.currentSurah) return;
    if (st.currentAyah !== null) {
      const meta = st.surahsIndex.find((s) => s.number === st.currentSurah);
      const maxAyah = meta?.ayahCount ?? 999;
      if (st.currentAyah < maxAyah) {
        const rec = getReciterById(st.effectiveReciterId);
        if (rec && rec.mode === 'ayah') {
          playAyahInternal(st.currentSurah, st.currentAyah + 1, rec, st.fallbackReason);
        }
      }
    } else if (st.currentTrack && st.sheikhManifest) {
      const tracks = st.sheikhManifest.surahs[String(st.currentSurah)] ?? [];
      const idx = tracks.findIndex((t) => t.id === st.currentTrack?.id);
      if (idx >= 0 && idx + 1 < tracks.length) {
        playSurah(st.currentSurah, st.effectiveReciterId, tracks[idx + 1].id);
      } else {
        // Jump to next covered surah
        const nextSurah = Object.keys(st.sheikhManifest.surahs)
          .map(Number)
          .sort((a, b) => a - b)
          .find((n) => n > st.currentSurah!);
        if (nextSurah) {
          playSurah(nextSurah, st.effectiveReciterId);
        }
      }
    } else if (st.currentSurah < 114) {
      const rec = getReciterById(st.effectiveReciterId);
      if (rec?.mode === 'surah') {
        playSurah(st.currentSurah + 1, st.effectiveReciterId);
      }
    }
  }, [getReciterById, playAyahInternal, playSurah]);

  const skipPrev = useCallback(() => {
    const st = stateRef.current;
    if (!st.currentSurah) return;
    if (st.currentAyah !== null && st.currentAyah > 1) {
      const rec = getReciterById(st.effectiveReciterId);
      if (rec && rec.mode === 'ayah') {
        playAyahInternal(st.currentSurah, st.currentAyah - 1, rec, st.fallbackReason);
      }
    } else if (st.currentTrack && st.sheikhManifest) {
      const tracks = st.sheikhManifest.surahs[String(st.currentSurah)] ?? [];
      const idx = tracks.findIndex((t) => t.id === st.currentTrack?.id);
      if (idx > 0) {
        playSurah(st.currentSurah, st.effectiveReciterId, tracks[idx - 1].id);
      }
    } else if (st.currentSurah > 1) {
      const rec = getReciterById(st.effectiveReciterId);
      if (rec?.mode === 'surah') {
        playSurah(st.currentSurah - 1, st.effectiveReciterId);
      }
    }
  }, [getReciterById, playAyahInternal, playSurah]);

  // A-B Loop helpers
  const setPointA = useCallback(() => {
    const t = audioRef.current?.currentTime ?? 0;
    setAbLoop((prev) => ({
      pointA: t,
      pointB: prev.pointB !== null && prev.pointB > t ? prev.pointB : null,
      enabled: prev.pointB !== null && prev.pointB > t,
    }));
  }, []);

  const setPointB = useCallback(() => {
    const t = audioRef.current?.currentTime ?? 0;
    setAbLoop((prev) => {
      const a = prev.pointA ?? 0;
      if (t <= a + 0.3) return prev;
      return { pointA: a, pointB: t, enabled: true };
    });
  }, []);

  const toggleABLoop = useCallback(() => {
    setAbLoop((prev) => {
      if (prev.pointA === null || prev.pointB === null) return prev;
      return { ...prev, enabled: !prev.enabled };
    });
  }, []);

  const clearABLoop = useCallback(() => {
    setAbLoop({ pointA: null, pointB: null, enabled: false });
  }, []);

  // Sleep timer countdown
  const setSleepTimer = useCallback((minutes: number | null) => {
    if (minutes === null || minutes <= 0) {
      setSleepRemainingSec(null);
    } else {
      setSleepRemainingSec(minutes * 60);
    }
  }, []);

  useEffect(() => {
    if (sleepRemainingSec === null) return;
    const id = window.setInterval(() => {
      setSleepRemainingSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          audioRef.current?.pause();
          setIsPlaying(false);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [sleepRemainingSec !== null]);

  // Audio element lifecycle & ended handler
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    // IMPORTANT: Never set audio.crossOrigin so salafussaalih.net plays cleanly on Safari/iPadOS!
    audioRef.current = audio;

    const onTimeUpdate = () => {
      const t = audio.currentTime;
      setCurrentTime(t);
      const ab = stateRef.current.abLoop;
      if (ab.enabled && ab.pointA !== null && ab.pointB !== null && t >= ab.pointB) {
        audio.currentTime = ab.pointA;
      }
    };

    const onLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      audio.playbackRate = playbackRate;
    };

    const onEnded = () => {
      const st = stateRef.current;
      const loop = st.hifzLoop;

      if (loop && loop.active && st.currentSurah === loop.surah && st.currentAyah !== null) {
        const rec = getReciterById(st.effectiveReciterId);
        if (!rec) return;

        const schedulePlay = (nextAyah: number, nextRepeat: number) => {
          const delayMs = loop.pauseSec * 1000;
          if (delayMs > 0) {
            setHifzLoop((prev) => (prev ? { ...prev, isWaitingPause: true } : prev));
            pauseTimerRef.current = window.setTimeout(() => {
              setHifzLoop((prev) =>
                prev ? { ...prev, currentRepeat: nextRepeat, isWaitingPause: false } : prev
              );
              playAyahInternal(loop.surah, nextAyah, rec, st.fallbackReason);
            }, delayMs);
          } else {
            setHifzLoop((prev) =>
              prev ? { ...prev, currentRepeat: nextRepeat, isWaitingPause: false } : prev
            );
            playAyahInternal(loop.surah, nextAyah, rec, st.fallbackReason);
          }
        };

        if (loop.repeatPerAyah === 0 || loop.currentRepeat < loop.repeatPerAyah) {
          schedulePlay(st.currentAyah, loop.currentRepeat + 1);
          return;
        }
        const nextAyah = st.currentAyah < loop.endAyah ? st.currentAyah + 1 : loop.startAyah;
        schedulePlay(nextAyah, 1);
        return;
      }

      // Normal continuous playback across ayahs in Surah
      if (st.currentSurah && st.currentAyah !== null) {
        const meta = st.surahsIndex.find((s) => s.number === st.currentSurah);
        if (meta && st.currentAyah < meta.ayahCount) {
          const rec = getReciterById(st.effectiveReciterId);
          if (rec && rec.mode === 'ayah') {
            playAyahInternal(st.currentSurah, st.currentAyah + 1, rec, st.fallbackReason);
            return;
          }
        }
      }

      // Multi-part surah track continuation
      if (st.currentSurah && st.currentTrack && st.sheikhManifest) {
        const tracks = st.sheikhManifest.surahs[String(st.currentSurah)] ?? [];
        const idx = tracks.findIndex((t) => t.id === st.currentTrack?.id);
        if (idx >= 0 && idx + 1 < tracks.length) {
          playSurah(st.currentSurah, st.effectiveReciterId, tracks[idx + 1].id);
          return;
        }
      }

      // Full-surah continuous playback
      if (st.currentSurah && st.currentAyah === null && !st.currentTrack && st.currentSurah < 114) {
        const rec = getReciterById(st.effectiveReciterId);
        if (rec?.mode === 'surah') {
          playSurah(st.currentSurah + 1, st.effectiveReciterId);
          return;
        }
      }

      setIsPlaying(false);
    };

    const onError = () => {
      setIsLoadingAudio(false);
      setIsPlaying(false);
      setAudioError('ไม่สามารถโหลดไฟล์เสียงจากเซิร์ฟเวอร์ได้');
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        void audio.play().then(() => setIsPlaying(true));
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audio.pause();
        setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => skipPrev());
      navigator.mediaSession.setActionHandler('nexttrack', () => skipNext());
    }

    return () => {
      clearPauseTimer();
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [clearPauseTimer, getReciterById, playAyahInternal, playSurah, skipNext, skipPrev]);

  const effectiveReciter =
    reciters.find((r) => r.id === effectiveReciterId) ??
    reciters.find((r) => r.id === activeReciterId) ??
    null;

  return (
    <AudioContext.Provider
      value={{
        reciters,
        sheikhManifest,
        activeReciterId,
        setActiveReciterId,
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
        startHifzRangeLoop,
        stopHifzLoop,
        sleepRemainingSec,
        setSleepTimer,
        playSurah,
        playAyah,
        togglePlayPause,
        stopPlayback,
        seekTo,
        skipNext,
        skipPrev,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudio must be used inside AudioProvider');
  return ctx;
}
