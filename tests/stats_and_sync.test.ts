import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { computeContentStats, computePersonalStats } from '../src/lib/stats.ts';
import {
  DEFAULT_SETTINGS,
  createEmptyReadingLog,
  exportUserData,
  getLocalDateKey,
  importUserData,
  saveSyncConfig,
} from '../src/lib/storage.ts';
import {
  buildInitialOutboxFromLocalState,
  makeBookmarkRecord,
  makeHifzRecord,
  mergeRemoteRecords,
  type LocalSyncState,
} from '../src/lib/sync.ts';
import type { JuzInfo, MushafPageInfo, SurahMeta } from '../src/types/models.ts';

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

const SAMPLE_SURAHS: SurahMeta[] = [
  {
    number: 1,
    nameAr: 'الفاتحة',
    nameEn: 'Al-Faatiha',
    nameTh: 'อัล-ฟาติหะฮ์',
    meaningTh: 'การเปิด',
    revelationType: 'Meccan',
    ayahCount: 7,
    hasSheikhAbdallahAudio: true,
    sheikhTrackCount: 1,
    startPage: 1,
    endPage: 1,
    juzList: [1],
  },
  {
    number: 112,
    nameAr: 'الإخلاص',
    nameEn: 'Al-Ikhlaas',
    nameTh: 'อัล-อิคลาศ',
    meaningTh: 'ความบริสุทธิ์ใจ',
    revelationType: 'Meccan',
    ayahCount: 4,
    hasSheikhAbdallahAudio: false,
    sheikhTrackCount: 0,
    startPage: 604,
    endPage: 604,
    juzList: [30],
  },
];

const SAMPLE_PAGES: MushafPageInfo[] = [
  {
    page: 1,
    juz: 1,
    hizb: 1,
    start: [1, 1],
    end: [1, 7],
    surahs: [1],
    ayahCount: 7,
    segments: [{ surah: 1, from: 1, to: 7 }],
  },
  {
    page: 604,
    juz: 30,
    hizb: 60,
    start: [112, 1],
    end: [112, 4],
    surahs: [112],
    ayahCount: 4,
    segments: [{ surah: 112, from: 1, to: 4 }],
  },
];

const SAMPLE_JUZ: JuzInfo[] = [
  {
    juz: 1,
    startPage: 1,
    endPage: 21,
    start: [1, 1],
    end: [1, 7],
    ayahCount: 7,
    surahs: [1],
    segments: [{ surah: 1, from: 1, to: 7 }],
  },
  {
    juz: 30,
    startPage: 582,
    endPage: 604,
    start: [112, 1],
    end: [112, 4],
    ayahCount: 4,
    surahs: [112],
    segments: [{ surah: 112, from: 1, to: 4 }],
  },
];

test('computeContentStats computes Meccan/Medinan and Hadith totals', () => {
  const stats = computeContentStats({
    surahsIndex: SAMPLE_SURAHS,
    mushafPagesCount: 604,
    juzCount: 30,
    nawawiCount: 42,
    hadeethEncCount: 846,
    recitersCount: 5,
    sheikhCoveredSurahs: 91,
    sheikhTotalTracks: 103,
  });
  assert.equal(stats.totalSurahs, 2);
  assert.equal(stats.meccanSurahs, 2);
  assert.equal(stats.medinanSurahs, 0);
  assert.equal(stats.totalAyahs, 11);
  assert.equal(stats.totalHadith, 888);
  assert.equal(stats.totalMushafPages, 604);
});

test('computePersonalStats respects khatm resetAt, multi-device daily sums, and streaks', () => {
  const readingLog = createEmptyReadingLog();
  readingLog.khatm = {
    count: 1,
    completedAt: [1000],
    resetAt: 2000,
    updatedAt: 2000,
  };
  // Surah 1: ayahs 1..7 read AFTER resetAt (3000); Surah 112:1 read BEFORE resetAt (1500)
  for (let a = 1; a <= 7; a++) {
    readingLog.readAyahs[`1:${a}`] = 3000;
  }
  readingLog.readAyahs['112:1'] = 1500;
  readingLog.readHadith = {
    'nawawi40:nawawi-1': 3500,
    'hadeethenc:1751': 3600,
  };
  readingLog.dailyByDevice = {
    '2026-11-21': { ipad: 3 },
    '2026-11-22': { ipad: 5 },
    '2026-11-23': { iphone: 2, ipad: 2 },
    '2026-11-24': { ipad: 7 },
  };

  const hifzProgress = {
    '112:1': { status: 'memorized' as const, reviewCount: 2, lastReviewedAt: 4000 },
    '112:2': { status: 'memorized' as const, reviewCount: 1, lastReviewedAt: 4000 },
    '112:3': { status: 'memorized' as const, reviewCount: 1, lastReviewedAt: 4000 },
    '112:4': { status: 'memorized' as const, reviewCount: 1, lastReviewedAt: 4000 },
    '1:1': { status: 'learning' as const, reviewCount: 1, lastReviewedAt: 4000 },
    'hadith:nawawi40:nawawi-1': {
      status: 'memorized' as const,
      reviewCount: 1,
      lastReviewedAt: 4000,
    },
  };

  const personal = computePersonalStats({
    readingLog,
    hifzProgress,
    surahsIndex: SAMPLE_SURAHS,
    mushafPages: SAMPLE_PAGES,
    juzIndex: SAMPLE_JUZ,
    bookmarks: [
      {
        id: 'quran:1:1',
        type: 'quran',
        title: 'test',
        subtitle: 'sub',
        surah: 1,
        ayah: 1,
        note: '',
        createdAt: 4000,
      },
    ],
    todayDateKey: '2026-11-24',
  });

  assert.equal(personal.ayahsReadCount, 7);
  assert.equal(personal.surahsCompletedRead, 1);
  assert.equal(personal.mushafPagesCompleted, 1);
  assert.equal(personal.khatmCount, 1);
  assert.equal(personal.memorizedAyahs, 4);
  assert.equal(personal.learningAyahs, 1);
  assert.equal(personal.surahsFullyMemorized, 1);
  assert.equal(personal.hadith.nawawiRead, 1);
  assert.equal(personal.hadith.encRead, 1);
  assert.equal(personal.hadith.nawawiMemorized, 1);
  assert.equal(personal.todayCount, 7);
  assert.equal(personal.currentStreak, 4);
  assert.equal(personal.longestStreak, 4);
  assert.equal(personal.perJuz[0].readPercent, 100);
  assert.equal(personal.perJuz[1].memorizedPercent, 100);
});

test('mergeRemoteRecords enforces LWW, tombstones, and per-device daily isolation', () => {
  const local: LocalSyncState = {
    hifzProgress: {
      '1:1': {
        status: 'learning',
        reviewCount: 1,
        lastReviewedAt: 1000,
        updatedAt: 1000,
      },
      '1:2': {
        status: 'memorized',
        reviewCount: 3,
        lastReviewedAt: 5000,
        updatedAt: 5000,
      },
    },
    bookmarks: [
      {
        id: 'quran:2:255',
        type: 'quran',
        title: 'Ayat Kursi',
        subtitle: '',
        surah: 2,
        ayah: 255,
        note: 'local note',
        createdAt: 1000,
        updatedAt: 1000,
      },
    ],
    readingLog: {
      ...createEmptyReadingLog(),
      dailyByDevice: { '2026-11-24': { ipad: 10 } },
    },
    lastRead: { surah: 1, ayah: 1, timestamp: 1000 },
    mushafPage: { page: 5, updatedAt: 2000 },
    tombstones: { 'hifz:1:3': 6000 },
  };

  const remote = [
    // Newer update for 1:1 should win
    makeHifzRecord(
      '1:1',
      { status: 'memorized', reviewCount: 2, lastReviewedAt: 3000, updatedAt: 3000 },
      'iphone',
      3000
    ),
    // Older update for 1:2 should NOT overwrite local 5000
    makeHifzRecord(
      '1:2',
      { status: 'review', reviewCount: 1, lastReviewedAt: 2000, updatedAt: 2000 },
      'iphone',
      2000
    ),
    // Older update for deleted 1:3 (tombstone 6000) must NOT resurrect it
    makeHifzRecord(
      '1:3',
      { status: 'learning', reviewCount: 1, lastReviewedAt: 4000, updatedAt: 4000 },
      'iphone',
      4000
    ),
    // Tombstone deletion for bookmark quran:2:255 at 2500 > 1000 should delete it
    makeBookmarkRecord('quran:2:255', null, 'iphone', 2500),
    // Remote device daily entry should coexist without overwriting ipad's 10
    {
      key: 'daily:2026-11-24:iphone',
      type: 'daily' as const,
      value: { count: 4 },
      updatedAt: 3500,
      deviceId: 'iphone',
      deleted: false,
    },
    // Newer mushaf page should win
    {
      key: 'singleton:mushafPage',
      type: 'singleton' as const,
      value: { page: 42, updatedAt: 7000 },
      updatedAt: 7000,
      deviceId: 'iphone',
      deleted: false,
    },
  ];

  const { next, changed } = mergeRemoteRecords(local, remote);
  assert.equal(changed, true);
  assert.equal(next.hifzProgress['1:1']?.status, 'memorized');
  assert.equal(next.hifzProgress['1:2']?.status, 'memorized');
  assert.equal(next.hifzProgress['1:3'], undefined);
  assert.equal(next.bookmarks.length, 0);
  assert.equal(next.tombstones['bookmark:quran:2:255'], 2500);
  assert.equal(next.readingLog.dailyByDevice['2026-11-24']?.ipad, 10);
  assert.equal(next.readingLog.dailyByDevice['2026-11-24']?.iphone, 4);
  assert.equal(next.mushafPage.page, 42);

  // Outbox builder emits valid initial records
  const outboxRecords = buildInitialOutboxFromLocalState(next, 'ipad');
  assert.ok(outboxRecords.some((r) => r.key === 'hifz:1:1'));
  assert.ok(outboxRecords.some((r) => r.key === 'singleton:mushafPage'));
});

test('storage backup import accepts v1 and exports v2 without sync credentials', () => {
  const prevStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMockLocalStorage(),
    configurable: true,
    writable: true,
  });

  try {
    saveSyncConfig({
      enabled: true,
      autoSync: true,
      webAppUrl: 'https://script.google.com/macros/s/SECRET_URL/exec',
      token: 'SUPER_SECRET_TOKEN',
      deviceId: 'dev-1',
      deviceName: 'iPad',
      lastSyncedAt: 0,
      lastPulledAt: 0,
    });

    const v1Json = JSON.stringify({
      version: 1,
      exportedAt: 1000,
      settings: { theme: 'night', arabicFontSize: 34 },
      lastRead: { surah: 18, ayah: 10, timestamp: 1200 },
      bookmarks: [
        {
          id: 'quran:18:10',
          type: 'quran',
          title: 'Al-Kahf 18:10',
          subtitle: 'sub',
          surah: 18,
          ayah: 10,
          note: 'memorize',
          createdAt: 1200,
        },
      ],
      hifzProgress: {
        '18:10': { status: 'memorized', reviewCount: 2, lastReviewedAt: 1300 },
      },
    });

    const restored = importUserData(v1Json);
    assert.equal(restored.version, 2);
    assert.equal(restored.lastRead.surah, 18);
    assert.equal(restored.hifzProgress['18:10']?.status, 'memorized');

    const exported = exportUserData();
    const parsedExport = JSON.parse(exported);
    assert.equal(parsedExport.version, 2);
    assert.equal(exported.includes('SUPER_SECRET_TOKEN'), false);
    assert.equal(exported.includes('SECRET_URL'), false);
    assert.match(getLocalDateKey(Date.now()), /^\d{4}-\d{2}-\d{2}$/);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      value: prevStorage,
      configurable: true,
      writable: true,
    });
  }
});

test('QCF V2 dataset and 604 offline woff2 font files are complete and valid', () => {
  assert.equal(DEFAULT_SETTINGS.mushafRenderMode, 'qcf-v2');
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const qcfJsonPath = path.join(rootDir, 'public', 'data', 'mushaf-qcf-v2.json');
  const qcfPages = JSON.parse(fs.readFileSync(qcfJsonPath, 'utf-8')) as Array<{
    p: number;
    lines: Array<{ t: string }>;
  }>;
  assert.equal(qcfPages.length, 604);
  assert.equal(qcfPages[0].lines.length, 8);
  assert.equal(qcfPages[1].lines.length, 8);
  for (let i = 2; i < 604; i++) {
    assert.equal(qcfPages[i].lines.length, 15, `Page ${i + 1} should have 15 lines`);
  }
  // Spot-check woff2 headers for pages 1, 2, 300, 604 and UthmanicHafs1Ver18
  for (const rel of [
    'public/fonts/UthmanicHafs1Ver18.woff2',
    'public/fonts/qcf-v2/p1.woff2',
    'public/fonts/qcf-v2/p2.woff2',
    'public/fonts/qcf-v2/p300.woff2',
    'public/fonts/qcf-v2/p604.woff2',
  ]) {
    const buf = fs.readFileSync(path.join(rootDir, rel));
    assert.equal(buf.subarray(0, 4).toString('ascii'), 'wOF2', `${rel} must be valid wOFF2`);
  }
});
