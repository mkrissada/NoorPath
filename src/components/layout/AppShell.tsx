import {
  BookOpen,
  BookText,
  Brain,
  Headphones,
  LayoutDashboard,
  Moon,
  ScrollText,
  Settings,
  Sparkles,
  Sun,
  SwatchBook,
} from 'lucide-react';
import React from 'react';
import { useApp } from '../../context/AppContext';
import type { AppTab, ThemeMode } from '../../types/models';
import { AudioDock } from './AudioDock';

const NAV_ITEMS: Array<{
  id: AppTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'ภาพรวม & สถิติ', shortLabel: 'สถิติ', icon: LayoutDashboard },
  { id: 'reader', label: 'อัลกุรอาน', shortLabel: 'คำแปล', icon: BookOpen },
  { id: 'mushaf', label: 'มุศฮัฟ (อาหรับ)', shortLabel: 'มุศฮัฟ', icon: BookText },
  { id: 'hifz', label: 'โหมดท่องจำ', shortLabel: 'ท่องจำ', icon: Brain },
  { id: 'audio', label: 'เสียงอ่าน', shortLabel: 'เสียง', icon: Headphones },
  { id: 'hadith', label: 'ฮะดีษ', shortLabel: 'ฮะดีษ', icon: ScrollText },
  { id: 'athkar', label: 'อัซการ (Athkar)', shortLabel: 'อัซการ', icon: Sparkles },
  { id: 'settings', label: 'ตั้งค่า & Offline', shortLabel: 'ตั้งค่า', icon: Settings },
];

const THEME_OPTIONS: Array<{
  id: ThemeMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'parchment', label: 'กระดาษ', icon: SwatchBook },
  { id: 'light', label: 'สว่าง', icon: Sun },
  { id: 'night', label: 'กลางคืน', icon: Moon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { activeTab, setActiveTab, settings, updateSettings } = useApp();

  const adjustArabicSize = (delta: number) => {
    const next = Math.max(20, Math.min(48, settings.arabicFontSize + delta));
    updateSettings({ arabicFontSize: next });
  };

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)] md:flex-row">
      {/* iPad / Desktop Left Navigation Rail */}
      <aside className="hidden md:flex md:w-20 lg:w-60 shrink-0 flex-col justify-between border-r border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-4">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <img
              src="./icons/icon.svg"
              alt="NoorPath"
              className="h-10 w-10 shrink-0 rounded-xl shadow-sm"
            />
            <div className="hidden lg:block min-w-0">
              <div className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                NoorPath
              </div>
              <div className="truncate text-xs text-[var(--text-muted)]">
                อัลกุรอาน • ท่องจำ • ฮะดีษ
              </div>
            </div>
          </div>

          <nav className="space-y-1.5" aria-label="เมนูหลัก">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex min-h-[46px] w-full items-center justify-center lg:justify-start gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[var(--accent)] text-white shadow-sm'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="hidden lg:inline truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden lg:block rounded-xl border border-[var(--border-color)] bg-[var(--bg-subtle)]/70 p-3 text-xs text-[var(--text-secondary)]">
          <div className="font-semibold text-[var(--text-primary)]">Private iPad PWA</div>
          <div className="mt-0.5 leading-relaxed">
            ข้อมูล Bookmark และความคืบหน้าท่องจำทั้งหมดเก็บไว้ในเครื่องแบบ Zero-Cost
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="safe-top flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-3 sm:px-5 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="./icons/icon.svg"
              alt="NoorPath"
              className="h-8 w-8 rounded-lg md:hidden"
            />
            <div className="min-w-0">
              <h1 className="truncate text-base sm:text-lg font-bold text-[var(--text-primary)]">
                {NAV_ITEMS.find((i) => i.id === activeTab)?.label ?? 'NoorPath'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Arabic font stepper */}
            <div className="hidden sm:flex items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => adjustArabicSize(-2)}
                className="min-h-[34px] px-2.5 font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                title="ลดขนาดตัวอักษรอาหรับ"
              >
                ع-
              </button>
              <span className="px-1.5 text-[11px] tabular-nums text-[var(--text-muted)]">
                {settings.arabicFontSize}
              </span>
              <button
                type="button"
                onClick={() => adjustArabicSize(2)}
                className="min-h-[34px] px-2.5 font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                title="เพิ่มขนาดตัวอักษรอาหรับ"
              >
                ع+
              </button>
            </div>

            {/* Quick 3-theme pill switcher */}
            <div
              className="flex items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-0.5"
              role="group"
              aria-label="ธีมการอ่าน"
            >
              {THEME_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = settings.theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateSettings({ theme: opt.id })}
                    className={`flex min-h-[34px] items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-colors ${
                      selected
                        ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                    title={`ธีม${opt.label}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* Active Module Scrollable Body */}
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>

        {/* Persistent Audio Player */}
        <AudioDock />

        {/* Mobile Bottom Tab Bar */}
        <nav
          className="safe-bottom flex shrink-0 items-center justify-around border-t border-[var(--border-color)] bg-[var(--bg-surface)] px-0.5 pt-1 md:hidden"
          aria-label="เมนูหลักมือถือ"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 text-[10px] font-medium ${
                  active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                }`}
              >
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="max-w-full truncate">{item.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
