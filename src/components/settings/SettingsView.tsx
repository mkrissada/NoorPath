import {
  Bookmark,
  CheckCircle2,
  Cloud,
  Copy,
  Download,
  Eye,
  EyeOff,
  HardDriveDownload,
  KeyRound,
  Languages,
  Moon,
  RefreshCw,
  RotateCcw,
  Search,
  Smartphone,
  Sun,
  SwatchBook,
  Upload,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAudio } from '../../context/AudioContext';
import { prefetchAllOfflineData } from '../../lib/dataLoader';
import { APPS_SCRIPT_CODE } from '../../lib/syncCodeTemplate';
import type { SurahMeta, ThemeMode } from '../../types/models';

function SurahNameEditRow({
  surah,
  onSave,
  onReset,
}: {
  surah: SurahMeta;
  onSave: (surahNumber: number, nameTh: string) => void;
  onReset: (surahNumber: number) => void;
}) {
  const [draft, setDraft] = useState(surah.nameTh);
  const isCustom = Boolean(surah.defaultNameTh && surah.nameTh !== surah.defaultNameTh);
  const isDirty = draft.trim() !== '' && draft.trim() !== surah.nameTh;

  useEffect(() => {
    setDraft(surah.nameTh);
  }, [surah.nameTh]);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(surah.nameTh);
      return;
    }
    if (trimmed !== surah.nameTh) {
      onSave(surah.number, trimmed);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-2.5">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="inline-flex h-6 min-w-[26px] items-center justify-center rounded-md bg-[var(--bg-subtle)] px-1.5 font-bold tabular-nums text-[var(--accent-text)]">
            {surah.number}
          </span>
          <span className="font-semibold text-[var(--text-primary)]">{surah.nameEn}</span>
          <span dir="rtl" className="font-arabic text-sm text-[var(--accent)]">
            {surah.nameAr.replace('سُورَةُ ', '')}
          </span>
          {isCustom && (
            <span className="rounded bg-[var(--gold-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-primary)]">
              เดิม: {surah.defaultNameTh}
            </span>
          )}
        </div>
      </div>

      <div className="flex w-full sm:w-auto items-center gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          aria-label={`ชื่อภาษาไทยซูเราะฮ์ที่ ${surah.number}`}
          className="min-h-[34px] flex-1 sm:w-48 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 text-xs font-semibold text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
        />
        {isDirty && (
          <button
            type="button"
            onClick={commit}
            className="min-h-[34px] rounded-lg bg-[var(--accent)] px-2.5 text-[11px] font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            บันทึก
          </button>
        )}
        {isCustom && (
          <button
            type="button"
            onClick={() => onReset(surah.number)}
            className="flex h-[34px] items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 text-[11px] font-medium text-[var(--text-secondary)] hover:border-[var(--accent)]"
            title="รีเซ็ตกลับเป็นชื่อเริ่มต้น"
          >
            <RotateCcw className="h-3 w-3" />
            รีเซ็ต
          </button>
        )}
      </div>
    </div>
  );
}

export function SettingsView() {
  const {
    settings,
    updateSettings,
    surahsIndex,
    customSurahNamesTh,
    setCustomSurahNameTh,
    resetCustomSurahNameTh,
    resetAllCustomSurahNamesTh,
    bookmarks,
    jumpToReader,
    jumpToHadith,
    exportBackupJson,
    importBackupJson,
    syncConfig,
    updateSyncConfig,
    syncState,
    syncNow,
    pingSync,
  } = useApp();
  const { reciters } = useAudio();

  const [prefetching, setPrefetching] = useState(false);
  const [prefetchProgress, setPrefetchProgress] = useState<{
    done: number;
    total: number;
    label: string;
  } | null>(null);
  const [prefetchDone, setPrefetchDone] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [surahNameSearch, setSurahNameSearch] = useState('');

  const [showToken, setShowToken] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  const customSurahCount = Object.keys(customSurahNamesTh).length;
  const filteredSurahsForEdit = useMemo(() => {
    const q = surahNameSearch.trim().toLowerCase();
    if (!q) return surahsIndex;
    return surahsIndex.filter(
      (s) =>
        String(s.number) === q ||
        s.nameTh.toLowerCase().includes(q) ||
        (s.defaultNameTh?.toLowerCase().includes(q) ?? false) ||
        s.nameEn.toLowerCase().includes(q) ||
        s.meaningTh.toLowerCase().includes(q) ||
        s.nameAr.includes(surahNameSearch.trim())
    );
  }, [surahsIndex, surahNameSearch]);

  const handleGenerateToken = () => {
    const bytes = new Uint8Array(18);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    updateSyncConfig({ token });
    setShowToken(true);
    setSyncMessage('สุ่ม Token ลับใหม่แล้ว — อย่าลืมนำไปตั้งใน Apps Script ด้วย');
  };

  const handlePing = async () => {
    setPinging(true);
    setSyncMessage(null);
    const res = await pingSync(syncConfig.webAppUrl, syncConfig.token);
    setPinging(false);
    if (res.ok) {
      setSyncMessage(
        `เชื่อมต่อ Google Sheets สำเร็จ! (มีข้อมูลบนคลาวด์ ${res.totalRecords ?? 0} รายการ)`
      );
    } else {
      setSyncMessage(`เชื่อมต่อไม่สำเร็จ: ${res.error ?? 'กรุณาตรวจสอบ URL และ Token'}`);
    }
  };

  const handleSyncNowClick = async () => {
    setSyncMessage(null);
    const res = await syncNow();
    if (res.ok) {
      setSyncMessage(
        `ซิงก์สำเร็จ — ส่งออก ${res.pushedCount} รายการ / รับเข้า ${res.pulledCount} รายการ`
      );
    } else {
      setSyncMessage(`ซิงก์ไม่สำเร็จ: ${res.error ?? 'กรุณาลองใหม่'}`);
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_CODE);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 3000);
    } catch {
      setSyncMessage('เบราว์เซอร์ไม่อนุญาตให้คัดลอกอัตโนมัติ สามารถดูโค้ดได้จากไฟล์ apps-script/Code.gs');
    }
  };

  const handlePrefetch = async () => {
    setPrefetching(true);
    setPrefetchDone(false);
    try {
      await prefetchAllOfflineData((done, total, label) => {
        setPrefetchProgress({ done, total, label });
      });
      setPrefetchDone(true);
    } catch {
      setBackupMessage('ไม่สามารถดาวน์โหลดข้อมูล Offline ได้ครบ กรุณาลองใหม่');
    } finally {
      setPrefetching(false);
    }
  };

  const handleExport = () => {
    const json = exportBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noorpath-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupMessage('ส่งออกไฟล์สำรองข้อมูลเรียบร้อยแล้ว');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importBackupJson(String(reader.result ?? ''));
        setBackupMessage('กู้คืนข้อมูลจากไฟล์สำรองสำเร็จแล้ว!');
      } catch (err) {
        setBackupMessage(err instanceof Error ? err.message : 'นำเข้าข้อมูลไม่สำเร็จ');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const themes: Array<{
    id: ThemeMode;
    name: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'parchment', name: 'กระดาษถนอมสายตา', desc: 'โทนอบอุ่น อ่านนานไม่ล้าตา', icon: SwatchBook },
    { id: 'light', name: 'สว่างคมชัด', desc: 'พื้นขาว คอนทราสต์สูง', icon: Sun },
    { id: 'night', name: 'กลางคืน (OLED)', desc: 'ถนอมสายตาในที่มืด', icon: Moon },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 sm:px-6 py-5">
      {/* Reading Theme & Fonts */}
      <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] space-y-4">
        <h2 className="text-base font-bold text-[var(--text-primary)]">
          ธีมการอ่านและขนาดตัวอักษร (ใช้ร่วมกันทั้งอัลกุรอาน ท่องจำ และฮะดีษ)
        </h2>

        <div className="grid gap-3 sm:grid-cols-3">
          {themes.map((t) => {
            const Icon = t.icon;
            const active = settings.theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => updateSettings({ theme: t.id })}
                className={`rounded-xl border p-3.5 text-left transition-all ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]/50 ring-1 ring-[var(--accent)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-elevated)]'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm text-[var(--text-primary)]">
                  <Icon className="h-4 w-4 text-[var(--accent)]" />
                  {t.name}
                </div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">{t.desc}</div>
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-3 pt-2">
          <div>
            <div className="flex justify-between text-xs font-semibold text-[var(--text-secondary)]">
              <span>ตัวอักษรอาหรับ (หน้าคำแปล)</span>
              <span>{settings.arabicFontSize}px</span>
            </div>
            <input
              type="range"
              min={20}
              max={48}
              value={settings.arabicFontSize}
              onChange={(e) => updateSettings({ arabicFontSize: Number(e.target.value) })}
              className="mt-2 w-full accent-[var(--accent)]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-[var(--text-secondary)]">
              <span>ตัวอักษรมุศฮัฟ (อาหรับล้วน)</span>
              <span>{settings.mushafFontSize}px</span>
            </div>
            <input
              type="range"
              min={20}
              max={48}
              value={settings.mushafFontSize}
              onChange={(e) => updateSettings({ mushafFontSize: Number(e.target.value) })}
              className="mt-2 w-full accent-[var(--accent)]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-[var(--text-secondary)]">
              <span>ขนาดตัวอักษรภาษาไทย</span>
              <span>{settings.thaiFontSize}px</span>
            </div>
            <input
              type="range"
              min={13}
              max={24}
              value={settings.thaiFontSize}
              onChange={(e) => updateSettings({ thaiFontSize: Number(e.target.value) })}
              className="mt-2 w-full accent-[var(--accent)]"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 pt-1 text-xs text-[var(--text-secondary)]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.mushafTwoPageSpread}
              onChange={(e) => updateSettings({ mushafTwoPageSpread: e.target.checked })}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span>แสดงมุศฮัฟแบบ 2 หน้าคู่บนหน้าจอใหญ่ (iPad แนวนอน)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoTrackReading}
              onChange={(e) => updateSettings({ autoTrackReading: e.target.checked })}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span>บันทึกการอ่านอัตโนมัติลง Dashboard (มุศฮัฟ 1.5 นาที/หน้า / อายะฮ์ 3 วิ / ฮะดีษ 8 วิ)</span>
          </label>
        </div>

        {/* Live Preview */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)]/70 p-4">
          <div
            dir="rtl"
            className="font-arabic text-right text-[var(--text-primary)]"
            style={{ fontSize: `${settings.arabicFontSize}px` }}
          >
            بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
          </div>
          <div
            className="font-thai mt-2 text-[var(--text-secondary)]"
            style={{ fontSize: `${settings.thaiFontSize}px` }}
          >
            ด้วยพระนามของอัลลอฮฺ ผู้ทรงกรุณาปรานี ผู้ทรงเมตตาเสมอ
          </div>
        </div>
      </section>

      {/* Custom Thai Surah Names */}
      <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-[var(--accent)]" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              แก้ไขชื่อซูเราะฮ์ภาษาไทย ({customSurahCount > 0 ? `แก้ไขแล้ว ${customSurahCount}` : '114 ซูเราะฮ์'})
            </h2>
          </div>
          {customSurahCount > 0 && (
            <button
              type="button"
              onClick={resetAllCustomSurahNamesTh}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-[var(--danger)] hover:border-[var(--danger)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              รีเซ็ตชื่อทั้งหมด
            </button>
          )}
        </div>

        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          ปรับคำสะกดภาษาไทยให้ตรงกับที่คุ้นเคย (เช่น &ldquo;อัล-หากเกาะฮ์&rdquo; → &ldquo;อัล-ฮากเกาะฮ์&rdquo;) ชื่อที่แก้จะมีผลทุกหน้า และยังคงค้นหาได้ทั้งชื่อใหม่ ชื่อเดิม และชื่อภาษาอังกฤษ
        </p>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={surahNameSearch}
            onChange={(e) => setSurahNameSearch(e.target.value)}
            placeholder="ค้นหาซูเราะฮ์ที่ต้องการแก้ไข (ไทย / อังกฤษ / เลข)..."
            className="min-h-[40px] w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] pl-9 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
          {filteredSurahsForEdit.map((s) => (
            <SurahNameEditRow
              key={s.number}
              surah={s}
              onSave={setCustomSurahNameTh}
              onReset={resetCustomSurahNameTh}
            />
          ))}
        </div>
      </section>

      {/* Audio Defaults */}
      <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] space-y-3">
        <h2 className="text-base font-bold text-[var(--text-primary)]">การตั้งค่าเสียงอ่าน</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              นักอ่านหลัก
            </label>
            <select
              value={settings.primaryReciterId}
              onChange={(e) => updateSettings({ primaryReciterId: e.target.value })}
              className="min-h-[42px] w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 text-sm"
            >
              {reciters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nameTh}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              นักอ่านสำรอง (เมื่อซูเราะฮ์ไม่มีเสียง / วนลูปรายอายะฮ์)
            </label>
            <select
              value={settings.fallbackReciterId}
              onChange={(e) => updateSettings({ fallbackReciterId: e.target.value })}
              className="min-h-[42px] w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 text-sm"
            >
              {reciters
                .filter((r) => r.mode === 'ayah')
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nameTh}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2.5 pt-1 text-xs text-[var(--text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={settings.useLocalSheikhAudio}
            onChange={(e) => updateSettings({ useLocalSheikhAudio: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span>
            ลองโหลดไฟล์ MP3 ของเชค อับดุลลอฮ์ จากโฟลเดอร์ในแอปก่อน (กรณีรันสคริปต์{' '}
            <code>scripts/download_sheikh_mp3s.ps1</code> ไว้แล้ว)
          </span>
        </label>
      </section>

      {/* Google Sheets Cross-Device Sync */}
      <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-[var(--accent)]" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              ซิงก์ข้อมูลข้ามอุปกรณ์ (Google Sheets + Apps Script)
            </h2>
          </div>
          <span className="rounded-lg bg-[var(--bg-subtle)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
            {syncState.pendingCount > 0
              ? `รอส่ง ${syncState.pendingCount} รายการ`
              : 'คิวว่าง'}
          </span>
        </div>

        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          เก็บสถิติการอ่าน ท่องจำ ฮะดีษ และบุ๊กมาร์กไว้ใน Google Sheet ส่วนตัวของคุณ เพื่อซิงก์ข้าม iPad
          และมือถือ (URL และ Token เก็บเฉพาะในเครื่องนี้ ไม่ฝังในโค้ด)
        </p>

        <div className="flex flex-wrap gap-4 text-xs text-[var(--text-primary)]">
          <label className="flex items-center gap-2 cursor-pointer font-semibold">
            <input
              type="checkbox"
              checked={syncConfig.enabled}
              onChange={(e) => updateSyncConfig({ enabled: e.target.checked })}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span>เปิดใช้งานซิงก์ Google Sheets</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={syncConfig.autoSync}
              onChange={(e) => updateSyncConfig({ autoSync: e.target.checked })}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span>ซิงก์อัตโนมัติเมื่อเปิดแอป / มีการเปลี่ยนแปลง / กลับมาออนไลน์</span>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              Apps Script Web App URL
            </label>
            <input
              type="url"
              value={syncConfig.webAppUrl}
              onChange={(e) => updateSyncConfig({ webAppUrl: e.target.value })}
              placeholder="https://script.google.com/macros/s/...../exec"
              className="min-h-[40px] w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              Token ลับ (ตรงกับ NOORPATH_TOKEN)
            </label>
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={syncConfig.token}
                  onChange={(e) => updateSyncConfig({ token: e.target.value })}
                  placeholder="กรอกหรือกดสุ่ม Token"
                  className="min-h-[40px] w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] pl-3 pr-9 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  title={showToken ? 'ซ่อน Token' : 'แสดง Token'}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleGenerateToken}
                className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)]"
                title="สุ่ม Token ใหม่"
              >
                <KeyRound className="h-3.5 w-3.5 text-[var(--gold)]" />
                สุ่ม
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              ชื่ออุปกรณ์นี้ (แสดงในสรุปชีต)
            </label>
            <input
              type="text"
              value={syncConfig.deviceName}
              onChange={(e) => updateSyncConfig({ deviceName: e.target.value })}
              placeholder="เช่น iPad, iPhone, PC"
              className="min-h-[40px] w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            disabled={pinging}
            onClick={() => void handlePing()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] disabled:opacity-60"
          >
            {pinging ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}
          </button>

          <button
            type="button"
            disabled={syncState.status === 'syncing' || !syncConfig.enabled}
            onClick={() => void handleSyncNowClick()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                syncState.status === 'syncing' ? 'animate-spin' : ''
              }`}
            />
            {syncState.status === 'syncing' ? 'กำลังซิงก์...' : 'ซิงก์ตอนนี้'}
          </button>

          <button
            type="button"
            onClick={() => void handleCopyScript()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)]"
          >
            <Copy className="h-3.5 w-3.5 text-[var(--accent)]" />
            {copiedScript ? 'คัดลอกโค้ด Code.gs แล้ว!' : 'คัดลอกโค้ด Apps Script (Code.gs)'}
          </button>
        </div>

        <div className="text-[11px] text-[var(--text-muted)]">
          ซิงก์ล่าสุด:{' '}
          {syncState.lastSyncedAt > 0
            ? new Date(syncState.lastSyncedAt).toLocaleString('th-TH')
            : 'ยังไม่เคยซิงก์'}{' '}
          • Device ID: <code>{syncConfig.deviceId}</code>
        </div>

        {(syncMessage || syncState.lastError) && (
          <div className="rounded-xl bg-[var(--bg-subtle)]/70 px-3 py-2 text-xs font-medium text-[var(--accent-text)]">
            {syncMessage ?? syncState.lastError}
          </div>
        )}

        <details className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-subtle)]/40 p-3 text-xs text-[var(--text-secondary)]">
          <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">
            ดูวิธีตั้งค่า Google Sheets + Apps Script ทีละขั้น
          </summary>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 leading-relaxed">
            <li>
              สร้าง Google Sheet ใหม่ แล้วเปิดเมนู <strong>ส่วนขยาย (Extensions) → Apps Script</strong>
            </li>
            <li>
              กดปุ่ม <strong>คัดลอกโค้ด Apps Script (Code.gs)</strong> ด้านบน แล้ววางแทนโค้ดเดิมทั้งหมดและกดบันทึก
            </li>
            <li>
              ไปที่ <strong>Project Settings → Script Properties</strong> เพิ่ม property ชื่อ{' '}
              <code>NOORPATH_TOKEN</code> และวาง Token ที่สุ่มไว้ (หรือใส่ใน <code>FALLBACK_TOKEN</code> บรรทัดบนของโค้ด)
            </li>
            <li>
              กด <strong>Deploy → New deployment → Web app</strong> เลือก Execute as: <strong>Me</strong>,
              Who has access: <strong>Anyone</strong> แล้วคัดลอก Web app URL มาวางช่องด้านบน
            </li>
            <li>
              ทำช่องทางเดียวกันบน iPad และมือถือ โดยใช้ URL และ Token เดียวกันเพื่อซิงก์ข้อมูลร่วมกัน
            </li>
          </ol>
        </details>
      </section>

      {/* Offline Cache & Backup */}
      <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] space-y-4">
        <h2 className="text-base font-bold text-[var(--text-primary)]">
          ใช้งานแบบ Offline บน iPad และสำรองข้อมูล
        </h2>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subtle)]/50 p-4">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              ดาวน์โหลดคลังข้อมูลทั้งหมดลง Cache ของเครื่อง
            </div>
            <div className="text-xs text-[var(--text-secondary)]">
              รวม 114 ซูเราะฮ์ + ฟอนต์มุศฮัฟ QCF V2 ครบ 604 หน้า (~93 MB) + คำแปลไทย 2 สำนวน + ตัฟซีร + ฮะดีษ 888 บท เพื่อเปิดอ่านแม้ไม่มีเน็ตบน iPad
            </div>
          </div>

          <button
            type="button"
            disabled={prefetching}
            onClick={handlePrefetch}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            <HardDriveDownload className="h-4 w-4" />
            {prefetching ? 'กำลังดาวน์โหลด...' : prefetchDone ? 'โหลดครบแล้ว!' : 'โหลดไว้ใช้ Offline'}
          </button>
        </div>

        {prefetchProgress && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-[var(--text-secondary)]">
              <span>{prefetchProgress.label}</span>
              <span>
                {prefetchProgress.done} / {prefetchProgress.total} (
                {Math.round((prefetchProgress.done / prefetchProgress.total) * 100)}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all"
                style={{
                  width: `${Math.round((prefetchProgress.done / prefetchProgress.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {prefetchDone && (
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-text)]">
            <CheckCircle2 className="h-4 w-4" />
            บันทึกข้อมูลทั้งหมดลง Service Worker Cache สำเร็จ พร้อมใช้งานแบบ Offline!
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)]"
          >
            <Download className="h-4 w-4 text-[var(--accent)]" />
            ส่งออก Bookmark & ความคืบหน้า (.json)
          </button>

          <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)]">
            <Upload className="h-4 w-4 text-[var(--gold)]" />
            นำเข้าไฟล์สำรอง (.json)
            <input type="file" accept=".json,application/json" onChange={handleImport} className="hidden" />
          </label>
        </div>

        {backupMessage && (
          <div className="text-xs font-medium text-[var(--accent-text)]">{backupMessage}</div>
        )}
      </section>

      {/* Bookmarks Quick List */}
      <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] space-y-3">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-[var(--gold)]" />
          <h2 className="text-base font-bold text-[var(--text-primary)]">
            บุ๊กมาร์กที่บันทึกไว้ ({bookmarks.length})
          </h2>
        </div>

        {bookmarks.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            ยังไม่มีบุ๊กมาร์ก — กดไอคอนรูปบุ๊กมาร์กที่อายะฮ์หรือฮะดีษเพื่อบันทึกจุดสำคัญไว้กลับมาทบทวน
          </p>
        ) : (
          <div className="space-y-2">
            {bookmarks.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  if (b.type === 'quran' && b.surah) {
                    jumpToReader(b.surah, b.ayah ?? 1);
                  } else if (b.type === 'hadith' && b.collection && b.hadithId) {
                    jumpToHadith(b.collection, b.hadithId);
                  }
                }}
                className="flex w-full items-start justify-between gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3 text-left hover:border-[var(--accent)]"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--text-primary)]">{b.title}</div>
                  {b.note && (
                    <div className="mt-0.5 text-xs text-[var(--accent-text)]">โน้ต: {b.note}</div>
                  )}
                  <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                    {b.subtitle}
                  </div>
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-[var(--accent)]">
                  เปิดดู →
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* iPad PWA Install Guide */}
      <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] space-y-2">
        <div className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
          <Smartphone className="h-4 w-4 text-[var(--accent)]" />
          วิธีติดตั้ง NoorPath เป็นแอปส่วนตัวบน iPad (Zero-Cost)
        </div>
        <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-[var(--text-secondary)]">
          <li>
            นำโฟลเดอร์ <code>dist/</code> (จากการรัน <code>npm.cmd run build</code>) อัปโหลดขึ้น
            <strong> Cloudflare Pages</strong> หรือ <strong>GitHub Pages</strong> (แบบ Private/ไม่แชร์ลิงก์สาธารณะ)
          </li>
          <li>
            เปิดลิงก์ด้วย <strong>Safari</strong> บน iPad → แนะนำให้กดปุ่ม{' '}
            <strong>&ldquo;โหลดไว้ใช้ Offline&rdquo;</strong> ด้านบนหนึ่งครั้งเพื่อให้ข้อมูลทั้ง 114 ซูเราะฮ์ถูกแคชไว้ในเครื่อง
          </li>
          <li>
            กดไอคอน <strong>Share (สี่เหลี่ยมมีลูกศรชี้ขึ้น)</strong> มุมขวาบนของ Safari → เลือก{' '}
            <strong>Add to Home Screen (เพิ่มไปยังหน้าจอโฮม)</strong> → ตั้งชื่อ <code>NoorPath</code>
          </li>
          <li>
            เปิดใช้งานจากไอคอนบน Home Screen ได้แบบเต็มหน้าจอ ไม่มีแถบเบราว์เซอร์ และไม่มีค่าใช้จ่ายรายเดือน
          </li>
        </ol>
      </section>
    </div>
  );
}
