import type {
  AthkarCategory,
  AthkarDataset,
  AthkarDailyLog,
  AthkarMemoryStatus,
  AthkarStatsState,
} from '../types/models.ts';
import { shiftDateKey } from './stats.ts';
import { getLocalDateKey } from './storage.ts';

export const ATHKAR_STATS_STORAGE_KEY = 'noorpath:athkar-stats:v1';

export function createEmptyAthkarStats(): AthkarStatsState {
  return {
    readCounts: {},
    memoryStatus: {},
    daily: {},
  };
}

export function athkarItemKey(categoryId: string, itemId: number): string {
  return `${categoryId}:${itemId}`;
}

export function loadAthkarStats(): AthkarStatsState {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis) || !globalThis.localStorage) {
      return createEmptyAthkarStats();
    }
    const raw = globalThis.localStorage.getItem(ATHKAR_STATS_STORAGE_KEY);
    if (!raw) return createEmptyAthkarStats();
    const parsed = JSON.parse(raw) as Partial<AthkarStatsState>;
    return {
      readCounts: parsed.readCounts && typeof parsed.readCounts === 'object' ? parsed.readCounts : {},
      memoryStatus: parsed.memoryStatus && typeof parsed.memoryStatus === 'object' ? parsed.memoryStatus : {},
      daily: parsed.daily && typeof parsed.daily === 'object' ? parsed.daily : {},
    };
  } catch {
    return createEmptyAthkarStats();
  }
}

export function saveAthkarStats(state: AthkarStatsState): void {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis) || !globalThis.localStorage) {
      return;
    }
    globalThis.localStorage.setItem(ATHKAR_STATS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function recordAthkarTap(
  state: AthkarStatsState,
  category: AthkarCategory,
  itemId: number,
  nextRemaining: number,
  allItemsCompleted: boolean,
  dateKey = getLocalDateKey()
): AthkarStatsState {
  const key = athkarItemKey(category.id, itemId);
  const prevDaily: AthkarDailyLog = state.daily[dateKey] ?? { tapCount: 0 };
  const completedCats = new Set(prevDaily.completedCategories ?? []);

  if (allItemsCompleted) {
    completedCats.add(category.id);
  }

  const nextDaily: AthkarDailyLog = {
    ...prevDaily,
    tapCount: (prevDaily.tapCount || 0) + 1,
    completedCategories: Array.from(completedCats),
    ...(category.id === 'sabah' && allItemsCompleted ? { sabah_completed: true } : {}),
    ...(category.id === 'masaa' && allItemsCompleted ? { masaa_completed: true } : {}),
  };

  const nextReadCounts = { ...state.readCounts };
  if (nextRemaining === 0) {
    nextReadCounts[key] = (nextReadCounts[key] || 0) + 1;
  }

  return {
    ...state,
    readCounts: nextReadCounts,
    daily: {
      ...state.daily,
      [dateKey]: nextDaily,
    },
  };
}

export function updateAthkarMemoryStatus(
  state: AthkarStatsState,
  categoryId: string,
  itemId: number,
  status: AthkarMemoryStatus
): AthkarStatsState {
  const key = athkarItemKey(categoryId, itemId);
  return {
    ...state,
    memoryStatus: {
      ...state.memoryStatus,
      [key]: status,
    },
  };
}

function isDayActive(log: AthkarDailyLog | undefined): boolean {
  if (!log) return false;
  return (
    (log.tapCount || 0) > 0 ||
    Boolean(log.sabah_completed) ||
    Boolean(log.masaa_completed) ||
    (log.completedCategories?.length ?? 0) > 0
  );
}

export interface WeeklyHabitDay {
  dateKey: string;
  dayShort: string;
  dayFull: string;
  dateNum: string;
  isToday: boolean;
  isFuture: boolean;
  sabahCompleted: boolean;
  masaaCompleted: boolean;
  tapCount: number;
}

export interface AthkarCategoryMastery {
  id: string;
  title_th: string;
  title_ar: string;
  totalItems: number;
  memorizedCount: number;
  reviewingCount: number;
  learningCount: number;
  masteryPercent: number;
  completedToday: boolean;
}

export interface AthkarDashboardStats {
  currentStreak: number;
  longestStreak: number;
  todayTapCount: number;
  memorizedCount: number;
  reviewingCount: number;
  learningCount: number;
  totalItems: number;
  memorizedPercent: number;
  weeklyHabit: WeeklyHabitDay[];
  categoryMastery: AthkarCategoryMastery[];
}

const THAI_WEEKDAYS_MON_FIRST = [
  { short: 'จ.', full: 'จันทร์' },
  { short: 'อ.', full: 'อังคาร' },
  { short: 'พ.', full: 'พุธ' },
  { short: 'พฤ.', full: 'พฤหัสบดี' },
  { short: 'ศ.', full: 'ศุกร์' },
  { short: 'ส.', full: 'เสาร์' },
  { short: 'อา.', full: 'อาทิตย์' },
];

export function computeAthkarDashboardStats(
  state: AthkarStatsState,
  dataset: AthkarDataset | null,
  todayKey = getLocalDateKey()
): AthkarDashboardStats {
  // 1. Streak calculation
  const activeDates = Object.keys(state.daily)
    .filter((k) => isDayActive(state.daily[k]))
    .sort();

  let currentStreak = 0;
  let cursor = isDayActive(state.daily[todayKey])
    ? todayKey
    : shiftDateKey(todayKey, -1);

  while (isDayActive(state.daily[cursor])) {
    currentStreak++;
    cursor = shiftDateKey(cursor, -1);
  }

  let longestStreak = 0;
  let run = 0;
  let prevDate = '';
  for (const dk of activeDates) {
    if (prevDate && shiftDateKey(prevDate, 1) === dk) {
      run++;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    prevDate = dk;
  }

  const todayLog = state.daily[todayKey];
  const todayTapCount = todayLog?.tapCount ?? 0;

  // 2. Weekly Habit Tracker (Monday - Sunday of current week)
  const [yStr, mStr, dStr] = todayKey.split('-');
  const todayUtc = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr)));
  const jsDay = todayUtc.getUTCDay(); // 0=Sun, 1=Mon, ...
  const offsetFromMonday = jsDay === 0 ? 6 : jsDay - 1;
  const mondayKey = shiftDateKey(todayKey, -offsetFromMonday);

  const weeklyHabit: WeeklyHabitDay[] = THAI_WEEKDAYS_MON_FIRST.map((wd, idx) => {
    const dk = shiftDateKey(mondayKey, idx);
    const log = state.daily[dk];
    const completedCats = new Set(log?.completedCategories ?? []);
    return {
      dateKey: dk,
      dayShort: wd.short,
      dayFull: wd.full,
      dateNum: dk.slice(8, 10),
      isToday: dk === todayKey,
      isFuture: dk > todayKey,
      sabahCompleted: Boolean(log?.sabah_completed) || completedCats.has('sabah'),
      masaaCompleted: Boolean(log?.masaa_completed) || completedCats.has('masaa'),
      tapCount: log?.tapCount ?? 0,
    };
  });

  // 3. Memorization & Category Mastery
  const categories = dataset?.categories ?? [];
  let totalItems = 0;
  let memorizedCount = 0;
  let reviewingCount = 0;
  let learningCount = 0;

  const todayCompletedCats = new Set(todayLog?.completedCategories ?? []);
  if (todayLog?.sabah_completed) todayCompletedCats.add('sabah');
  if (todayLog?.masaa_completed) todayCompletedCats.add('masaa');

  const categoryMastery: AthkarCategoryMastery[] = categories.map((cat) => {
    let catMem = 0;
    let catRev = 0;
    let catLearn = 0;
    for (const item of cat.items) {
      const status = state.memoryStatus[athkarItemKey(cat.id, item.id)] ?? 'learning';
      if (status === 'memorized') catMem++;
      else if (status === 'review') catRev++;
      else catLearn++;
    }
    const catTotal = cat.items.length;
    totalItems += catTotal;
    memorizedCount += catMem;
    reviewingCount += catRev;
    learningCount += catLearn;

    return {
      id: cat.id,
      title_th: cat.title_th,
      title_ar: cat.title_ar,
      totalItems: catTotal,
      memorizedCount: catMem,
      reviewingCount: catRev,
      learningCount: catLearn,
      masteryPercent: catTotal > 0 ? Math.round((catMem / catTotal) * 100) : 0,
      completedToday: todayCompletedCats.has(cat.id),
    };
  });

  const memorizedPercent =
    totalItems > 0 ? Math.round((memorizedCount / totalItems) * 100) : 0;

  return {
    currentStreak,
    longestStreak,
    todayTapCount,
    memorizedCount,
    reviewingCount,
    learningCount,
    totalItems,
    memorizedPercent,
    weeklyHabit,
    categoryMastery,
  };
}
