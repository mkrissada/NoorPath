import type {
  AppSettings,
  BookmarkItem,
  HifzProgressEntry,
  LastReadState,
  MushafPageState,
  ReadingLog,
  SyncConfig,
  SyncRecord,
  UserBackupPayload,
} from '../types/models.ts';

export const STORAGE_KEYS = {
  SETTINGS: 'noorpath:settings:v1',
  LAST_READ: 'noorpath:lastRead:v1',
  MUSHAF_PAGE: 'noorpath:mushafPage:v1',
  BOOKMARKS: 'noorpath:bookmarks:v1',
  HIFZ: 'noorpath:hifz:v1',
  READING: 'noorpath:reading:v1',
  CUSTOM_SURAH_NAMES: 'noorpath:customSurahNamesTh:v1',
  SYNC_CONFIG: 'noorpath:sync:config:v1',
  SYNC_OUTBOX: 'noorpath:sync:outbox:v1',
  SYNC_TOMBSTONES: 'noorpath:sync:tombstones:v1',
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'parchment',
  arabicFontSize: 30,
  thaiFontSize: 16,
  mushafFontSize: 30,
  mushafRenderMode: 'qcf-v2',
  mushafTwoPageSpread: true,
  autoTrackReading: true,
  activeTranslations: ['th_kfgqpc', 'th_rowwad'],
  compareTranslations: true,
  showFootnotes: true,
  primaryReciterId: 'sheikh-abdallah-humeid',
  fallbackReciterId: 'alafasy',
  useLocalSheikhAudio: false,
};

export const DEFAULT_LAST_READ: LastReadState = {
  surah: 1,
  ayah: 1,
  timestamp: 0,
};

export const DEFAULT_MUSHAF_PAGE: MushafPageState = {
  page: 1,
  updatedAt: 0,
};

export function createEmptyReadingLog(): ReadingLog {
  return {
    readAyahs: {},
    readHadith: {},
    dailyByDevice: {},
    khatm: {
      count: 0,
      completedAt: [],
      resetAt: 0,
      updatedAt: 0,
    },
  };
}

export function getLocalDateKey(ts = Date.now()): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getStorage(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage
      ? globalThis.localStorage
      : null;
  } catch {
    return null;
  }
}

export function hasStoredKey(key: string): boolean {
  const ls = getStorage();
  if (!ls) return false;
  try {
    return ls.getItem(key) !== null;
  } catch {
    return false;
  }
}

function readJson<T>(key: string, fallback: T): T {
  const ls = getStorage();
  if (!ls) return fallback;
  try {
    const raw = ls.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  const ls = getStorage();
  if (!ls) return;
  try {
    ls.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota errors cleanly
  }
}

export function loadSettings(): AppSettings {
  const saved = readJson<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {});
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    mushafRenderMode: 'qcf-v2',
    mushafFontSize:
      typeof saved.mushafFontSize === 'number'
        ? saved.mushafFontSize
        : saved.arabicFontSize ?? DEFAULT_SETTINGS.mushafFontSize,
    activeTranslations:
      Array.isArray(saved.activeTranslations) && saved.activeTranslations.length > 0
        ? saved.activeTranslations
        : DEFAULT_SETTINGS.activeTranslations,
  };
}

export function saveSettings(settings: AppSettings): void {
  writeJson(STORAGE_KEYS.SETTINGS, settings);
}

export function normalizeCustomSurahNames(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const num = Number(k);
    if (!Number.isInteger(num) || num < 1 || num > 114) continue;
    if (typeof v !== 'string') continue;
    const trimmed = v.trim();
    if (trimmed) {
      out[String(num)] = trimmed;
    }
  }
  return out;
}

export function loadCustomSurahNames(): Record<string, string> {
  return normalizeCustomSurahNames(readJson<unknown>(STORAGE_KEYS.CUSTOM_SURAH_NAMES, {}));
}

export function saveCustomSurahNames(map: Record<string, string>): void {
  writeJson(STORAGE_KEYS.CUSTOM_SURAH_NAMES, normalizeCustomSurahNames(map));
}

export function loadLastRead(): LastReadState {
  const saved = readJson<Partial<LastReadState>>(STORAGE_KEYS.LAST_READ, DEFAULT_LAST_READ);
  return {
    surah: typeof saved.surah === 'number' && saved.surah >= 1 && saved.surah <= 114 ? saved.surah : 1,
    ayah: typeof saved.ayah === 'number' && saved.ayah >= 1 ? saved.ayah : 1,
    timestamp: typeof saved.timestamp === 'number' ? saved.timestamp : 0,
  };
}

export function saveLastRead(lastRead: LastReadState): void {
  writeJson(STORAGE_KEYS.LAST_READ, lastRead);
}

export function loadMushafPage(): MushafPageState {
  const saved = readJson<Partial<MushafPageState>>(STORAGE_KEYS.MUSHAF_PAGE, DEFAULT_MUSHAF_PAGE);
  const page = typeof saved.page === 'number' ? Math.max(1, Math.min(604, Math.floor(saved.page))) : 1;
  return {
    page,
    updatedAt: typeof saved.updatedAt === 'number' ? saved.updatedAt : 0,
  };
}

export function saveMushafPage(state: MushafPageState): void {
  writeJson(STORAGE_KEYS.MUSHAF_PAGE, state);
}

export function normalizeBookmarks(items: unknown): BookmarkItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((b): b is BookmarkItem => Boolean(b && typeof b === 'object' && 'id' in b))
    .map((b) => ({
      ...b,
      note: typeof b.note === 'string' ? b.note : '',
      createdAt: typeof b.createdAt === 'number' ? b.createdAt : Date.now(),
      updatedAt:
        typeof b.updatedAt === 'number'
          ? b.updatedAt
          : typeof b.createdAt === 'number'
            ? b.createdAt
            : Date.now(),
    }));
}

export function loadBookmarks(): BookmarkItem[] {
  return normalizeBookmarks(readJson<unknown>(STORAGE_KEYS.BOOKMARKS, []));
}

export function saveBookmarks(bookmarks: BookmarkItem[]): void {
  writeJson(STORAGE_KEYS.BOOKMARKS, bookmarks);
}

export function normalizeHifzProgress(
  raw: unknown
): Record<string, HifzProgressEntry> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, HifzProgressEntry> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const e = v as Partial<HifzProgressEntry>;
    const lastReviewedAt = typeof e.lastReviewedAt === 'number' ? e.lastReviewedAt : 0;
    const updatedAt = typeof e.updatedAt === 'number' ? e.updatedAt : lastReviewedAt;
    if (e.deleted || e.status === 'none') {
      continue;
    }
    if (e.status === 'learning' || e.status === 'memorized' || e.status === 'review') {
      out[k] = {
        status: e.status,
        reviewCount: typeof e.reviewCount === 'number' ? e.reviewCount : 1,
        lastReviewedAt,
        updatedAt,
      };
    }
  }
  return out;
}

export function loadHifzProgress(): Record<string, HifzProgressEntry> {
  return normalizeHifzProgress(readJson<unknown>(STORAGE_KEYS.HIFZ, {}));
}

export function saveHifzProgress(progress: Record<string, HifzProgressEntry>): void {
  writeJson(STORAGE_KEYS.HIFZ, progress);
}

export function normalizeReadingLog(raw: unknown): ReadingLog {
  const empty = createEmptyReadingLog();
  if (!raw || typeof raw !== 'object') return empty;
  const r = raw as Partial<ReadingLog>;
  const readAyahs: Record<string, number> = {};
  if (r.readAyahs && typeof r.readAyahs === 'object') {
    for (const [k, v] of Object.entries(r.readAyahs)) {
      if (typeof v === 'number' && Number.isFinite(v)) readAyahs[k] = v;
    }
  }
  const readHadith: Record<string, number> = {};
  if (r.readHadith && typeof r.readHadith === 'object') {
    for (const [k, v] of Object.entries(r.readHadith)) {
      if (typeof v === 'number' && Number.isFinite(v)) readHadith[k] = v;
    }
  }
  const dailyByDevice: Record<string, Record<string, number>> = {};
  if (r.dailyByDevice && typeof r.dailyByDevice === 'object') {
    for (const [dateKey, devMap] of Object.entries(r.dailyByDevice)) {
      if (!devMap || typeof devMap !== 'object') continue;
      dailyByDevice[dateKey] = {};
      for (const [devId, count] of Object.entries(devMap)) {
        if (typeof count === 'number' && Number.isFinite(count) && count >= 0) {
          dailyByDevice[dateKey][devId] = count;
        }
      }
    }
  }
  const khatmRaw = (r.khatm && typeof r.khatm === 'object' ? r.khatm : {}) as Partial<
    ReadingLog['khatm']
  >;
  return {
    readAyahs,
    readHadith,
    dailyByDevice,
    khatm: {
      count: typeof khatmRaw.count === 'number' ? khatmRaw.count : 0,
      completedAt: Array.isArray(khatmRaw.completedAt)
        ? khatmRaw.completedAt.filter((n): n is number => typeof n === 'number')
        : [],
      resetAt: typeof khatmRaw.resetAt === 'number' ? khatmRaw.resetAt : 0,
      updatedAt: typeof khatmRaw.updatedAt === 'number' ? khatmRaw.updatedAt : 0,
    },
  };
}

export function loadReadingLog(): ReadingLog {
  return normalizeReadingLog(readJson<unknown>(STORAGE_KEYS.READING, {}));
}

export function saveReadingLog(log: ReadingLog): void {
  writeJson(STORAGE_KEYS.READING, log);
}

function generateDeviceId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Fallback below
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function detectDefaultDeviceName(): string {
  try {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/Android/i.test(ua)) return 'Android';
    if (/Mac/i.test(ua)) return 'Mac';
    if (/Windows/i.test(ua)) return 'Windows';
  } catch {
    // Ignore
  }
  return 'อุปกรณ์ของฉัน';
}

export function loadSyncConfig(): SyncConfig {
  const saved = readJson<Partial<SyncConfig>>(STORAGE_KEYS.SYNC_CONFIG, {});
  const hasDeviceId = typeof saved.deviceId === 'string' && saved.deviceId.trim().length > 0;
  const config: SyncConfig = {
    enabled: Boolean(saved.enabled),
    autoSync: saved.autoSync !== undefined ? Boolean(saved.autoSync) : true,
    webAppUrl: typeof saved.webAppUrl === 'string' ? saved.webAppUrl : '',
    token: typeof saved.token === 'string' ? saved.token : '',
    deviceId: hasDeviceId ? saved.deviceId! : generateDeviceId(),
    deviceName:
      typeof saved.deviceName === 'string' && saved.deviceName.trim()
        ? saved.deviceName
        : detectDefaultDeviceName(),
    lastSyncedAt: typeof saved.lastSyncedAt === 'number' ? saved.lastSyncedAt : 0,
    lastPulledAt: typeof saved.lastPulledAt === 'number' ? saved.lastPulledAt : 0,
  };
  if (!hasDeviceId && getStorage()) {
    writeJson(STORAGE_KEYS.SYNC_CONFIG, config);
  }
  return config;
}

export function saveSyncConfig(config: SyncConfig): void {
  writeJson(STORAGE_KEYS.SYNC_CONFIG, config);
}

export function loadSyncOutbox(): Record<string, SyncRecord> {
  const raw = readJson<unknown>(STORAGE_KEYS.SYNC_OUTBOX, {});
  if (!raw || typeof raw !== 'object') return {};
  return raw as Record<string, SyncRecord>;
}

export function saveSyncOutbox(outbox: Record<string, SyncRecord>): void {
  writeJson(STORAGE_KEYS.SYNC_OUTBOX, outbox);
}

export function loadSyncTombstones(): Record<string, number> {
  const raw = readJson<unknown>(STORAGE_KEYS.SYNC_TOMBSTONES, {});
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

export function saveSyncTombstones(tombstones: Record<string, number>): void {
  writeJson(STORAGE_KEYS.SYNC_TOMBSTONES, tombstones);
}

export function exportUserData(): string {
  const payload: UserBackupPayload = {
    version: 2,
    exportedAt: Date.now(),
    settings: loadSettings(),
    lastRead: loadLastRead(),
    bookmarks: loadBookmarks(),
    hifzProgress: loadHifzProgress(),
    mushafPage: loadMushafPage(),
    readingLog: loadReadingLog(),
    customSurahNamesTh: loadCustomSurahNames(),
  };
  return JSON.stringify(payload, null, 2);
}

export function importUserData(rawJson: string): UserBackupPayload {
  const parsed = JSON.parse(rawJson) as Partial<UserBackupPayload>;
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed.version !== 1 && parsed.version !== 2)
  ) {
    throw new Error('รูปแบบไฟล์สำรองข้อมูล NoorPath ไม่ถูกต้อง');
  }

  const nextSettings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...(parsed.settings ?? {}),
    mushafRenderMode: 'qcf-v2',
    activeTranslations:
      Array.isArray(parsed.settings?.activeTranslations) &&
      parsed.settings.activeTranslations.length > 0
        ? parsed.settings.activeTranslations
        : DEFAULT_SETTINGS.activeTranslations,
  };
  const nextLastRead: LastReadState = parsed.lastRead
    ? {
        surah: parsed.lastRead.surah ?? 1,
        ayah: parsed.lastRead.ayah ?? 1,
        timestamp: parsed.lastRead.timestamp ?? Date.now(),
      }
    : DEFAULT_LAST_READ;
  const nextBookmarks = normalizeBookmarks(parsed.bookmarks);
  const nextHifz = normalizeHifzProgress(parsed.hifzProgress);
  const nextMushafPage: MushafPageState = parsed.mushafPage
    ? {
        page: Math.max(1, Math.min(604, Math.floor(parsed.mushafPage.page ?? 1))),
        updatedAt: parsed.mushafPage.updatedAt ?? Date.now(),
      }
    : loadMushafPage();
  const nextReadingLog: ReadingLog = parsed.readingLog
    ? normalizeReadingLog(parsed.readingLog)
    : loadReadingLog();
  const nextCustomSurahNames: Record<string, string> =
    parsed.customSurahNamesTh && typeof parsed.customSurahNamesTh === 'object'
      ? normalizeCustomSurahNames(parsed.customSurahNamesTh)
      : loadCustomSurahNames();

  saveSettings(nextSettings);
  saveLastRead(nextLastRead);
  saveBookmarks(nextBookmarks);
  saveHifzProgress(nextHifz);
  saveMushafPage(nextMushafPage);
  saveReadingLog(nextReadingLog);
  saveCustomSurahNames(nextCustomSurahNames);

  return {
    version: 2,
    exportedAt: parsed.exportedAt ?? Date.now(),
    settings: nextSettings,
    lastRead: nextLastRead,
    bookmarks: nextBookmarks,
    hifzProgress: nextHifz,
    mushafPage: nextMushafPage,
    readingLog: nextReadingLog,
    customSurahNamesTh: nextCustomSurahNames,
  };
}
