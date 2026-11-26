import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getJuzIndex, getMushafPages, getSurahsIndex } from '../lib/dataLoader';
import {
  exportUserData,
  getLocalDateKey,
  importUserData,
  loadBookmarks,
  loadCustomSurahNames,
  loadHifzProgress,
  loadLastRead,
  loadMushafPage,
  loadReadingLog,
  loadSettings,
  loadSyncConfig,
  loadSyncOutbox,
  loadSyncTombstones,
  saveBookmarks,
  saveCustomSurahNames,
  saveHifzProgress,
  saveLastRead,
  saveMushafPage,
  saveReadingLog,
  saveSettings,
  saveSyncConfig,
} from '../lib/storage';
import {
  type LocalSyncState,
  type SyncRunResult,
  buildInitialOutboxFromLocalState,
  enqueueSyncRecords,
  makeBookmarkRecord,
  makeDailyRecord,
  makeHifzRecord,
  makeKhatmRecord,
  makeLastReadRecord,
  makeMushafPageRecord,
  makeReadAyahRecord,
  makeReadHadithRecord,
  pingSyncEndpoint,
  syncNow as runSyncNow,
} from '../lib/sync';
import type {
  AppSettings,
  AppTab,
  BookmarkItem,
  HifzProgressEntry,
  HifzStatus,
  JuzInfo,
  LastReadState,
  MushafPageInfo,
  MushafPageState,
  ReadingLog,
  SurahMeta,
  SyncConfig,
  SyncRecord,
  SyncStateSnapshot,
} from '../types/models';

interface ReaderTarget {
  surah: number;
  ayah: number;
  nonce: number;
}

interface MushafTarget {
  page: number;
  surah?: number;
  ayah?: number;
  nonce: number;
}

interface HifzTarget {
  surah: number;
  startAyah: number;
  endAyah: number;
  nonce: number;
}

interface HadithTarget {
  collection: 'nawawi40' | 'hadeethenc';
  id: string;
  nonce: number;
}

interface AppContextValue {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  lastRead: LastReadState;
  updateLastRead: (surah: number, ayah: number) => void;
  mushafPage: MushafPageState;
  updateMushafPage: (page: number) => void;
  surahsIndex: SurahMeta[];
  customSurahNamesTh: Record<string, string>;
  setCustomSurahNameTh: (surahNumber: number, nameTh: string) => void;
  resetCustomSurahNameTh: (surahNumber: number) => void;
  resetAllCustomSurahNamesTh: () => void;
  mushafPages: MushafPageInfo[];
  juzIndex: JuzInfo[];
  surahsLoading: boolean;
  bookmarks: BookmarkItem[];
  isBookmarked: (id: string) => boolean;
  toggleBookmark: (item: Omit<BookmarkItem, 'createdAt' | 'note'> & { note?: string }) => void;
  updateBookmarkNote: (id: string, note: string) => void;
  hifzProgress: Record<string, HifzProgressEntry>;
  getHifzStatus: (key: string) => HifzStatus;
  setHifzStatus: (key: string, status: HifzStatus) => void;
  readingLog: ReadingLog;
  isAyahRead: (surah: number, ayah: number) => boolean;
  markAyahsRead: (ayahKeys: string[]) => void;
  markSurahRead: (surahNumber: number, ayahCount: number) => void;
  isHadithRead: (collection: 'nawawi40' | 'hadeethenc', id: string) => boolean;
  markHadithRead: (collection: 'nawawi40' | 'hadeethenc', id: string) => void;
  completeKhatmAndReset: () => void;
  readerTarget: ReaderTarget | null;
  jumpToReader: (surah: number, ayah?: number) => void;
  mushafTarget: MushafTarget | null;
  jumpToMushaf: (target: { page?: number; surah?: number; ayah?: number }) => void;
  hifzTarget: HifzTarget | null;
  jumpToHifz: (surah: number, startAyah: number, endAyah?: number) => void;
  hadithTarget: HadithTarget | null;
  jumpToHadith: (collection: 'nawawi40' | 'hadeethenc', id: string) => void;
  exportBackupJson: () => string;
  importBackupJson: (rawJson: string) => void;
  syncConfig: SyncConfig;
  updateSyncConfig: (patch: Partial<SyncConfig>) => void;
  syncState: SyncStateSnapshot;
  syncNow: () => Promise<SyncRunResult>;
  pingSync: (
    webAppUrl?: string,
    token?: string
  ) => Promise<{ ok: boolean; error?: string; totalRecords?: number }>;
}

const AppContext = createContext<AppContextValue | null>(null);

const THEME_META_COLOR: Record<AppSettings['theme'], string> = {
  parchment: '#0F6B53',
  light: '#0D7057',
  night: '#0D131A',
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<AppTab>('reader');
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [lastRead, setLastRead] = useState<LastReadState>(() => loadLastRead());
  const [mushafPage, setMushafPage] = useState<MushafPageState>(() => loadMushafPage());
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => loadBookmarks());
  const [hifzProgress, setHifzProgress] = useState<Record<string, HifzProgressEntry>>(() =>
    loadHifzProgress()
  );
  const [readingLog, setReadingLog] = useState<ReadingLog>(() => loadReadingLog());
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(() => loadSyncConfig());
  const [syncState, setSyncState] = useState<SyncStateSnapshot>(() => ({
    status:
      typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'idle',
    pendingCount: Object.keys(loadSyncOutbox()).length,
    lastSyncedAt: loadSyncConfig().lastSyncedAt,
    lastError: null,
  }));

  const [rawSurahsIndex, setRawSurahsIndex] = useState<SurahMeta[]>([]);
  const [customSurahNamesTh, setCustomSurahNamesTh] = useState<Record<string, string>>(() =>
    loadCustomSurahNames()
  );
  const [mushafPages, setMushafPages] = useState<MushafPageInfo[]>([]);
  const [juzIndex, setJuzIndex] = useState<JuzInfo[]>([]);
  const [surahsLoading, setSurahsLoading] = useState(true);

  const [readerTarget, setReaderTarget] = useState<ReaderTarget | null>(null);
  const [mushafTarget, setMushafTarget] = useState<MushafTarget | null>(null);
  const [hifzTarget, setHifzTarget] = useState<HifzTarget | null>(null);
  const [hadithTarget, setHadithTarget] = useState<HadithTarget | null>(null);

  const syncConfigRef = useRef(syncConfig);
  syncConfigRef.current = syncConfig;

  const localStateRef = useRef<LocalSyncState>({
    hifzProgress,
    bookmarks,
    readingLog,
    lastRead,
    mushafPage,
    tombstones: loadSyncTombstones(),
  });
  localStateRef.current = {
    hifzProgress,
    bookmarks,
    readingLog,
    lastRead,
    mushafPage,
    tombstones: loadSyncTombstones(),
  };

  const syncInFlightRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', THEME_META_COLOR[settings.theme]);
    }
  }, [settings.theme]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getSurahsIndex(),
      getMushafPages().catch(() => [] as MushafPageInfo[]),
      getJuzIndex().catch(() => [] as JuzInfo[]),
    ])
      .then(([surahs, pages, juz]) => {
        if (!mounted) return;
        setRawSurahsIndex(surahs);
        setMushafPages(pages);
        setJuzIndex(juz);
        setSurahsLoading(false);
      })
      .catch(() => {
        if (mounted) setSurahsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const updateSyncConfig = useCallback((patch: Partial<SyncConfig>) => {
    setSyncConfig((prev) => {
      const next = { ...prev, ...patch };
      saveSyncConfig(next);
      return next;
    });
  }, []);

  const syncNow = useCallback(async (): Promise<SyncRunResult> => {
    if (syncInFlightRef.current) {
      return {
        ok: false,
        error: 'กำลังซิงก์อยู่แล้ว',
        pushedCount: 0,
        pulledCount: 0,
        mergedState: localStateRef.current,
        stateChanged: false,
        nextLastPulledAt: syncConfigRef.current.lastPulledAt,
        pendingCount: Object.keys(loadSyncOutbox()).length,
      };
    }

    syncInFlightRef.current = true;
    setSyncState((prev) => ({ ...prev, status: 'syncing', lastError: null }));
    try {
      const res = await runSyncNow(syncConfigRef.current, localStateRef.current);
      if (res.ok) {
        if (res.stateChanged) {
          setHifzProgress(res.mergedState.hifzProgress);
          saveHifzProgress(res.mergedState.hifzProgress);
          setBookmarks(res.mergedState.bookmarks);
          saveBookmarks(res.mergedState.bookmarks);
          setReadingLog(res.mergedState.readingLog);
          saveReadingLog(res.mergedState.readingLog);
          setLastRead(res.mergedState.lastRead);
          saveLastRead(res.mergedState.lastRead);
          setMushafPage(res.mergedState.mushafPage);
          saveMushafPage(res.mergedState.mushafPage);
        }
        const syncedAt = res.serverTime ?? Date.now();
        updateSyncConfig({
          lastSyncedAt: syncedAt,
          lastPulledAt: res.nextLastPulledAt,
        });
        setSyncState({
          status: 'idle',
          pendingCount: res.pendingCount,
          lastSyncedAt: syncedAt,
          lastError: null,
        });
      } else {
        setSyncState((prev) => ({
          ...prev,
          status: res.offline ? 'offline' : 'error',
          pendingCount: res.pendingCount,
          lastError: res.error ?? 'ซิงก์ไม่สำเร็จ',
        }));
      }
      return res;
    } finally {
      syncInFlightRef.current = false;
    }
  }, [updateSyncConfig]);

  const queueSync = useCallback(
    (records: SyncRecord[]) => {
      if (records.length === 0) return;
      const pendingCount = enqueueSyncRecords(records);
      setSyncState((prev) => ({ ...prev, pendingCount }));
      const cfg = syncConfigRef.current;
      if (cfg.enabled && cfg.autoSync && cfg.webAppUrl.trim() && cfg.token.trim()) {
        if (syncTimerRef.current !== null) {
          window.clearTimeout(syncTimerRef.current);
        }
        syncTimerRef.current = window.setTimeout(() => {
          syncTimerRef.current = null;
          void syncNow();
        }, 4000);
      }
    },
    [syncNow]
  );

  // Auto-sync on launch, reconnect, and tab visibility return
  useEffect(() => {
    const cfg = syncConfigRef.current;
    if (cfg.enabled && cfg.autoSync && cfg.webAppUrl.trim() && cfg.token.trim()) {
      void syncNow();
    }

    const handleOnline = () => {
      const c = syncConfigRef.current;
      setSyncState((prev) => ({
        ...prev,
        status: prev.status === 'offline' ? 'idle' : prev.status,
      }));
      if (c.enabled && c.autoSync && c.webAppUrl.trim() && c.token.trim()) {
        void syncNow();
      }
    };

    const handleOffline = () => {
      setSyncState((prev) => ({ ...prev, status: 'offline' }));
    };

    const handleVisibility = () => {
      const c = syncConfigRef.current;
      if (!c.enabled || !c.autoSync || !c.webAppUrl.trim() || !c.token.trim()) return;
      if (!document.hidden || Object.keys(loadSyncOutbox()).length > 0) {
        void syncNow();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
      }
    };
  }, [syncNow]);

  const surahsIndex = useMemo(() => {
    return rawSurahsIndex.map((s) => {
      const custom = customSurahNamesTh[String(s.number)]?.trim();
      return {
        ...s,
        defaultNameTh: s.nameTh,
        nameTh: custom || s.nameTh,
      };
    });
  }, [rawSurahsIndex, customSurahNamesTh]);

  const setCustomSurahNameTh = useCallback(
    (surahNumber: number, nameTh: string) => {
      const key = String(surahNumber);
      const trimmed = nameTh.trim();
      const defaultName = rawSurahsIndex.find((s) => s.number === surahNumber)?.nameTh ?? '';
      setCustomSurahNamesTh((prev) => {
        const next = { ...prev };
        if (!trimmed || trimmed === defaultName) {
          delete next[key];
        } else {
          next[key] = trimmed;
        }
        saveCustomSurahNames(next);
        return next;
      });
    },
    [rawSurahsIndex]
  );

  const resetCustomSurahNameTh = useCallback((surahNumber: number) => {
    const key = String(surahNumber);
    setCustomSurahNamesTh((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      saveCustomSurahNames(next);
      return next;
    });
  }, []);

  const resetAllCustomSurahNamesTh = useCallback(() => {
    setCustomSurahNamesTh({});
    saveCustomSurahNames({});
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const updateLastRead = useCallback(
    (surah: number, ayah: number) => {
      setLastRead((prev) => {
        if (prev.surah === surah && prev.ayah === ayah && prev.timestamp > 0) {
          return prev;
        }
        const next: LastReadState = { surah, ayah, timestamp: Date.now() };
        saveLastRead(next);
        queueSync([makeLastReadRecord(next, syncConfigRef.current.deviceId)]);
        return next;
      });
    },
    [queueSync]
  );

  const updateMushafPage = useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(604, Math.floor(page)));
      setMushafPage((prev) => {
        if (prev.page === clamped && prev.updatedAt > 0) {
          return prev;
        }
        const next: MushafPageState = { page: clamped, updatedAt: Date.now() };
        saveMushafPage(next);
        queueSync([makeMushafPageRecord(next, syncConfigRef.current.deviceId)]);
        return next;
      });
    },
    [queueSync]
  );

  const isBookmarked = useCallback(
    (id: string) => bookmarks.some((b) => b.id === id),
    [bookmarks]
  );

  const toggleBookmark = useCallback(
    (item: Omit<BookmarkItem, 'createdAt' | 'note'> & { note?: string }) => {
      const now = Date.now();
      const devId = syncConfigRef.current.deviceId;
      let emittedRecord: SyncRecord | null = null;
      setBookmarks((prev) => {
        const exists = prev.some((b) => b.id === item.id);
        let next: BookmarkItem[];
        if (exists) {
          next = prev.filter((b) => b.id !== item.id);
          emittedRecord = makeBookmarkRecord(item.id, null, devId, now);
        } else {
          const created: BookmarkItem = {
            ...item,
            note: item.note ?? '',
            createdAt: now,
            updatedAt: now,
          };
          next = [created, ...prev];
          emittedRecord = makeBookmarkRecord(item.id, created, devId, now);
        }
        saveBookmarks(next);
        return next;
      });
      if (emittedRecord) queueSync([emittedRecord]);
    },
    [queueSync]
  );

  const updateBookmarkNote = useCallback(
    (id: string, note: string) => {
      const now = Date.now();
      const devId = syncConfigRef.current.deviceId;
      let updatedItem: BookmarkItem | null = null;
      setBookmarks((prev) => {
        const next = prev.map((b) => {
          if (b.id !== id) return b;
          updatedItem = { ...b, note, updatedAt: now };
          return updatedItem;
        });
        saveBookmarks(next);
        return next;
      });
      if (updatedItem) {
        queueSync([makeBookmarkRecord(id, updatedItem, devId, now)]);
      }
    },
    [queueSync]
  );

  const getHifzStatus = useCallback(
    (key: string): HifzStatus => {
      const entry = hifzProgress[key];
      if (!entry || entry.deleted) return 'none';
      return entry.status ?? 'none';
    },
    [hifzProgress]
  );

  const setHifzStatus = useCallback(
    (key: string, status: HifzStatus) => {
      const now = Date.now();
      const devId = syncConfigRef.current.deviceId;
      let record: SyncRecord | null = null;
      setHifzProgress((prev) => {
        const next = { ...prev };
        if (status === 'none') {
          delete next[key];
          record = makeHifzRecord(key, null, devId, now);
        } else {
          const existing = next[key];
          const updatedEntry: HifzProgressEntry = {
            status,
            reviewCount: (existing?.reviewCount ?? 0) + 1,
            lastReviewedAt: now,
            updatedAt: now,
          };
          next[key] = updatedEntry;
          record = makeHifzRecord(key, updatedEntry, devId, now);
        }
        saveHifzProgress(next);
        return next;
      });
      if (record) queueSync([record]);
    },
    [queueSync]
  );

  const isAyahRead = useCallback(
    (surah: number, ayah: number) => {
      const resetAt = readingLog.khatm?.resetAt || 0;
      return (readingLog.readAyahs[`${surah}:${ayah}`] ?? 0) > resetAt;
    },
    [readingLog]
  );

  const markAyahsRead = useCallback(
    (ayahKeys: string[]) => {
      if (ayahKeys.length === 0) return;
      const now = Date.now();
      const devId = syncConfigRef.current.deviceId;
      const dateKey = getLocalDateKey(now);
      const emitted: SyncRecord[] = [];

      setReadingLog((prev) => {
        const resetAt = prev.khatm?.resetAt || 0;
        let newCount = 0;
        const nextReadAyahs = { ...prev.readAyahs };

        for (const k of ayahKeys) {
          if ((nextReadAyahs[k] ?? 0) <= resetAt) {
            nextReadAyahs[k] = now;
            newCount++;
            emitted.push(makeReadAyahRecord(k, now, devId));
          }
        }

        if (newCount === 0) return prev;

        const nextDailyByDevice = { ...prev.dailyByDevice };
        const dayMap = { ...(nextDailyByDevice[dateKey] ?? {}) };
        const nextDeviceCount = (dayMap[devId] ?? 0) + newCount;
        dayMap[devId] = nextDeviceCount;
        nextDailyByDevice[dateKey] = dayMap;
        emitted.push(makeDailyRecord(dateKey, devId, nextDeviceCount, now));

        const next: ReadingLog = {
          ...prev,
          readAyahs: nextReadAyahs,
          dailyByDevice: nextDailyByDevice,
        };
        saveReadingLog(next);
        return next;
      });

      if (emitted.length > 0) queueSync(emitted);
    },
    [queueSync]
  );

  const markSurahRead = useCallback(
    (surahNumber: number, ayahCount: number) => {
      const keys: string[] = [];
      for (let a = 1; a <= ayahCount; a++) {
        keys.push(`${surahNumber}:${a}`);
      }
      markAyahsRead(keys);
    },
    [markAyahsRead]
  );

  const isHadithRead = useCallback(
    (collection: 'nawawi40' | 'hadeethenc', id: string) =>
      (readingLog.readHadith[`${collection}:${id}`] ?? 0) > 0,
    [readingLog]
  );

  const markHadithRead = useCallback(
    (collection: 'nawawi40' | 'hadeethenc', id: string) => {
      const key = `${collection}:${id}`;
      const now = Date.now();
      const devId = syncConfigRef.current.deviceId;
      let emitted: SyncRecord | null = null;

      setReadingLog((prev) => {
        if ((prev.readHadith[key] ?? 0) > 0) return prev;
        const next: ReadingLog = {
          ...prev,
          readHadith: { ...prev.readHadith, [key]: now },
        };
        saveReadingLog(next);
        emitted = makeReadHadithRecord(key, now, devId);
        return next;
      });

      if (emitted) queueSync([emitted]);
    },
    [queueSync]
  );

  const completeKhatmAndReset = useCallback(() => {
    const now = Date.now();
    const devId = syncConfigRef.current.deviceId;
    let record: SyncRecord | null = null;

    setReadingLog((prev) => {
      const nextKhatm = {
        count: (prev.khatm?.count ?? 0) + 1,
        completedAt: [...(prev.khatm?.completedAt ?? []), now],
        resetAt: now,
        updatedAt: now,
      };
      const next: ReadingLog = {
        ...prev,
        khatm: nextKhatm,
      };
      saveReadingLog(next);
      record = makeKhatmRecord(nextKhatm, devId);
      return next;
    });

    if (record) queueSync([record]);
  }, [queueSync]);

  const jumpToReader = useCallback((surah: number, ayah = 1) => {
    setReaderTarget({ surah, ayah, nonce: Date.now() });
    setActiveTab('reader');
  }, []);

  const jumpToMushaf = useCallback(
    (target: { page?: number; surah?: number; ayah?: number }) => {
      let resolvedPage = target.page;
      if (!resolvedPage && target.surah) {
        const ayahNum = target.ayah ?? 1;
        const match = mushafPages.find((p) =>
          p.segments.some(
            (seg) => seg.surah === target.surah && ayahNum >= seg.from && ayahNum <= seg.to
          )
        );
        resolvedPage =
          match?.page ??
          surahsIndex.find((s) => s.number === target.surah)?.startPage ??
          1;
      }
      const page = Math.max(1, Math.min(604, resolvedPage ?? mushafPage.page ?? 1));
      setMushafTarget({
        page,
        surah: target.surah,
        ayah: target.ayah,
        nonce: Date.now(),
      });
      setActiveTab('mushaf');
    },
    [mushafPages, surahsIndex, mushafPage.page]
  );

  const jumpToHifz = useCallback((surah: number, startAyah: number, endAyah?: number) => {
    setHifzTarget({
      surah,
      startAyah,
      endAyah: endAyah ?? startAyah,
      nonce: Date.now(),
    });
    setActiveTab('hifz');
  }, []);

  const jumpToHadith = useCallback((collection: 'nawawi40' | 'hadeethenc', id: string) => {
    setHadithTarget({ collection, id, nonce: Date.now() });
    setActiveTab('hadith');
  }, []);

  const exportBackupJson = useCallback(() => exportUserData(), []);

  const importBackupJson = useCallback(
    (rawJson: string) => {
      const restored = importUserData(rawJson);
      setSettings(restored.settings);
      setLastRead(restored.lastRead);
      setBookmarks(restored.bookmarks);
      setHifzProgress(restored.hifzProgress);
      if (restored.mushafPage) setMushafPage(restored.mushafPage);
      if (restored.readingLog) setReadingLog(restored.readingLog);
      if (restored.customSurahNamesTh) {
        setCustomSurahNamesTh(restored.customSurahNamesTh);
      }

      const snapshot: LocalSyncState = {
        hifzProgress: restored.hifzProgress,
        bookmarks: restored.bookmarks,
        readingLog: restored.readingLog ?? loadReadingLog(),
        lastRead: restored.lastRead,
        mushafPage: restored.mushafPage ?? loadMushafPage(),
        tombstones: loadSyncTombstones(),
      };
      const records = buildInitialOutboxFromLocalState(
        snapshot,
        syncConfigRef.current.deviceId
      );
      queueSync(records);
    },
    [queueSync]
  );

  const pingSync = useCallback(
    async (webAppUrl?: string, token?: string) =>
      pingSyncEndpoint(
        webAppUrl ?? syncConfigRef.current.webAppUrl,
        token ?? syncConfigRef.current.token
      ),
    []
  );

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        settings,
        updateSettings,
        lastRead,
        updateLastRead,
        mushafPage,
        updateMushafPage,
        surahsIndex,
        customSurahNamesTh,
        setCustomSurahNameTh,
        resetCustomSurahNameTh,
        resetAllCustomSurahNamesTh,
        mushafPages,
        juzIndex,
        surahsLoading,
        bookmarks,
        isBookmarked,
        toggleBookmark,
        updateBookmarkNote,
        hifzProgress,
        getHifzStatus,
        setHifzStatus,
        readingLog,
        isAyahRead,
        markAyahsRead,
        markSurahRead,
        isHadithRead,
        markHadithRead,
        completeKhatmAndReset,
        readerTarget,
        jumpToReader,
        mushafTarget,
        jumpToMushaf,
        hifzTarget,
        jumpToHifz,
        hadithTarget,
        jumpToHadith,
        exportBackupJson,
        importBackupJson,
        syncConfig,
        updateSyncConfig,
        syncState,
        syncNow,
        pingSync,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
