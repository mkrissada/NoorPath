import { Eye, EyeOff, Mic, MicOff, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MaskMode } from '../../types/models';

interface WordMaskerProps {
  words: string[];
  mode: MaskMode;
  resetKey: string | number;
  arabicFontSize: number;
  fontClassName?: string;
  onRevealStatsChange?: (revealed: number, totalMasked: number) => void;
}

interface SpeechRecInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechConstructor(): (new () => SpeechRecInstance) | null {
  const w = window as unknown as Record<string, unknown>;
  const ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return typeof ctor === 'function' ? (ctor as new () => SpeechRecInstance) : null;
}

function normalizeArabicToken(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0621-\u064A]/g, '')
    .trim();
}

function getFirstArabicLetter(word: string): string {
  const stripped = word.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '');
  const firstChar = Array.from(stripped)[0] ?? Array.from(word)[0] ?? '•';
  return `${firstChar}••`;
}

export function WordMasker({
  words,
  mode,
  resetKey,
  arabicFontSize,
  fontClassName = 'font-arabic',
  onRevealStatsChange,
}: WordMaskerProps) {
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
  const [peekAll, setPeekAll] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMatched, setVoiceMatched] = useState<Set<number>>(new Set());
  const [spokenPreview, setSpokenPreview] = useState('');
  const recognitionRef = useRef<SpeechRecInstance | null>(null);

  const speechSupported = useMemo(() => getSpeechConstructor() !== null, []);

  // Reset per-word reveal state whenever resetKey or mode changes
  useEffect(() => {
    setRevealedIndices(new Set());
    setPeekAll(false);
    setVoiceMatched(new Set());
    setSpokenPreview('');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setListening(false);
    }
  }, [resetKey, mode]);

  const maskedByDefault = useMemo(() => {
    const set = new Set<number>();
    words.forEach((_, idx) => {
      if (mode === 'hidden') {
        set.add(idx);
      } else if (mode === 'first-words') {
        if (idx >= 3) set.add(idx);
      } else if (mode === 'first-letter') {
        set.add(idx);
      } else if (mode === 'cloze-50') {
        if (idx > 0 && (idx * 7 + 3) % 2 === 1) set.add(idx);
      }
    });
    return set;
  }, [words, mode]);

  useEffect(() => {
    onRevealStatsChange?.(revealedIndices.size, maskedByDefault.size);
  }, [revealedIndices.size, maskedByDefault.size, onRevealStatsChange]);

  const toggleWord = (idx: number) => {
    if (!maskedByDefault.has(idx)) return;
    setRevealedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const resetMask = () => {
    setRevealedIndices(new Set());
    setPeekAll(false);
    setVoiceMatched(new Set());
    setSpokenPreview('');
  };

  const toggleVoiceCheck = () => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const Ctor = getSpeechConstructor();
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = 'ar-SA';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += ` ${event.results[i][0].transcript}`;
      }
      setSpokenPreview(transcript.trim());
      const spokenSet = new Set(
        transcript
          .split(/\s+/)
          .map(normalizeArabicToken)
          .filter((t) => t.length >= 2)
      );
      const matched = new Set<number>();
      words.forEach((w, idx) => {
        const norm = normalizeArabicToken(w);
        if (norm && spokenSet.has(norm)) {
          matched.add(idx);
        }
      });
      setVoiceMatched(matched);
      setRevealedIndices((prev) => {
        const merged = new Set(prev);
        matched.forEach((m) => merged.add(m));
        return merged;
      });
    };

    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <div className="space-y-3">
      {/* Word-by-word RTL interactive canvas */}
      <div
        dir="rtl"
        className={`${fontClassName} flex flex-wrap items-center gap-x-2.5 gap-y-2.5 leading-relaxed select-none`}
        style={{ fontSize: `${arabicFontSize}px` }}
      >
        {words.map((word, idx) => {
          const isMasked = maskedByDefault.has(idx);
          const isRevealed = !isMasked || peekAll || revealedIndices.has(idx);
          const isVoiceHit = voiceMatched.has(idx);

          if (!isMasked) {
            return (
              <span
                key={idx}
                className={`inline-flex items-center rounded-lg px-1 transition-colors ${
                  isVoiceHit ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]' : ''
                }`}
              >
                {word}
              </span>
            );
          }

          if (isRevealed) {
            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleWord(idx)}
                title="แตะเพื่อซ่อนคำนี้อีกครั้ง"
                className={`inline-flex min-h-[44px] items-center rounded-xl border px-2 py-0.5 transition-all active:scale-95 ${
                  isVoiceHit
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'border-[var(--gold)]/60 bg-[var(--gold-soft)] text-[var(--text-primary)]'
                }`}
              >
                {word}
              </button>
            );
          }

          const placeholder =
            mode === 'first-letter' ? getFirstArabicLetter(word) : '•••••';

          return (
            <button
              key={idx}
              type="button"
              onClick={() => toggleWord(idx)}
              aria-label={`เปิดคำที่ ${idx + 1}`}
              className="inline-flex min-h-[44px] min-w-[60px] items-center justify-center rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-subtle)] px-3 py-1 text-[0.72em] text-[var(--text-muted)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] active:scale-95"
            >
              {placeholder}
            </button>
          );
        })}
      </div>

      {/* Quick controls for memorization */}
      {mode !== 'full' && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-color)] pt-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPeekAll((v) => !v)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 font-medium text-[var(--text-primary)] hover:border-[var(--accent)]"
            >
              {peekAll ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {peekAll ? 'ซ่อนกลับ' : 'เปิดดูทั้งบท'}
            </button>

            <button
              type="button"
              onClick={resetMask}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              ซ่อนใหม่
            </button>

            {speechSupported && (
              <button
                type="button"
                onClick={toggleVoiceCheck}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium transition-colors ${
                  listening
                    ? 'border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)] animate-pulse-soft'
                    : 'border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent-text)]'
                }`}
              >
                {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {listening ? 'หยุดตรวจเสียง' : 'ฝึกอ่านออกเสียง'}
              </button>
            )}
          </div>

          <span className="text-[var(--text-muted)]">
            เปิดดู {revealedIndices.size} / {maskedByDefault.size} คำ
          </span>
        </div>
      )}

      {listening && spokenPreview && (
        <div
          dir="rtl"
          className="rounded-lg bg-[var(--bg-subtle)] px-3 py-2 text-right text-sm text-[var(--text-secondary)]"
        >
          <span className="ml-2 text-xs text-[var(--text-muted)]" dir="ltr">
            [ได้ยิน:]
          </span>
          {spokenPreview}
        </div>
      )}
    </div>
  );
}
