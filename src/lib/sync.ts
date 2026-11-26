import type {
  BookmarkItem,
  HifzProgressEntry,
  KhatmHistory,
  LastReadState,
  MushafPageState,
  ReadingLog,
  SyncConfig,
  SyncRecord,
} from '../types/models.ts';
import {
  loadSyncOutbox,
  loadSyncTombstones,
  saveSyncOutbox,
  saveSyncTombstones,
} from './storage.ts';

export interface LocalSyncState {
  hifzProgress: Record<string, HifzProgressEntry>;
  bookmarks: BookmarkItem[];
  readingLog: ReadingLog;
  lastRead: LastReadState;
  mushafPage: MushafPageState;
  tombstones: Record<string, number>;
}

export interface SyncRunResult {
  ok: boolean;
  offline?: boolean;
  error?: string;
  serverTime?: number;
  pushedCount: number;
  pulledCount: number;
  mergedState: LocalSyncState;
  stateChanged: boolean;
  nextLastPulledAt: number;
  pendingCount: number;
}

const BATCH_SIZE = 400;

export function makeHifzRecord(
  hifzKey: string,
  entry: HifzProgressEntry | null,
  deviceId: string,
  now = Date.now()
): SyncRecord {
  const updatedAt = entry ? entry.updatedAt ?? entry.lastReviewedAt ?? now : now;
  const deleted = !entry || entry.deleted || entry.status === 'none';
  return {
    key: `hifz:${hifzKey}`,
    type: 'hifz',
    value: deleted ? null : { ...entry, updatedAt },
    updatedAt,
    deviceId,
    deleted: Boolean(deleted),
  };
}

export function makeBookmarkRecord(
  bookmarkId: string,
  bookmark: BookmarkItem | null,
  deviceId: string,
  now = Date.now()
): SyncRecord {
  const updatedAt = bookmark ? bookmark.updatedAt ?? bookmark.createdAt ?? now : now;
  return {
    key: `bookmark:${bookmarkId}`,
    type: 'bookmark',
    value: bookmark ? { ...bookmark, updatedAt } : null,
    updatedAt,
    deviceId,
    deleted: !bookmark,
  };
}

export function makeReadAyahRecord(
  ayahKey: string,
  readAt: number,
  deviceId: string
): SyncRecord {
  return {
    key: `read:${ayahKey}`,
    type: 'read',
    value: { readAt },
    updatedAt: readAt,
    deviceId,
    deleted: false,
  };
}

export function makeReadHadithRecord(
  hadithKey: string,
  readAt: number,
  deviceId: string
): SyncRecord {
  return {
    key: `readHadith:${hadithKey}`,
    type: 'readHadith',
    value: { readAt },
    updatedAt: readAt,
    deviceId,
    deleted: false,
  };
}

export function makeDailyRecord(
  dateKey: string,
  deviceId: string,
  count: number,
  now = Date.now()
): SyncRecord {
  return {
    key: `daily:${dateKey}:${deviceId}`,
    type: 'daily',
    value: { count },
    updatedAt: now,
    deviceId,
    deleted: false,
  };
}

export function makeLastReadRecord(state: LastReadState, deviceId: string): SyncRecord {
  return {
    key: 'singleton:lastRead',
    type: 'singleton',
    value: state,
    updatedAt: state.timestamp,
    deviceId,
    deleted: false,
  };
}

export function makeMushafPageRecord(state: MushafPageState, deviceId: string): SyncRecord {
  return {
    key: 'singleton:mushafPage',
    type: 'singleton',
    value: state,
    updatedAt: state.updatedAt,
    deviceId,
    deleted: false,
  };
}

export function makeKhatmRecord(khatm: KhatmHistory, deviceId: string): SyncRecord {
  return {
    key: 'singleton:khatm',
    type: 'singleton',
    value: khatm,
    updatedAt: khatm.updatedAt,
    deviceId,
    deleted: false,
  };
}

export function enqueueSyncRecords(records: SyncRecord[]): number {
  if (records.length === 0) return Object.keys(loadSyncOutbox()).length;
  const outbox = loadSyncOutbox();
  const tombstones = loadSyncTombstones();
  let tombstonesDirty = false;

  for (const rec of records) {
    const existing = outbox[rec.key];
    if (!existing || rec.updatedAt >= existing.updatedAt) {
      outbox[rec.key] = rec;
    }
    if (rec.deleted) {
      if ((tombstones[rec.key] ?? 0) < rec.updatedAt) {
        tombstones[rec.key] = rec.updatedAt;
        tombstonesDirty = true;
      }
    } else if (tombstones[rec.key] && rec.updatedAt > tombstones[rec.key]) {
      delete tombstones[rec.key];
      tombstonesDirty = true;
    }
  }

  saveSyncOutbox(outbox);
  if (tombstonesDirty) {
    saveSyncTombstones(tombstones);
  }
  return Object.keys(outbox).length;
}

export function buildInitialOutboxFromLocalState(
  local: LocalSyncState,
  deviceId: string
): SyncRecord[] {
  const records: SyncRecord[] = [];
  const resetAt = local.readingLog.khatm?.resetAt || 0;

  for (const [k, entry] of Object.entries(local.hifzProgress)) {
    if (!entry || entry.deleted || entry.status === 'none') continue;
    records.push(makeHifzRecord(k, entry, deviceId));
  }

  for (const bm of local.bookmarks) {
    records.push(makeBookmarkRecord(bm.id, bm, deviceId));
  }

  for (const [ayahKey, readAt] of Object.entries(local.readingLog.readAyahs)) {
    if (readAt > resetAt) {
      records.push(makeReadAyahRecord(ayahKey, readAt, deviceId));
    }
  }

  for (const [hadithKey, readAt] of Object.entries(local.readingLog.readHadith)) {
    if (readAt > 0) {
      records.push(makeReadHadithRecord(hadithKey, readAt, deviceId));
    }
  }

  for (const [dateKey, devMap] of Object.entries(local.readingLog.dailyByDevice)) {
    for (const [devId, count] of Object.entries(devMap)) {
      if (count > 0) {
        records.push({
          key: `daily:${dateKey}:${devId}`,
          type: 'daily',
          value: { count },
          updatedAt: Date.now(),
          deviceId: devId,
          deleted: false,
        });
      }
    }
  }

  if (local.lastRead.timestamp > 0) {
    records.push(makeLastReadRecord(local.lastRead, deviceId));
  }
  if (local.mushafPage.updatedAt > 0) {
    records.push(makeMushafPageRecord(local.mushafPage, deviceId));
  }
  if (
    local.readingLog.khatm.updatedAt > 0 ||
    local.readingLog.khatm.count > 0 ||
    local.readingLog.khatm.resetAt > 0
  ) {
    records.push(makeKhatmRecord(local.readingLog.khatm, deviceId));
  }

  return records;
}

export function mergeRemoteRecords(
  local: LocalSyncState,
  remoteRecords: SyncRecord[]
): { next: LocalSyncState; changed: boolean } {
  const nextHifz: Record<string, HifzProgressEntry> = { ...local.hifzProgress };
  const bookmarkMap = new Map<string, BookmarkItem>();
  for (const b of local.bookmarks) {
    bookmarkMap.set(b.id, b);
  }
  const nextReading: ReadingLog = {
    readAyahs: { ...local.readingLog.readAyahs },
    readHadith: { ...local.readingLog.readHadith },
    dailyByDevice: Object.fromEntries(
      Object.entries(local.readingLog.dailyByDevice).map(([d, m]) => [d, { ...m }])
    ),
    khatm: {
      count: local.readingLog.khatm.count,
      completedAt: [...local.readingLog.khatm.completedAt],
      resetAt: local.readingLog.khatm.resetAt,
      updatedAt: local.readingLog.khatm.updatedAt,
    },
  };
  let nextLastRead: LastReadState = { ...local.lastRead };
  let nextMushafPage: MushafPageState = { ...local.mushafPage };
  const nextTombstones: Record<string, number> = { ...local.tombstones };

  let changed = false;

  for (const rec of remoteRecords) {
    if (!rec || typeof rec.key !== 'string') continue;

    if (rec.key.startsWith('hifz:')) {
      const hifzKey = rec.key.slice('hifz:'.length);
      const existing = nextHifz[hifzKey];
      const localTs = Math.max(
        existing ? existing.updatedAt ?? existing.lastReviewedAt ?? 0 : 0,
        nextTombstones[rec.key] ?? 0
      );
      if (rec.updatedAt <= localTs) continue;

      if (rec.deleted || !rec.value) {
        if (existing) changed = true;
        delete nextHifz[hifzKey];
        nextTombstones[rec.key] = rec.updatedAt;
      } else {
        const val = rec.value as Partial<HifzProgressEntry>;
        if (
          val.status === 'learning' ||
          val.status === 'memorized' ||
          val.status === 'review'
        ) {
          delete nextTombstones[rec.key];
          nextHifz[hifzKey] = {
            status: val.status,
            reviewCount: typeof val.reviewCount === 'number' ? val.reviewCount : 1,
            lastReviewedAt:
              typeof val.lastReviewedAt === 'number' ? val.lastReviewedAt : rec.updatedAt,
            updatedAt: rec.updatedAt,
          };
          changed = true;
        }
      }
    } else if (rec.key.startsWith('bookmark:')) {
      const bmId = rec.key.slice('bookmark:'.length);
      const existing = bookmarkMap.get(bmId);
      const localTs = Math.max(
        existing ? existing.updatedAt ?? existing.createdAt ?? 0 : 0,
        nextTombstones[rec.key] ?? 0
      );
      if (rec.updatedAt <= localTs) continue;

      if (rec.deleted || !rec.value) {
        if (existing) changed = true;
        bookmarkMap.delete(bmId);
        nextTombstones[rec.key] = rec.updatedAt;
      } else {
        const val = rec.value as BookmarkItem;
        delete nextTombstones[rec.key];
        bookmarkMap.set(bmId, {
          ...val,
          id: bmId,
          updatedAt: rec.updatedAt,
        });
        changed = true;
      }
    } else if (rec.key.startsWith('read:')) {
      if (rec.deleted) continue;
      const ayahKey = rec.key.slice('read:'.length);
      const val = rec.value as { readAt?: number } | null;
      const remoteReadAt = typeof val?.readAt === 'number' ? val.readAt : rec.updatedAt;
      const localReadAt = nextReading.readAyahs[ayahKey] ?? 0;
      if (remoteReadAt > localReadAt) {
        nextReading.readAyahs[ayahKey] = remoteReadAt;
        changed = true;
      }
    } else if (rec.key.startsWith('readHadith:')) {
      if (rec.deleted) continue;
      const hadithKey = rec.key.slice('readHadith:'.length);
      const val = rec.value as { readAt?: number } | null;
      const remoteReadAt = typeof val?.readAt === 'number' ? val.readAt : rec.updatedAt;
      const localReadAt = nextReading.readHadith[hadithKey] ?? 0;
      if (remoteReadAt > localReadAt) {
        nextReading.readHadith[hadithKey] = remoteReadAt;
        changed = true;
      }
    } else if (rec.key.startsWith('daily:')) {
      if (rec.deleted) continue;
      const rest = rec.key.slice('daily:'.length);
      const sepIdx = rest.indexOf(':');
      if (sepIdx <= 0) continue;
      const dateKey = rest.slice(0, sepIdx);
      const devId = rest.slice(sepIdx + 1);
      if (!devId) continue;
      const val = rec.value as { count?: number } | null;
      const remoteCount = typeof val?.count === 'number' ? val.count : 0;
      const prevCount = nextReading.dailyByDevice[dateKey]?.[devId] ?? 0;
      if (remoteCount > prevCount) {
        if (!nextReading.dailyByDevice[dateKey]) {
          nextReading.dailyByDevice[dateKey] = {};
        }
        nextReading.dailyByDevice[dateKey][devId] = remoteCount;
        changed = true;
      }
    } else if (rec.key === 'singleton:lastRead') {
      if (rec.deleted || !rec.value) continue;
      const val = rec.value as Partial<LastReadState>;
      const remoteTs = typeof val.timestamp === 'number' ? val.timestamp : rec.updatedAt;
      if (remoteTs > (nextLastRead.timestamp ?? 0) && typeof val.surah === 'number') {
        nextLastRead = {
          surah: val.surah,
          ayah: typeof val.ayah === 'number' ? val.ayah : 1,
          timestamp: remoteTs,
        };
        changed = true;
      }
    } else if (rec.key === 'singleton:mushafPage') {
      if (rec.deleted || !rec.value) continue;
      const val = rec.value as Partial<MushafPageState>;
      const remoteTs = typeof val.updatedAt === 'number' ? val.updatedAt : rec.updatedAt;
      if (remoteTs > (nextMushafPage.updatedAt ?? 0) && typeof val.page === 'number') {
        nextMushafPage = {
          page: Math.max(1, Math.min(604, Math.floor(val.page))),
          updatedAt: remoteTs,
        };
        changed = true;
      }
    } else if (rec.key === 'singleton:khatm') {
      if (rec.deleted || !rec.value) continue;
      const val = rec.value as Partial<KhatmHistory>;
      const remoteTs = typeof val.updatedAt === 'number' ? val.updatedAt : rec.updatedAt;
      if (remoteTs > (nextReading.khatm.updatedAt ?? 0)) {
        nextReading.khatm = {
          count: typeof val.count === 'number' ? val.count : nextReading.khatm.count,
          completedAt: Array.isArray(val.completedAt)
            ? val.completedAt.filter((n): n is number => typeof n === 'number')
            : nextReading.khatm.completedAt,
          resetAt: typeof val.resetAt === 'number' ? val.resetAt : nextReading.khatm.resetAt,
          updatedAt: remoteTs,
        };
        changed = true;
      }
    }
  }

  const nextBookmarks = Array.from(bookmarkMap.values()).sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
  );

  return {
    next: {
      hifzProgress: nextHifz,
      bookmarks: nextBookmarks,
      readingLog: nextReading,
      lastRead: nextLastRead,
      mushafPage: nextMushafPage,
      tombstones: nextTombstones,
    },
    changed,
  };
}

interface AppsScriptResponse {
  ok: boolean;
  error?: string;
  serverTime?: number;
  applied?: number;
  totalRecords?: number;
  records?: SyncRecord[];
}

export async function pingSyncEndpoint(
  webAppUrl: string,
  token: string
): Promise<{ ok: boolean; error?: string; totalRecords?: number }> {
  const url = webAppUrl.trim();
  const tok = token.trim();
  if (!url || !tok) {
    return { ok: false, error: 'กรุณากรอก Web App URL และ Token ให้ครบ' };
  }
  try {
    const sep = url.includes('?') ? '&' : '?';
    const res = await fetch(
      `${url}${sep}action=ping&token=${encodeURIComponent(tok)}`,
      { method: 'GET', redirect: 'follow' }
    );
    const data = (await res.json()) as AppsScriptResponse;
    if (!data.ok) {
      return { ok: false, error: data.error || 'การตอบกลับไม่ถูกต้อง' };
    }
    return { ok: true, totalRecords: data.totalRecords };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อ Web App ได้',
    };
  }
}

export async function syncNow(
  config: SyncConfig,
  currentLocal: LocalSyncState
): Promise<SyncRunResult> {
  const url = config.webAppUrl.trim();
  const tok = config.token.trim();
  const pendingOutbox = loadSyncOutbox();

  if (!config.enabled || !url || !tok) {
    return {
      ok: false,
      error: 'ยังไม่ได้เปิดใช้งานหรือกรอกข้อมูลซิงก์ไม่ครบ',
      pushedCount: 0,
      pulledCount: 0,
      mergedState: currentLocal,
      stateChanged: false,
      nextLastPulledAt: config.lastPulledAt,
      pendingCount: Object.keys(pendingOutbox).length,
    };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      ok: false,
      offline: true,
      error: 'อุปกรณ์อยู่ในโหมด Offline — ข้อมูลถูกเก็บในคิวและจะซิงก์เมื่อต่อเน็ต',
      pushedCount: 0,
      pulledCount: 0,
      mergedState: currentLocal,
      stateChanged: false,
      nextLastPulledAt: config.lastPulledAt,
      pendingCount: Object.keys(pendingOutbox).length,
    };
  }

  try {
    // On first sync from a device, seed outbox with existing local data without clobbering newer outbox edits
    if (config.lastPulledAt === 0) {
      const seed = buildInitialOutboxFromLocalState(currentLocal, config.deviceId);
      for (const rec of seed) {
        if (!pendingOutbox[rec.key]) {
          pendingOutbox[rec.key] = rec;
        }
      }
      saveSyncOutbox(pendingOutbox);
    }

    const recordsToPush = Object.values(pendingOutbox);
    const since = Math.max(0, config.lastPulledAt - 60_000);
    let serverTime = Date.now();
    let pulledRecords: SyncRecord[] = [];
    let pushedCount = 0;

    if (recordsToPush.length === 0) {
      const sep = url.includes('?') ? '&' : '?';
      const res = await fetch(
        `${url}${sep}action=pull&since=${since}&token=${encodeURIComponent(tok)}`,
        { method: 'GET', redirect: 'follow' }
      );
      const data = (await res.json()) as AppsScriptResponse;
      if (!data.ok) {
        throw new Error(data.error || 'ดึงข้อมูลจาก Google Sheets ไม่สำเร็จ');
      }
      serverTime = data.serverTime ?? serverTime;
      pulledRecords = data.records ?? [];
    } else {
      for (let i = 0; i < recordsToPush.length; i += BATCH_SIZE) {
        const chunk = recordsToPush.slice(i, i + BATCH_SIZE);
        const isLast = i + BATCH_SIZE >= recordsToPush.length;
        // Important: text/plain avoids CORS OPTIONS preflight which Apps Script rejects
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          redirect: 'follow',
          body: JSON.stringify({
            token: tok,
            deviceId: config.deviceId,
            deviceName: config.deviceName,
            records: chunk,
            pull: isLast,
            since: isLast ? since : undefined,
          }),
        });
        const data = (await res.json()) as AppsScriptResponse;
        if (!data.ok) {
          throw new Error(data.error || 'ส่งข้อมูลไป Google Sheets ไม่สำเร็จ');
        }
        serverTime = data.serverTime ?? serverTime;
        pushedCount += chunk.length;
        if (isLast && Array.isArray(data.records)) {
          pulledRecords = data.records;
        }
      }

      // Remove pushed records from outbox only if they weren't updated while in flight
      const freshOutbox = loadSyncOutbox();
      for (const pushed of recordsToPush) {
        const cur = freshOutbox[pushed.key];
        if (cur && cur.updatedAt <= pushed.updatedAt) {
          delete freshOutbox[pushed.key];
        }
      }
      saveSyncOutbox(freshOutbox);
    }

    const { next, changed } = mergeRemoteRecords(currentLocal, pulledRecords);
    if (changed) {
      saveSyncTombstones(next.tombstones);
    }

    return {
      ok: true,
      serverTime,
      pushedCount,
      pulledCount: pulledRecords.length,
      mergedState: next,
      stateChanged: changed,
      nextLastPulledAt: serverTime,
      pendingCount: Object.keys(loadSyncOutbox()).length,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดระหว่างซิงก์',
      pushedCount: 0,
      pulledCount: 0,
      mergedState: currentLocal,
      stateChanged: false,
      nextLastPulledAt: config.lastPulledAt,
      pendingCount: Object.keys(loadSyncOutbox()).length,
    };
  }
}
