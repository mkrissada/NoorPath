export type AppTab =
  | 'dashboard'
  | 'reader'
  | 'mushaf'
  | 'hifz'
  | 'audio'
  | 'hadith'
  | 'athkar'
  | 'settings';

export type ThemeMode = 'parchment' | 'light' | 'night';

export type MushafRenderMode = 'qcf-v2' | 'uthmani';

export type TranslationKey = 'th_kfgqpc' | 'th_rowwad';

export type MaskMode = 'full' | 'first-words' | 'first-letter' | 'cloze-50' | 'hidden';

export type HifzStatus = 'none' | 'learning' | 'memorized' | 'review';

export interface AyahRangeSegment {
  surah: number;
  from: number;
  to: number;
}

export interface SurahMeta {
  number: number;
  nameAr: string;
  nameEn: string;
  nameTh: string;
  defaultNameTh?: string;
  meaningTh: string;
  revelationType: 'Meccan' | 'Medinan' | string;
  ayahCount: number;
  hasSheikhAbdallahAudio: boolean;
  sheikhTrackCount: number;
  startPage?: number;
  endPage?: number;
  juzList?: number[];
}

export interface AyahData {
  number: number;
  globalNumber: number;
  arabic: string;
  words: string[];
  translations: {
    th_kfgqpc: string;
    th_rowwad: string;
  };
  footnotes: string;
  tafsir: string;
  page?: number;
  juz?: number;
  hizb?: number;
  hizbQuarter?: number;
}

export interface MushafPageInfo {
  page: number;
  juz: number;
  hizb: number;
  start: [number, number];
  end: [number, number];
  surahs: number[];
  ayahCount: number;
  segments: AyahRangeSegment[];
}

export interface JuzInfo {
  juz: number;
  startPage: number;
  endPage: number;
  start: [number, number];
  end: [number, number];
  ayahCount: number;
  surahs: number[];
  segments: AyahRangeSegment[];
}

export type QcfWordTuple = [number, number, 0 | 1, string];

export type QcfLineItem =
  | { t: 'surah'; s: number; l: number }
  | { t: 'bismillah'; s: number; l: number }
  | { t: 'words'; l: number; w: QcfWordTuple[] };

export interface QcfPageData {
  p: number;
  lines: QcfLineItem[];
}

export interface SurahPayload {
  number: number;
  metadata: SurahMeta;
  ayahs: AyahData[];
}

export interface SheikhTrack {
  id: string;
  partLabel: string;
  filename: string;
  remoteUrl: string;
  localUrl: string;
}

export interface SheikhManifest {
  reciterId: string;
  nameTh: string;
  nameEn: string;
  mode: 'surah-tracks';
  coveredSurahsCount: number;
  totalTracksCount: number;
  surahs: Record<string, SheikhTrack[]>;
}

export interface ReciterConfig {
  id: string;
  nameTh: string;
  nameEn: string;
  styleTh: string;
  mode: 'ayah' | 'surah' | 'surah-tracks';
  baseUrl?: string;
  manifestUrl?: string;
  isPartial: boolean;
}

export interface HadithItem {
  id: string;
  collection: 'nawawi40' | 'hadeethenc';
  number: number | string;
  titleTh: string;
  titleAr?: string;
  arabic: string;
  words: string[];
  thaiText: string;
  englishText: string;
  explanationTh: string;
  benefitsTh: string;
  gradeTh: string;
  takhrijTh: string;
  link?: string;
  matchedHadeethEncId?: string | null;
}

export interface HadeethEncIndexItem {
  id: string;
  titleTh: string;
  gradeTh: string;
  takhrijTh: string;
  previewTh: string;
}

export interface AthkarItem {
  id: number;
  title_th?: string;
  title_ar?: string;
  arabic: string;
  transliteration: string;
  translation_th: string;
  virtue?: string;
  repeat: number;
  reference?: string;
  is_quran?: boolean;
}

export interface AthkarCategory {
  id: string;
  title_th: string;
  title_ar: string;
  description: string;
  items: AthkarItem[];
}

export interface AthkarDataset {
  version: string;
  source: string;
  categories: AthkarCategory[];
}

export type AthkarMemoryStatus = 'learning' | 'review' | 'memorized';

export interface AthkarDailyLog {
  tapCount: number;
  sabah_completed?: boolean;
  masaa_completed?: boolean;
  completedCategories?: string[];
}

export interface AthkarStatsState {
  readCounts: Record<string, number>;
  memoryStatus: Record<string, AthkarMemoryStatus>;
  daily: Record<string, AthkarDailyLog>;
}

export interface BookmarkItem {
  id: string;
  type: 'quran' | 'hadith';
  title: string;
  subtitle: string;
  surah?: number;
  ayah?: number;
  hadithId?: string;
  collection?: 'nawawi40' | 'hadeethenc';
  note: string;
  createdAt: number;
  updatedAt?: number;
}

export interface HifzProgressEntry {
  status: HifzStatus;
  reviewCount: number;
  lastReviewedAt: number;
  updatedAt?: number;
  deleted?: boolean;
}

export interface LastReadState {
  surah: number;
  ayah: number;
  timestamp: number;
}

export interface MushafPageState {
  page: number;
  updatedAt: number;
}

export interface KhatmHistory {
  count: number;
  completedAt: number[];
  resetAt: number;
  updatedAt: number;
}

export interface ReadingLog {
  readAyahs: Record<string, number>;
  readHadith: Record<string, number>;
  dailyByDevice: Record<string, Record<string, number>>;
  khatm: KhatmHistory;
}

export interface AppSettings {
  theme: ThemeMode;
  arabicFontSize: number;
  thaiFontSize: number;
  mushafFontSize: number;
  mushafRenderMode: MushafRenderMode;
  mushafTwoPageSpread: boolean;
  autoTrackReading: boolean;
  activeTranslations: TranslationKey[];
  compareTranslations: boolean;
  showFootnotes: boolean;
  primaryReciterId: string;
  fallbackReciterId: string;
  useLocalSheikhAudio: boolean;
}

export interface SyncConfig {
  enabled: boolean;
  autoSync: boolean;
  webAppUrl: string;
  token: string;
  deviceId: string;
  deviceName: string;
  lastSyncedAt: number;
  lastPulledAt: number;
}

export type SyncRecordType =
  | 'hifz'
  | 'bookmark'
  | 'read'
  | 'readHadith'
  | 'daily'
  | 'singleton';

export interface SyncRecord {
  key: string;
  type: SyncRecordType;
  value: unknown;
  updatedAt: number;
  deviceId: string;
  deleted: boolean;
}

export interface SyncStateSnapshot {
  status: 'idle' | 'syncing' | 'error' | 'offline';
  pendingCount: number;
  lastSyncedAt: number;
  lastError: string | null;
}

export interface UserBackupPayload {
  version: 1 | 2;
  exportedAt: number;
  settings: AppSettings;
  lastRead: LastReadState;
  bookmarks: BookmarkItem[];
  hifzProgress: Record<string, HifzProgressEntry>;
  mushafPage?: MushafPageState;
  readingLog?: ReadingLog;
  customSurahNamesTh?: Record<string, string>;
}
