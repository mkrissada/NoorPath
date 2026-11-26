"""Download QCF V2 604-page fonts + UthmanicHafs v18 and build 15-line Mushaf dataset."""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import time
import urllib.request
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT_DIR / "scripts" / ".cache"
CHAPTER_CACHE_DIR = CACHE_DIR / "qcf_v2_chapters"
DATA_DIR = ROOT_DIR / "public" / "data"
FONTS_DIR = ROOT_DIR / "public" / "fonts"
QCF_FONTS_DIR = FONTS_DIR / "qcf-v2"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NoorPathQcfBuilder/1.0"
}

UTHMANIC_V18_URLS = [
    "https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2",
    "https://verses.quran.com/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2",
]

QCF_PAGE_URL_TEMPLATES = [
    "https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p{page}.woff2",
    "https://verses.quran.com/fonts/quran/hafs/v2/woff2/p{page}.woff2",
]


def _check_stop_deadline() -> None:
    now = dt.datetime.now()
    # Hard stop guard before 16:55 local time on 2026-11-24
    if (now.year, now.month, now.day) == (2026, 11, 24) and (now.hour, now.minute) >= (16, 53):
        raise TimeoutError(
            f"Stopped cleanly at {now.strftime('%H:%M:%S')} before 16:55 deadline. "
            "All completed downloads are cached and can be resumed."
        )


def _fetch_bytes(url: str, retries: int = 3) -> bytes:
    last_err: Exception | None = None
    for attempt in range(retries):
        _check_stop_deadline()
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=45) as resp:
                return resp.read()
        except Exception as exc:
            last_err = exc
            time.sleep(0.6 * (attempt + 1))
    assert last_err is not None
    raise last_err


def _fetch_with_fallbacks(urls: list[str]) -> bytes:
    last_err: Exception | None = None
    for u in urls:
        try:
            return _fetch_bytes(u, retries=2)
        except Exception as exc:
            last_err = exc
    assert last_err is not None
    raise last_err


def _is_valid_woff2(path: Path) -> bool:
    if not path.exists() or path.stat().st_size < 500:
        return False
    with path.open("rb") as f:
        magic = f.read(4)
    return magic == b"wOF2"


def download_uthmanic_v18() -> None:
    target = FONTS_DIR / "UthmanicHafs1Ver18.woff2"
    if _is_valid_woff2(target):
        print(f"[Font] UthmanicHafs1Ver18.woff2 already cached ({target.stat().st_size} bytes)")
        return
    FONTS_DIR.mkdir(parents=True, exist_ok=True)
    data = _fetch_with_fallbacks(UTHMANIC_V18_URLS)
    if data[:4] != b"wOF2":
        raise ValueError("Downloaded UthmanicHafs1Ver18.woff2 is not a valid wOFF2 file")
    target.write_bytes(data)
    print(f"[Font] Downloaded UthmanicHafs1Ver18.woff2 ({len(data)} bytes)")


def _download_single_qcf_page(page: int) -> tuple[int, int, bool]:
    _check_stop_deadline()
    target = QCF_FONTS_DIR / f"p{page}.woff2"
    if _is_valid_woff2(target):
        return page, target.stat().st_size, False
    urls = [tpl.format(page=page) for tpl in QCF_PAGE_URL_TEMPLATES]
    data = _fetch_with_fallbacks(urls)
    if data[:4] != b"wOF2":
        raise ValueError(f"Invalid wOFF2 header for page {page}")
    target.write_bytes(data)
    return page, len(data), True


def download_all_qcf_fonts() -> None:
    QCF_FONTS_DIR.mkdir(parents=True, exist_ok=True)
    total_bytes = 0
    newly_downloaded = 0
    completed = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        futures = [pool.submit(_download_single_qcf_page, p) for p in range(1, 605)]
        for fut in concurrent.futures.as_completed(futures):
            _, size, is_new = fut.result()
            total_bytes += size
            if is_new:
                newly_downloaded += 1
            completed += 1
            if completed % 100 == 0 or completed == 604:
                print(
                    f"[QCF Fonts] {completed}/604 verified "
                    f"(new: {newly_downloaded}, total: {total_bytes / (1024 * 1024):.2f} MB)"
                )


def _fetch_chapter_qcf(surah_num: int, expected_ayahs: int) -> tuple[int, int, bool]:
    _check_stop_deadline()
    CHAPTER_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = CHAPTER_CACHE_DIR / f"surah-{surah_num}.json"
    if cache_file.exists() and cache_file.stat().st_size > 100:
        try:
            cached = json.loads(cache_file.read_text(encoding="utf-8"))
            if isinstance(cached, list) and len(cached) == expected_ayahs:
                return surah_num, len(cached), False
        except Exception:
            pass

    verses: list[dict[str, Any]] = []
    page = 1
    while True:
        url = (
            f"https://api.quran.com/api/v4/verses/by_chapter/{surah_num}"
            "?mushaf=1&words=true"
            "&word_fields=code_v2,v2_page,line_number,page_number,text_uthmani,char_type_name"
            f"&per_page=50&page={page}"
        )
        raw = json.loads(_fetch_bytes(url).decode("utf-8"))
        batch = raw.get("verses", [])
        verses.extend(batch)
        pagination = raw.get("pagination", {})
        next_page = pagination.get("next_page")
        if not next_page or len(batch) == 0:
            break
        page = int(next_page)

    if len(verses) != expected_ayahs:
        raise ValueError(
            f"Surah {surah_num}: expected {expected_ayahs} verses, got {len(verses)}"
        )

    cache_file.write_text(
        json.dumps(verses, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    return surah_num, len(verses), True


def download_all_qcf_chapters() -> None:
    surahs_index = json.loads((DATA_DIR / "surahs-index.json").read_text(encoding="utf-8"))
    expected_map = {int(s["number"]): int(s["ayahCount"]) for s in surahs_index}

    completed = 0
    newly_fetched = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = [
            pool.submit(_fetch_chapter_qcf, s_num, expected_map[s_num])
            for s_num in range(1, 115)
        ]
        for fut in concurrent.futures.as_completed(futures):
            _, _, is_new = fut.result()
            if is_new:
                newly_fetched += 1
            completed += 1
            if completed % 25 == 0 or completed == 114:
                print(
                    f"[QCF Chapters] {completed}/114 chapters ready (newly fetched: {newly_fetched})"
                )


def build_qcf_dataset() -> None:
    # Verify all 604 fonts exist and are valid wOFF2
    missing_fonts = [p for p in range(1, 605) if not _is_valid_woff2(QCF_FONTS_DIR / f"p{p}.woff2")]
    if missing_fonts:
        raise FileNotFoundError(
            f"Missing or invalid QCF V2 font files (count={len(missing_fonts)}), first={missing_fonts[:5]}"
        )
    if not _is_valid_woff2(FONTS_DIR / "UthmanicHafs1Ver18.woff2"):
        raise FileNotFoundError("Missing or invalid UthmanicHafs1Ver18.woff2")

    # page -> line_number -> list of word tuples [surah, ayah, isEnd, code_v2]
    page_word_lines: dict[int, dict[int, list[list[Any]]]] = {p: {} for p in range(1, 605)}
    surah_first_pos: dict[int, tuple[int, int]] = {}
    total_verses = 0
    total_words = 0
    page_mismatches = 0

    surahs_index = json.loads((DATA_DIR / "surahs-index.json").read_text(encoding="utf-8"))
    layout_meta_path = CACHE_DIR / "quran_layout_meta.json"
    layout_meta = (
        json.loads(layout_meta_path.read_text(encoding="utf-8"))
        if layout_meta_path.exists()
        else {}
    )
    layout_updated = False

    for s_meta in surahs_index:
        s_num = int(s_meta["number"])
        cache_file = CHAPTER_CACHE_DIR / f"surah-{s_num}.json"
        if not cache_file.exists():
            raise FileNotFoundError(f"Missing cached chapter {cache_file}")
        verses: list[dict[str, Any]] = json.loads(cache_file.read_text(encoding="utf-8"))

        surah_json_path = DATA_DIR / "quran" / f"surah-{s_num}.json"
        surah_payload = json.loads(surah_json_path.read_text(encoding="utf-8"))
        ayah_by_num = {int(a["number"]): a for a in surah_payload["ayahs"]}

        for v in verses:
            total_verses += 1
            v_key = str(v["verse_key"])
            _, a_str = v_key.split(":")
            a_num = int(a_str)
            words = v.get("words", [])
            if not words:
                raise ValueError(f"Verse {v_key} has no words")

            first_w_page = int(words[0].get("v2_page") or words[0].get("page_number"))
            if ayah_by_num[a_num].get("page") != first_w_page:
                page_mismatches += 1
                if v_key in layout_meta:
                    layout_meta[v_key]["page"] = first_w_page
                    layout_updated = True

            for idx, w in enumerate(words):
                w_page = int(w.get("v2_page") or w.get("page_number"))
                w_line = int(w["line_number"])
                code_v2 = str(w.get("code_v2") or "").strip()
                if not code_v2:
                    raise ValueError(f"Empty code_v2 in {v_key} word {idx}")
                is_end = 1 if w.get("char_type_name") == "end" else 0

                if a_num == 1 and idx == 0 and s_num not in surah_first_pos:
                    surah_first_pos[s_num] = (w_page, w_line)

                line_list = page_word_lines[w_page].setdefault(w_line, [])
                line_list.append([s_num, a_num, is_end, code_v2])
                total_words += 1

    # Build final ordered line items per page (with Surah headers & Bismillahs)
    page_special_items: dict[int, list[tuple[float, dict[str, Any]]]] = {
        p: [] for p in range(1, 605)
    }

    for s_num in range(1, 115):
        p, first_line = surah_first_pos[s_num]
        if s_num == 1:
            page_special_items[p].append((first_line - 1, {"t": "surah", "s": 1, "l": max(1, first_line - 1)}))
        elif s_num == 2:
            # Surah 2 always keeps both header and bismillah at the top of Page 2
            page_special_items[p].append((first_line - 2, {"t": "surah", "s": 2, "l": max(1, first_line - 2)}))
            page_special_items[p].append((first_line - 1, {"t": "bismillah", "s": 2, "l": max(1, first_line - 1)}))
        elif s_num == 9:
            # Surah At-Tawbah has no Bismillah
            if first_line >= 2 and (first_line - 1) not in page_word_lines[p]:
                page_special_items[p].append((first_line - 1, {"t": "surah", "s": 9, "l": first_line - 1}))
            elif p > 1 and 15 not in page_word_lines[p - 1]:
                page_special_items[p - 1].append((15, {"t": "surah", "s": 9, "l": 15}))
            else:
                page_special_items[p].append((first_line - 0.5, {"t": "surah", "s": 9, "l": first_line}))
        else:
            if first_line >= 3 and (first_line - 2) not in page_word_lines[p] and (first_line - 1) not in page_word_lines[p]:
                page_special_items[p].append((first_line - 2, {"t": "surah", "s": s_num, "l": first_line - 2}))
                page_special_items[p].append((first_line - 1, {"t": "bismillah", "s": s_num, "l": first_line - 1}))
            elif first_line == 2 and (1 not in page_word_lines[p]) and p > 2 and (15 not in page_word_lines[p - 1]):
                # Header at line 15 of previous page, Bismillah at line 1 of current page
                page_special_items[p - 1].append((15, {"t": "surah", "s": s_num, "l": 15}))
                page_special_items[p].append((1, {"t": "bismillah", "s": s_num, "l": 1}))
            elif first_line == 1 and p > 2 and (14 not in page_word_lines[p - 1]) and (15 not in page_word_lines[p - 1]):
                page_special_items[p - 1].append((14, {"t": "surah", "s": s_num, "l": 14}))
                page_special_items[p - 1].append((15, {"t": "bismillah", "s": s_num, "l": 15}))
            else:
                page_special_items[p].append((first_line - 0.8, {"t": "surah", "s": s_num, "l": first_line}))
                page_special_items[p].append((first_line - 0.4, {"t": "bismillah", "s": s_num, "l": first_line}))

    out_pages: list[dict[str, Any]] = []
    for p in range(1, 605):
        combined: list[tuple[float, dict[str, Any]]] = list(page_special_items[p])
        for line_num, words_arr in page_word_lines[p].items():
            combined.append((float(line_num), {"t": "words", "l": line_num, "w": words_arr}))
        combined.sort(key=lambda item: item[0])
        out_pages.append(
            {
                "p": p,
                "lines": [item[1] for item in combined],
            }
        )

    assert total_verses == 6236, f"Expected 6236 verses, got {total_verses}"
    assert len(out_pages) == 604, f"Expected 604 pages, got {len(out_pages)}"

    if layout_updated:
        layout_meta_path.write_text(
            json.dumps(layout_meta, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        from add_mushaf_layout import apply_mushaf_layout

        apply_mushaf_layout(force_refresh=False)
        print(f"[QCF Dataset] Synced {page_mismatches} boundary ayahs in mushaf-pages.json & surah-*.json to QCF V2 pages.")

    out_path = DATA_DIR / "mushaf-qcf-v2.json"
    out_path.write_text(
        json.dumps(out_pages, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    size_mb = out_path.stat().st_size / (1024 * 1024)
    p1_sample = out_pages[0]["lines"][:3]
    print(
        f"[QCF Dataset] Built {out_path.name} ({size_mb:.2f} MB): "
        f"604 pages, {total_verses} verses, {total_words} glyph tokens, "
        f"page_mismatches={page_mismatches}."
    )
    print(f"[QCF Sample Page 1] {json.dumps(p1_sample, ensure_ascii=False)[:240]}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build QCF V2 Mushaf fonts & 15-line dataset")
    parser.add_argument("--fetch-only", action="store_true", help="Only fetch fonts and chapter JSONs")
    args = parser.parse_args()

    download_uthmanic_v18()
    download_all_qcf_fonts()
    download_all_qcf_chapters()

    if not args.fetch_only:
        build_qcf_dataset()


if __name__ == "__main__":
    main()
