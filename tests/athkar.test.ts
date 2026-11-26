import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  computeAthkarDashboardStats,
  createEmptyAthkarStats,
  recordAthkarTap,
  updateAthkarMemoryStatus,
} from '../src/lib/athkarStats.ts';
import type { AthkarDataset } from '../src/types/models.ts';

test('athkar.json dataset is valid, complete, and contains Arabic tashkeel', () => {
  const filePath = path.resolve(process.cwd(), 'public/data/athkar.json');
  assert.equal(fs.existsSync(filePath), true, 'public/data/athkar.json must exist');

  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);

  assert.equal(typeof data.version, 'string');
  assert.equal(typeof data.source, 'string');
  assert.ok(Array.isArray(data.categories) && data.categories.length >= 5);

  const expectedIds = ['sabah', 'masaa', 'after_salah', 'sleep', 'wakeup'];
  const actualIds = data.categories.map((c) => c.id);
  for (const id of expectedIds) {
    assert.ok(actualIds.includes(id), `Missing category: ${id}`);
  }

  const tashkeelRegex = /[\u064B-\u065F\u0670]/;
  for (const cat of data.categories) {
    assert.ok(cat.title_th && cat.title_ar, `Category ${cat.id} missing titles`);
    assert.ok(Array.isArray(cat.items) && cat.items.length > 0, `Category ${cat.id} must have items`);

    for (const item of cat.items) {
      assert.equal(typeof item.id, 'number');
      assert.ok(item.arabic && item.arabic.trim().length > 0, `${cat.id}#${item.id} missing arabic`);
      assert.ok(tashkeelRegex.test(item.arabic), `${cat.id}#${item.id} arabic missing tashkeel`);
      assert.ok(item.transliteration && item.transliteration.trim().length > 0, `${cat.id}#${item.id} missing transliteration`);
      assert.ok(item.translation_th && item.translation_th.trim().length > 0, `${cat.id}#${item.id} missing translation_th`);
      assert.ok(Number.isInteger(item.repeat) && item.repeat >= 1, `${cat.id}#${item.id} invalid repeat`);
    }
  }
});

test('athkarStats auto-tracks taps, category completion, streaks, and memorization mastery', () => {
  const dataset: AthkarDataset = {
    version: '1.0',
    source: 'test',
    categories: [
      {
        id: 'sabah',
        title_th: 'อัซการยามเช้า',
        title_ar: 'أذكار الصباح',
        description: '',
        items: [
          { id: 1, arabic: 'أَصْبَحْنَا', transliteration: 'a', translation_th: 'a', repeat: 2 },
          { id: 2, arabic: 'سُبْحَانَ', transliteration: 'b', translation_th: 'b', repeat: 1 },
        ],
      },
      {
        id: 'masaa',
        title_th: 'อัซการยามเย็น',
        title_ar: 'أذكار المساء',
        description: '',
        items: [
          { id: 1, arabic: 'أَمْسَيْنَا', transliteration: 'c', translation_th: 'c', repeat: 1 },
        ],
      },
    ],
  };

  let state = createEmptyAthkarStats();
  // Day 1: 2026-11-25 (complete sabah)
  state = recordAthkarTap(state, dataset.categories[0], 1, 1, false, '2026-11-25');
  state = recordAthkarTap(state, dataset.categories[0], 1, 0, false, '2026-11-25');
  state = recordAthkarTap(state, dataset.categories[0], 2, 0, true, '2026-11-25');

  assert.equal(state.readCounts['sabah:1'], 1);
  assert.equal(state.readCounts['sabah:2'], 1);
  assert.equal(state.daily['2026-11-25']?.sabah_completed, true);
  assert.equal(state.daily['2026-11-25']?.tapCount, 3);

  // Day 2: 2026-11-26 (complete masaa)
  state = recordAthkarTap(state, dataset.categories[1], 1, 0, true, '2026-11-26');
  assert.equal(state.daily['2026-11-26']?.masaa_completed, true);

  // Self-rating memory status
  state = updateAthkarMemoryStatus(state, 'sabah', 1, 'memorized');
  state = updateAthkarMemoryStatus(state, 'sabah', 2, 'review');

  const dash = computeAthkarDashboardStats(state, dataset, '2026-11-26');
  assert.equal(dash.currentStreak, 2);
  assert.equal(dash.longestStreak, 2);
  assert.equal(dash.todayTapCount, 1);
  assert.equal(dash.memorizedCount, 1);
  assert.equal(dash.reviewingCount, 1);
  assert.equal(dash.learningCount, 1);
  assert.equal(dash.totalItems, 3);
  assert.equal(dash.weeklyHabit.length, 7);

  const sabahMastery = dash.categoryMastery.find((c) => c.id === 'sabah');
  assert.equal(sabahMastery?.masteryPercent, 50);
});
