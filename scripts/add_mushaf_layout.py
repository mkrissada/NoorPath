"""Enrich NoorPath Quran datasets with 604-page Mushaf, Juz, and Hizb metadata."""
from __future__ import annotations

import argparse
import json
import time
import urllib.request
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT_DIR / "scripts" / ".cache"
DATA_DIR = ROOT_DIR / "public" / "data"
QURAN_DIR = DATA_DIR / "quran"
LAYOUT_CACHE_PATH = CACHE_DIR / "quran_layout_meta.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NoorPathMushafBuilder/1.0"
}


def _fetch_json(url: str, retries: int = 3) -> Any:
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            last_err = exc
            time.sleep(0.8 * (attempt + 1))
    assert last_err is not None
    raise last_err


def _fetch_from_alquran_cloud() -> dict[str, dict[str, int]]:
    print("[Layout] Fetching 604-page layout from api.alquran.cloud...")
    raw = _fetch_json("https://api.alquran.cloud/v1/quran/quran-uthmani")
    surahs = raw.get("data", {}).get("surahs", [])
    layout: dict[str, dict[str, int]] = {}
    for surah in surahs:
        s_num = int(surah["number"])
        for ayah in surah.get("ayahs", []):
            a_num = int(ayah["numberInSurah"])
            page = int(ayah["page"])
            juz = int(ayah["juz"])
            hq = int(ayah["hizbQuarter"])
            hizb = (hq - 1) // 4 + 1
            layout[f"{s_num}:{a_num}"] = {
                "page": page,
                "juz": juz,
                "hizbQuarter": hq,
                "hizb": hizb,
            }
    if len(layout) != 6236:
        raise ValueError(f"Expected 6236 ayahs from alquran.cloud, got {len(layout)}")
    return layout


def _fetch_from_quran_com() -> dict[str, dict[str, int]]:
    print("[Layout] Fetching 604-page layout from api.quran.com fallback...")
    layout: dict[str, dict[str, int]] = {}
    for s_num in range(1, 115):
        url = (
            f"https://api.quran.com/api/v4/verses/by_chapter/{s_num}"
            "?fields=page_number,juz_number,hizb_number,rub_el_hizb_number&per_page=300"
        )
        raw = _fetch_json(url)
        for v in raw.get("verses", []):
            a_num = int(v["verse_number"])
            page = int(v["page_number"])
            juz = int(v["juz_number"])
            hq = int(v.get("rub_el_hizb_number") or ((int(v["hizb_number"]) - 1) * 4 + 1))
            hizb = int(v.get("hizb_number") or ((hq - 1) // 4 + 1))
            layout[f"{s_num}:{a_num}"] = {
                "page": page,
                "juz": juz,
                "hizbQuarter": hq,
                "hizb": hizb,
            }
    if len(layout) != 6236:
        raise ValueError(f"Expected 6236 ayahs from quran.com, got {len(layout)}")
    return layout


def ensure_layout_cache(force_refresh: bool = False) -> dict[str, dict[str, int]]:
    if not force_refresh and LAYOUT_CACHE_PATH.exists() and LAYOUT_CACHE_PATH.stat().st_size > 1000:
        data = json.loads(LAYOUT_CACHE_PATH.read_text(encoding="utf-8"))
        if len(data) == 6236:
            return data

    try:
        layout = _fetch_from_alquran_cloud()
    except Exception as exc:
        print(f"[Layout] Primary source failed ({exc}); trying fallback...")
        layout = _fetch_from_quran_com()

    LAYOUT_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    LAYOUT_CACHE_PATH.write_text(
        json.dumps(layout, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"[Layout] Cached {len(layout)} ayah layout records to {LAYOUT_CACHE_PATH}")
    return layout


def _build_segments(items: list[tuple[int, int]]) -> list[dict[str, int]]:
    """Collapse ordered (surah, ayah) pairs into contiguous segments per surah."""
    segments: list[dict[str, int]] = []
    for s_num, a_num in items:
        if segments and segments[-1]["surah"] == s_num and segments[-1]["to"] + 1 == a_num:
            segments[-1]["to"] = a_num
        else:
            segments.append({"surah": s_num, "from": a_num, "to": a_num})
    return segments


def apply_mushaf_layout(force_refresh: bool = False) -> None:
    layout = ensure_layout_cache(force_refresh=force_refresh)

    surahs_index_path = DATA_DIR / "surahs-index.json"
    surahs_index: list[dict[str, Any]] = json.loads(surahs_index_path.read_text(encoding="utf-8"))
    surahs_by_num = {int(s["number"]): s for s in surahs_index}

    page_buckets: dict[int, list[tuple[int, int, int, int]]] = {}
    juz_buckets: dict[int, list[tuple[int, int, int]]] = {}

    total_ayahs = 0
    for s_num in range(1, 115):
        surah_file = QURAN_DIR / f"surah-{s_num}.json"
        payload: dict[str, Any] = json.loads(surah_file.read_text(encoding="utf-8"))

        pages_in_surah: list[int] = []
        juz_in_surah: set[int] = set()

        for ayah in payload.get("ayahs", []):
            a_num = int(ayah["number"])
            key = f"{s_num}:{a_num}"
            meta = layout.get(key)
            if not meta:
                raise KeyError(f"Missing layout metadata for {key}")
            page = int(meta["page"])
            juz = int(meta["juz"])
            hizb = int(meta["hizb"])
            hq = int(meta["hizbQuarter"])

            ayah["page"] = page
            ayah["juz"] = juz
            ayah["hizb"] = hizb
            ayah["hizbQuarter"] = hq

            pages_in_surah.append(page)
            juz_in_surah.add(juz)
            page_buckets.setdefault(page, []).append((s_num, a_num, juz, hizb))
            juz_buckets.setdefault(juz, []).append((s_num, a_num, page))
            total_ayahs += 1

        start_page = min(pages_in_surah)
        end_page = max(pages_in_surah)
        juz_list = sorted(juz_in_surah)

        payload["metadata"]["startPage"] = start_page
        payload["metadata"]["endPage"] = end_page
        payload["metadata"]["juzList"] = juz_list

        if s_num in surahs_by_num:
            surahs_by_num[s_num]["startPage"] = start_page
            surahs_by_num[s_num]["endPage"] = end_page
            surahs_by_num[s_num]["juzList"] = juz_list

        surah_file.write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

    surahs_index_path.write_text(
        json.dumps(surahs_index, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    mushaf_pages: list[dict[str, Any]] = []
    for page_num in range(1, 605):
        entries = page_buckets.get(page_num, [])
        if not entries:
            raise AssertionError(f"Mushaf page {page_num} has no ayahs")
        pairs = [(s, a) for s, a, _, _ in entries]
        unique_surahs: list[int] = []
        for s, _ in pairs:
            if not unique_surahs or unique_surahs[-1] != s:
                if s not in unique_surahs:
                    unique_surahs.append(s)
        mushaf_pages.append(
            {
                "page": page_num,
                "juz": entries[0][2],
                "hizb": entries[0][3],
                "start": [pairs[0][0], pairs[0][1]],
                "end": [pairs[-1][0], pairs[-1][1]],
                "surahs": unique_surahs,
                "ayahCount": len(entries),
                "segments": _build_segments(pairs),
            }
        )

    juz_index: list[dict[str, Any]] = []
    for juz_num in range(1, 31):
        entries = juz_buckets.get(juz_num, [])
        if not entries:
            raise AssertionError(f"Juz {juz_num} has no ayahs")
        pairs = [(s, a) for s, a, _ in entries]
        pages = [p for _, _, p in entries]
        unique_surahs: list[int] = []
        for s, _ in pairs:
            if s not in unique_surahs:
                unique_surahs.append(s)
        juz_index.append(
            {
                "juz": juz_num,
                "startPage": min(pages),
                "endPage": max(pages),
                "start": [pairs[0][0], pairs[0][1]],
                "end": [pairs[-1][0], pairs[-1][1]],
                "ayahCount": len(entries),
                "surahs": unique_surahs,
                "segments": _build_segments(pairs),
            }
        )

    (DATA_DIR / "mushaf-pages.json").write_text(
        json.dumps(mushaf_pages, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    (DATA_DIR / "juz-index.json").write_text(
        json.dumps(juz_index, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # Strict validation assertions
    assert total_ayahs == 6236, f"Expected 6236 ayahs, got {total_ayahs}"
    assert len(mushaf_pages) == 604, f"Expected 604 pages, got {len(mushaf_pages)}"
    assert len(juz_index) == 30, f"Expected 30 juz, got {len(juz_index)}"
    assert layout["1:1"]["page"] == 1 and layout["1:1"]["juz"] == 1
    assert layout["2:1"]["page"] == 2 and layout["2:1"]["juz"] == 1
    assert layout["2:142"]["page"] == 22 and layout["2:142"]["juz"] == 2
    assert layout["114:6"]["page"] == 604 and layout["114:6"]["juz"] == 30

    print(
        f"[Layout] Verified 604 pages, 30 juz, {total_ayahs} ayahs. "
        "Updated surah-1..114.json, surahs-index.json, mushaf-pages.json, and juz-index.json."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Add 604-page Mushaf layout metadata")
    parser.add_argument(
        "--fetch-only",
        action="store_true",
        help="Only download and cache quran_layout_meta.json",
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Re-fetch layout metadata ignoring cache",
    )
    args = parser.parse_args()

    if args.fetch_only:
        ensure_layout_cache(force_refresh=True)
    else:
        apply_mushaf_layout(force_refresh=args.refresh)


if __name__ == "__main__":
    main()
