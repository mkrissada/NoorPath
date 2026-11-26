import type {
  BookmarkItem,
  HifzProgressEntry,
  JuzInfo,
  MushafPageInfo,
  ReadingLog,
  SurahMeta,
} from '../types/models.ts';
import { getLocalDateKey } from './storage.ts';

export interface ContentStats {
  totalSurahs: number;
  meccanSurahs: number;
  medinanSurahs: number;
  totalAyahs: number;
  totalMushafPages: number;
  totalJuz: number;
  thaiTranslationsCount: number;
  thaiTafsirCount: number;
  nawawiCount: number;
  hadeethEncCount: number;
  totalHadith: number;
  recitersCount: number;
  sheikhCoveredSurahs: number;
  sheikhTotalTracks: number;
}

export interface SurahStatRow {
  number: number;
  nameTh: string;
  nameEn: string;
  nameAr: string;
  ayahCount: number;
  startPage: number;
  readCount: number;
  memorizedCount: number;
  learningCount: number;
  reviewCount: number;
  isFullyRead: boolean;
  isFullyMemorized: boolean;
}

export interface JuzStatRow {
  juz: number;
  startPage: number;
  endPage: number;
  ayahCount: number;
  readCount: number;
  memorizedCount: number;
  readPercent: number;
  memorizedPercent: number;
}

export interface DailyStatPoint {
  dateKey: string;
  label: string;
  count: number;
}

export interface PersonalStats {
  ayahsReadCount: number;
  ayahsReadPercent: number;
  surahsCompletedRead: number;
  mushafPagesCompleted: number;
  khatmCount: number;
  lastKhatmAt: number | null;
  memorizedAyahs: number;
  learningAyahs: number;
  reviewAyahs: number;
  memorizedPercent: number;
  surahsFullyMemorized: number;
  startedSurahs: number;
  hadith: {
    nawawiRead: number;
    encRead: number;
    totalRead: number;
    nawawiMemorized: number;
    encMemorized: number;
    totalMemorized: number;
    learning: number;
    review: number;
  };
  bookmarks: {
    total: number;
    quran: number;
    hadith: number;
  };
  todayCount: number;
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  dailySeries: DailyStatPoint[];
  perJuz: JuzStatRow[];
  perSurah: SurahStatRow[];
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [yStr, mStr, dStr] = dateKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const ny = dt.getUTCFullYear();
  const nm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(dt.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export function computeContentStats(input: {
  surahsIndex: SurahMeta[];
  mushafPagesCount?: number;
  juzCount?: number;
  nawawiCount: number;
  hadeethEncCount: number;
  recitersCount: number;
  sheikhCoveredSurahs: number;
  sheikhTotalTracks: number;
}): ContentStats {
  const totalSurahs = input.surahsIndex.length || 114;
  let meccanSurahs = 0;
  let medinanSurahs = 0;
  let totalAyahs = 0;
  for (const s of input.surahsIndex) {
    if (s.revelationType === 'Meccan') meccanSurahs++;
    else medinanSurahs++;
    totalAyahs += s.ayahCount;
  }
  return {
    totalSurahs,
    meccanSurahs,
    medinanSurahs,
    totalAyahs: totalAyahs || 6236,
    totalMushafPages: input.mushafPagesCount || 604,
    totalJuz: input.juzCount || 30,
    thaiTranslationsCount: 2,
    thaiTafsirCount: 1,
    nawawiCount: input.nawawiCount,
    hadeethEncCount: input.hadeethEncCount,
    totalHadith: input.nawawiCount + input.hadeethEncCount,
    recitersCount: input.recitersCount,
    sheikhCoveredSurahs: input.sheikhCoveredSurahs,
    sheikhTotalTracks: input.sheikhTotalTracks,
  };
}

export function computePersonalStats(input: {
  readingLog: ReadingLog;
  hifzProgress: Record<string, HifzProgressEntry>;
  surahsIndex: SurahMeta[];
  mushafPages: MushafPageInfo[];
  juzIndex: JuzInfo[];
  bookmarks: BookmarkItem[];
  todayDateKey?: string;
}): PersonalStats {
  const todayDateKey = input.todayDateKey ?? getLocalDateKey();
  const resetAt = input.readingLog.khatm?.resetAt || 0;
  const readAyahs = input.readingLog.readAyahs ?? {};
  const hifzProgress = input.hifzProgress ?? {};

  const isRead = (s: number, a: number): boolean => (readAyahs[`${s}:${a}`] ?? 0) > resetAt;
  const getHifz = (s: number, a: number): HifzProgressEntry | undefined => {
    const entry = hifzProgress[`${s}:${a}`];
    if (!entry || entry.deleted || entry.status === 'none') return undefined;
    return entry;
  };

  let totalAyahs = 0;
  let ayahsReadCount = 0;
  let surahsCompletedRead = 0;
  let memorizedAyahs = 0;
  let learningAyahs = 0;
  let reviewAyahs = 0;
  let surahsFullyMemorized = 0;
  let startedSurahs = 0;

  const perSurah: SurahStatRow[] = [];
  for (const s of input.surahsIndex) {
    totalAyahs += s.ayahCount;
    let sRead = 0;
    let sMem = 0;
    let sLearn = 0;
    let sRev = 0;

    for (let a = 1; a <= s.ayahCount; a++) {
      if (isRead(s.number, a)) sRead++;
      const h = getHifz(s.number, a);
      if (h) {
        if (h.status === 'memorized') sMem++;
        else if (h.status === 'learning') sLearn++;
        else if (h.status === 'review') sRev++;
      }
    }

    ayahsReadCount += sRead;
    memorizedAyahs += sMem;
    learningAyahs += sLearn;
    reviewAyahs += sRev;

    const isFullyRead = s.ayahCount > 0 && sRead >= s.ayahCount;
    const isFullyMemorized = s.ayahCount > 0 && sMem >= s.ayahCount;
    if (isFullyRead) surahsCompletedRead++;
    if (isFullyMemorized) surahsFullyMemorized++;
    if (sMem + sLearn + sRev > 0) startedSurahs++;

    perSurah.push({
      number: s.number,
      nameTh: s.nameTh,
      nameEn: s.nameEn,
      nameAr: s.nameAr,
      ayahCount: s.ayahCount,
      startPage: s.startPage ?? 1,
      readCount: sRead,
      memorizedCount: sMem,
      learningCount: sLearn,
      reviewCount: sRev,
      isFullyRead,
      isFullyMemorized,
    });
  }

  let mushafPagesCompleted = 0;
  for (const p of input.mushafPages) {
    if (p.segments.length === 0) continue;
    let pageAllRead = true;
    for (const seg of p.segments) {
      for (let a = seg.from; a <= seg.to; a++) {
        if (!isRead(seg.surah, a)) {
          pageAllRead = false;
          break;
        }
      }
      if (!pageAllRead) break;
    }
    if (pageAllRead) mushafPagesCompleted++;
  }

  const perJuz: JuzStatRow[] = input.juzIndex.map((j) => {
    let jRead = 0;
    let jMem = 0;
    for (const seg of j.segments) {
      for (let a = seg.from; a <= seg.to; a++) {
        if (isRead(seg.surah, a)) jRead++;
        if (getHifz(seg.surah, a)?.status === 'memorized') jMem++;
      }
    }
    const denom = j.ayahCount || 1;
    return {
      juz: j.juz,
      startPage: j.startPage,
      endPage: j.endPage,
      ayahCount: j.ayahCount,
      readCount: jRead,
      memorizedCount: jMem,
      readPercent: Math.round((jRead / denom) * 100),
      memorizedPercent: Math.round((jMem / denom) * 100),
    };
  });

  // Hadith stats
  let nawawiRead = 0;
  let encRead = 0;
  for (const [key, ts] of Object.entries(input.readingLog.readHadith ?? {})) {
    if (!ts || ts <= 0) continue;
    if (key.startsWith('nawawi40:')) nawawiRead++;
    else if (key.startsWith('hadeethenc:')) encRead++;
  }

  let nawawiMemorized = 0;
  let encMemorized = 0;
  let hadithLearning = 0;
  let hadithReview = 0;
  for (const [key, entry] of Object.entries(hifzProgress)) {
    if (!key.startsWith('hadith:') || entry.deleted || entry.status === 'none') continue;
    if (entry.status === 'memorized') {
      if (key.startsWith('hadith:nawawi40:')) nawawiMemorized++;
      else if (key.startsWith('hadith:hadeethenc:')) encMemorized++;
    } else if (entry.status === 'learning') {
      hadithLearning++;
    } else if (entry.status === 'review') {
      hadithReview++;
    }
  }

  // Bookmarks
  let quranBookmarks = 0;
  let hadithBookmarks = 0;
  for (const b of input.bookmarks) {
    if (b.type === 'quran') quranBookmarks++;
    else if (b.type === 'hadith') hadithBookmarks++;
  }

  // Daily activity & streaks
  const dailyTotals: Record<string, number> = {};
  for (const [dateKey, devMap] of Object.entries(input.readingLog.dailyByDevice ?? {})) {
    if (!devMap) continue;
    let sum = 0;
    for (const val of Object.values(devMap)) {
      if (typeof val === 'number' && val > 0) sum += val;
    }
    if (sum > 0) dailyTotals[dateKey] = sum;
  }

  const todayCount = dailyTotals[todayDateKey] ?? 0;
  const activeDates = Object.keys(dailyTotals).sort();
  const totalActiveDays = activeDates.length;

  let currentStreak = 0;
  let cursor =
    todayCount > 0
      ? todayDateKey
      : (dailyTotals[shiftDateKey(todayDateKey, -1)] ?? 0) > 0
        ? shiftDateKey(todayDateKey, -1)
        : '';
  while (cursor && (dailyTotals[cursor] ?? 0) > 0) {
    currentStreak++;
    cursor = shiftDateKey(cursor, -1);
  }

  let longestStreak = 0;
  let run = 0;
  let prevDate = '';
  for (const d of activeDates) {
    if (prevDate && shiftDateKey(prevDate, 1) === d) {
      run++;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    prevDate = d;
  }

  const dailySeries: DailyStatPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const dk = shiftDateKey(todayDateKey, -i);
    const [, mm, dd] = dk.split('-');
    dailySeries.push({
      dateKey: dk,
      label: `${Number(dd)}/${Number(mm)}`,
      count: dailyTotals[dk] ?? 0,
    });
  }

  const khatmCompleted = input.readingLog.khatm?.completedAt ?? [];
  const denominator = totalAyahs || 6236;

  return {
    ayahsReadCount,
    ayahsReadPercent: Math.round((ayahsReadCount / denominator) * 1000) / 10,
    surahsCompletedRead,
    mushafPagesCompleted,
    khatmCount: input.readingLog.khatm?.count ?? 0,
    lastKhatmAt: khatmCompleted.length > 0 ? Math.max(...khatmCompleted) : null,
    memorizedAyahs,
    learningAyahs,
    reviewAyahs,
    memorizedPercent: Math.round((memorizedAyahs / denominator) * 1000) / 10,
    surahsFullyMemorized,
    startedSurahs,
    hadith: {
      nawawiRead,
      encRead,
      totalRead: nawawiRead + encRead,
      nawawiMemorized,
      encMemorized,
      totalMemorized: nawawiMemorized + encMemorized,
      learning: hadithLearning,
      review: hadithReview,
    },
    bookmarks: {
      total: input.bookmarks.length,
      quran: quranBookmarks,
      hadith: hadithBookmarks,
    },
    todayCount,
    currentStreak,
    longestStreak,
    totalActiveDays,
    dailySeries,
    perJuz,
    perSurah,
  };
}
