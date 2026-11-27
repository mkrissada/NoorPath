"""Build offline-ready static JSON datasets for NoorPath."""
from __future__ import annotations

import concurrent.futures
import json
import re
import sqlite3
import time
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT_DIR / "scripts" / ".cache"
DATA_DIR = ROOT_DIR / "public" / "data"
QURAN_DIR = DATA_DIR / "quran"
AUDIO_DIR = DATA_DIR / "audio"
HADITH_DIR = DATA_DIR / "hadith"

HADEETH_XLSX = Path(r"C:\Users\Administrator\OneDrive\Documents\Al-Islam\Hadith\HadeethEnc.com_th-v1.34.0.xlsx")
SHEIKH_PAGE_URL = "https://salafussaalih.net/duruus/visomo-vya-qur-aan-vya-sheikh-abdallah-humeid-al-hadhramiy/"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NoorPathDatasetBuilder/1.0"
}

# Complete 114 Surah Thai names and meanings
SURAH_THAI_META: dict[int, tuple[str, str]] = {
    1: ("อัล-ฟาติฮะฮ์", "การเปิด"),
    2: ("อัล-บะเกาะเราะฮ์", "วัวตัวเมีย"),
    3: ("อาลิ อิมรอน", "วงศ์วานของอิมรอน"),
    4: ("อัน-นิซาอ์", "สตรี"),
    5: ("อัล-มาอิดะฮ์", "สำรับอาหาร"),
    6: ("อัล-อันอาม", "ปศุสัตว์"),
    7: ("อัล-อะอ์รอฟ", "ที่สูง"),
    8: ("อัล-อันฟาล", "ทรัพย์เชลย"),
    9: ("อัต-เตาบะฮ์", "การสำนึกผิดกลับเนื้อกลับตัว"),
    10: ("ยูนุส", "นบียูนุส"),
    11: ("ฮูด", "นบีฮูด"),
    12: ("ยูซุฟ", "นบียูซุฟ"),
    13: ("อัร-เราะอ์ดุ", "ฟ้าร้อง"),
    14: ("อิบรอฮีม", "นบีอิบรอฮีม"),
    15: ("อัล-ฮิจญร์", "เมืองอัล-ฮิจญร์"),
    16: ("อัน-นะหฺลุ", "ผึ้ง"),
    17: ("อัล-อิสรออ์", "การเดินทางในยามค่ำคืน"),
    18: ("อัล-กะฮ์ฟิ", "ถ้ำ"),
    19: ("มัรยัม", "พระนางมัรยัม"),
    20: ("ฏอฮา", "ฏอฮา"),
    21: ("อัล-อัมบิยาอ์", "บรรดานบี"),
    22: ("อัล-ฮัจญ์", "การทำฮัจญ์"),
    23: ("อัล-มุอ์มินูน", "บรรดาผู้ศรัทธา"),
    24: ("อัน-นูร", "แสงสว่าง"),
    25: ("อัล-ฟุรกอน", "เครื่องจำแนกความจริงและเท็จ"),
    26: ("อัช-ชุอะรออ์", "บรรดากวี"),
    27: ("อัน-นัมลุ", "มด"),
    28: ("อัล-เกาะศ็อศ", "เรื่องราว"),
    29: ("อัล-อังกะบูต", "แมงมุม"),
    30: ("อัร-รูม", "ชาวโรมัน"),
    31: ("ลุกมาน", "ท่านลุกมาน"),
    32: ("อัส-ซัจญ์ดะฮ์", "การสุญูด"),
    33: ("อัล-อะหฺซาบ", "บรรดาพรรคพวก"),
    34: ("ซะบะอ์", "เมืองซะบะอ์"),
    35: ("ฟาฏิร", "ผู้ทรงประดิษฐ์สร้าง"),
    36: ("ยาซีน", "ยาซีน"),
    37: ("อัศ-ศ็อฟฟาต", "ผู้ยืนเรียงแถว"),
    38: ("ศ็อด", "อักษรศ็อด"),
    39: ("อัซ-ซุมัร", "บรรดากลุ่มชน"),
    40: ("ฆอฟิร", "ผู้ทรงอภัย"),
    41: ("ฟุศศิลัต", "ที่ถูกจำแนกอย่างชัดเจน"),
    42: ("อัช-ชูรอ", "การปรึกษาหารือ"),
    43: ("อัซ-ซุครุฟ", "เครื่องประดับทองคำ"),
    44: ("อัด-ดุคอน", "หมอกควัน"),
    45: ("อัล-ญาษิยะฮ์", "ผู้คุกเข่า"),
    46: ("อัล-อะหฺกอฟ", "เนินทราย"),
    47: ("มุฮัมมัด", "นบีมุฮัมมัด"),
    48: ("อัล-ฟัตหฺ", "ชัยชนะ"),
    49: ("อัล-ฮุญุรอต", "ห้องพัก"),
    50: ("กอฟ", "อักษรกอฟ"),
    51: ("อัซ-ซาริยาต", "สิ่งที่พัดกระหน่ำ"),
    52: ("อัฏ-ฏูร", "ภูเขาฏูร"),
    53: ("อัน-นัจญ์มุ", "ดวงดาว"),
    54: ("อัล-เกาะมัร", "ดวงจันทร์"),
    55: ("อัร-เราะหฺมาน", "ผู้ทรงกรุณาปรานี"),
    56: ("อัล-วากิอะฮ์", "เหตุการณ์อันแน่นอน"),
    57: ("อัล-ฮะดีด", "เหล็ก"),
    58: ("อัล-มุญาดะละฮ์", "สตรีผู้โต้เถียง"),
    59: ("อัล-ฮัชร์", "การชุมนุมเนรเทศ"),
    60: ("อัล-มุมตะฮินะฮ์", "สตรีผู้ถูกทดสอบ"),
    61: ("อัศ-ศ็อฟ", "แถว"),
    62: ("อัล-ญุมุอะฮ์", "วันศุกร์"),
    63: ("อัล-มุนาฟิกูน", "บรรดาผู้กลับกลอก"),
    64: ("อัต-ตะฆอบุน", "วันที่เปิดเผยความขาดทุน"),
    65: ("อัฏ-เฏาะลาก", "การหย่าร้าง"),
    66: ("อัต-ตะหฺรีม", "การห้าม"),
    67: ("อัล-มุลก์", "อำนาจการปกครอง"),
    68: ("อัล-เกาะลัม", "ปากกา"),
    69: ("อัล-ฮากเกาะฮ์", "เหตุการณ์อันเที่ยงแท้"),
    70: ("อัล-มะอาริจญ์", "ทางขึ้นสู่เบื้องสูง"),
    71: ("นูหฺ", "นบีนูหฺ"),
    72: ("อัล-ญิน", "ญิน"),
    73: ("อัล-มุซซัมมิล", "ผู้ห่มผ้า"),
    74: ("อัล-มุดดัษษิร", "ผู้คลุมกาย"),
    75: ("อัล-กิยามะฮ์", "วันฟื้นคืนชีพ"),
    76: ("อัล-อินซาน", "มนุษย์"),
    77: ("อัล-มุรซะลาต", "สิ่งที่ถูกส่งมา"),
    78: ("อัน-นะบะอ์", "ข่าวอันยิ่งใหญ่"),
    79: ("อัน-นาซิอาต", "ผู้ถอดถอนวิญญาณ"),
    80: ("อะบะซะ", "เขาได้ทำหน้าบึ้ง"),
    81: ("อัต-ตักวีร", "การม้วนดับ"),
    82: ("อัล-อินฟิฏอร", "การแตกแยก"),
    83: ("อัล-มุฏ็อฟฟิฟีน", "ผู้ฉ้อโกงตาชั่ง"),
    84: ("อัล-อินชิกอก", "การฉีกแยกออก"),
    85: ("อัล-บุรูจญ์", "กลุ่มดาวราศี"),
    86: ("อัฏ-ฏอริก", "ดาวที่มาเยือนยามค่ำคืน"),
    87: ("อัล-อะอ์ลา", "ผู้ทรงสูงส่งยิ่ง"),
    88: ("อัล-ฆอชิยะฮ์", "เหตุการณ์อันปกคลุม"),
    89: ("อัล-ฟัจญร์", "รุ่งอรุณ"),
    90: ("อัล-บะลัด", "เมือง"),
    91: ("อัช-ชัมส์", "ดวงอาทิตย์"),
    92: ("อัล-ลัยล์", "กลางคืน"),
    93: ("อัฎ-ฎุฮา", "ยามสาย"),
    94: ("อัช-ชัรหฺ", "การเปิดอกให้กว้างขวาง"),
    95: ("อัต-ตีน", "มะเดื่อ"),
    96: ("อัล-อะลัก", "ก้อนเลือด"),
    97: ("อัล-ก็อดร์", "คืนอันทรงเกียรติ"),
    98: ("อัล-บัยยินะฮ์", "หลักฐานอันชัดแจ้ง"),
    99: ("อัซ-ซัลซะละฮ์", "แผ่นดินไหว"),
    100: ("อัล-อาดิยาต", "ม้าศึกที่วิ่งห้อ"),
    101: ("อัล-กอริอะฮ์", "วันกิยามะฮ์อันน่าสะพรึงกลัว"),
    102: ("อัต-ตะกาษุร", "การแข่งขันสะสม"),
    103: ("อัล-อัศร์", "กาลเวลา"),
    104: ("อัล-ฮุมะซะฮ์", "ผู้นินทาว่าร้าย"),
    105: ("อัล-ฟีล", "ช้าง"),
    106: ("กุร็อยช์", "เผ่ากุร็อยช์"),
    107: ("อัล-มาอูน", "สิ่งของช่วยเหลือเล็กน้อย"),
    108: ("อัล-เกาษัร", "ความดีอันมากมาย / ธารเกาษัร"),
    109: ("อัล-กาฟิรูน", "บรรดาผู้ปฏิเสธศรัทธา"),
    110: ("อัน-นัศร์", "ความช่วยเหลือ"),
    111: ("อัล-มะซัด", "เชือกป่าน"),
    112: ("อัล-อิคลาศ", "ความบริสุทธิ์ใจต่อเอกภาพ"),
    113: ("อัล-ฟะลัก", "รุ่งอรุณ"),
    114: ("อัน-นาส", "มนุษยชาติ"),
}

WAQF_ONLY_RE = re.compile(r"^[\u06D6-\u06ED\u06DD۞۩،؛؟.]+$")


def fetch_bytes(url: str, cache_path: Path | None = None, retries: int = 3) -> bytes:
    if cache_path and cache_path.exists() and cache_path.stat().st_size > 0:
        return cache_path.read_bytes()
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
            if cache_path:
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                cache_path.write_bytes(data)
            return data
        except Exception as exc:
            last_err = exc
            time.sleep(0.75 * (attempt + 1))
    assert last_err is not None
    raise last_err


def tokenize_arabic_words(text: str) -> list[str]:
    raw_tokens = [tok.strip() for tok in re.split(r"\s+", text.strip()) if tok.strip()]
    words: list[str] = []
    for tok in raw_tokens:
        if WAQF_ONLY_RE.match(tok) and words:
            words[-1] = f"{words[-1]} {tok}"
        else:
            words.append(tok)
    return words


def normalize_arabic(text: str) -> str:
    # Remove tashkeel, tatweel, and non-Arabic punctuation for fuzzy matching
    cleaned = re.sub(r"[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]", "", text)
    cleaned = re.sub(r"[أإآٱ]", "ا", cleaned)
    cleaned = re.sub(r"ى", "ي", cleaned)
    cleaned = re.sub(r"ة", "ه", cleaned)
    cleaned = re.sub(r"[^\u0621-\u064A\s]", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def clean_thai_text(text: str) -> str:
    if not text:
        return ""
    return (
        text.replace("\x93", "“")
        .replace("\x94", "”")
        .replace("\x91", "‘")
        .replace("\x92", "’")
        .replace("\x96", "–")
        .replace("\x97", "—")
        .strip()
    )


def load_rowwad_sqlite() -> dict[tuple[int, int], dict[str, str]]:
    sqlite_path = CACHE_DIR / "thai_rwwad.sqlite"
    fetch_bytes("https://quranenc.com/downloads/sqlite/thai_rwwad.sqlite", sqlite_path)
    conn = sqlite3.connect(sqlite_path)
    cur = conn.cursor()
    tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    target_table = next((t for t in tables if "sqlite_" not in t), tables[0])
    cols = [r[1] for r in cur.execute(f"PRAGMA table_info({target_table})").fetchall()]
    col_idx = {c: i for i, c in enumerate(cols)}

    sura_col = "sura" if "sura" in col_idx else "surah"
    aya_col = "aya" if "aya" in col_idx else "ayah"
    tr_col = "translation"
    fn_col = "footnotes" if "footnotes" in col_idx else None

    mapping: dict[tuple[int, int], dict[str, str]] = {}
    for row in cur.execute(f"SELECT * FROM {target_table}").fetchall():
        s = int(row[col_idx[sura_col]])
        a = int(row[col_idx[aya_col]])
        mapping[(s, a)] = {
            "translation": clean_thai_text(str(row[col_idx[tr_col]] or "")),
            "footnotes": clean_thai_text(str(row[col_idx[fn_col]] or "")) if fn_col else "",
        }
    conn.close()
    print(f"[Rowwad SQLite] Loaded {len(mapping)} ayahs from table '{target_table}'")
    return mapping


def load_uthmani_arabic() -> dict[tuple[int, int], str]:
    raw = fetch_bytes(
        "https://api.quran.com/api/v4/quran/verses/uthmani",
        CACHE_DIR / "uthmani_verses.json",
    )
    data = json.loads(raw.decode("utf-8"))
    mapping: dict[tuple[int, int], str] = {}
    for v in data.get("verses", []):
        key = str(v.get("verse_key", ""))
        if ":" not in key:
            continue
        s_str, a_str = key.split(":", 1)
        mapping[(int(s_str), int(a_str))] = str(v.get("text_uthmani", "")).strip()
    print(f"[Uthmani Arabic] Loaded {len(mapping)} ayahs")
    return mapping


def load_kfgqpc_thai() -> dict[tuple[int, int], str]:
    mapping: dict[tuple[int, int], str] = {}
    try:
        raw = fetch_bytes(
            "https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/tha-groupfromthesoc.min.json",
            CACHE_DIR / "tha-groupfromthesoc.min.json",
        )
        data = json.loads(raw.decode("utf-8"))
        for item in data.get("quran", []):
            s = int(item["chapter"])
            a = int(item["verse"])
            text = re.sub(r"^\[\d+\]\s*", "", clean_thai_text(str(item.get("text", ""))))
            mapping[(s, a)] = text
    except Exception as exc:
        print(f"[KFGQPC fallback] {exc}; using alquran.cloud th.thai")
        raw = fetch_bytes(
            "https://api.alquran.cloud/v1/quran/th.thai",
            CACHE_DIR / "alquran_th_thai.json",
        )
        data = json.loads(raw.decode("utf-8"))
        for surah in data["data"]["surahs"]:
            s = int(surah["number"])
            for ayah in surah["ayahs"]:
                a = int(ayah["numberInSurah"])
                text = re.sub(r"^\[\d+\]\s*", "", clean_thai_text(str(ayah.get("text", ""))))
                mapping[(s, a)] = text
    print(f"[KFGQPC Thai] Loaded {len(mapping)} ayahs")
    return mapping


def fetch_tafsir_surah(surah_num: int) -> tuple[int, dict[int, str]]:
    cache_file = CACHE_DIR / "tafsir" / f"{surah_num}.json"
    cdn_url = f"https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/thai-mokhtasar/{surah_num}.json"
    gh_url = f"https://raw.githubusercontent.com/spa5k/tafsir_api/main/tafsir/thai-mokhtasar/{surah_num}.json"
    try:
        raw = fetch_bytes(cdn_url, cache_file)
    except Exception:
        raw = fetch_bytes(gh_url, cache_file)
    data = json.loads(raw.decode("utf-8"))
    items = data if isinstance(data, list) else data.get("ayahs", [])
    result: dict[int, str] = {}
    for entry in items:
        aya = int(entry.get("ayah") or entry.get("aya") or 0)
        if aya > 0:
            result[aya] = clean_thai_text(str(entry.get("text", "")))
    return surah_num, result


def build_audio_manifests() -> dict[int, list[dict[str, str]]]:
    html = fetch_bytes(SHEIKH_PAGE_URL, CACHE_DIR / "sheikh_page.html").decode("utf-8", errors="replace")
    urls = re.findall(r"https://[^\"'\s>]+\.mp3", html)
    unique_urls: list[str] = []
    seen: set[str] = set()
    for u in urls:
        if u not in seen:
            seen.add(u)
            unique_urls.append(u)

    surah_tracks: dict[int, list[dict[str, str]]] = {}
    for u in unique_urls:
        filename = u.split("/")[-1]
        m = re.match(r"^(\d{3})\.-(.+)\.mp3$", filename)
        if not m:
            continue
        surah_num = int(m.group(1))
        tracks = surah_tracks.setdefault(surah_num, [])
        idx = len(tracks) + 1
        tracks.append(
            {
                "id": f"{surah_num:03d}-{idx}",
                "partLabel": "ฉบับเต็ม",
                "filename": filename,
                "remoteUrl": u,
                "localUrl": f"./audio/sheikh-abdallah/{filename}",
            }
        )

    for surah_num, tracks in surah_tracks.items():
        if len(tracks) > 1:
            for i, track in enumerate(tracks, start=1):
                track["partLabel"] = f"ไฟล์ที่ {i} / {len(tracks)}"

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    sheikh_manifest = {
        "reciterId": "sheikh-abdallah-humeid",
        "nameTh": "เชค อับดุลลอฮ์ ฮุมัยด์ อัล-หัฎเราะมีย์",
        "nameEn": "Sheikh Abdallah Humeid Al-Hadhramiy",
        "mode": "surah-tracks",
        "coveredSurahsCount": len(surah_tracks),
        "totalTracksCount": sum(len(v) for v in surah_tracks.values()),
        "surahs": {str(k): v for k, v in sorted(surah_tracks.items())},
    }
    (AUDIO_DIR / "sheikh-abdallah-humeid.json").write_text(
        json.dumps(sheikh_manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    reciters = [
        {
            "id": "sheikh-abdallah-humeid",
            "nameTh": "เชค อับดุลลอฮ์ ฮุมัยด์ อัล-หัฎเราะมีย์",
            "nameEn": "Sheikh Abdallah Humeid Al-Hadhramiy",
            "styleTh": "เสียงอ่านรายซูเราะฮ์ (มี 91 จาก 114 ซูเราะฮ์)",
            "mode": "surah-tracks",
            "manifestUrl": "./data/audio/sheikh-abdallah-humeid.json",
            "isPartial": True,
        },
        {
            "id": "alafasy",
            "nameTh": "เชค มิชารี รอชิด อัล-อะฟาซีย์",
            "nameEn": "Mishary Rashid Alafasy",
            "styleTh": "มุรัตตัลรายอายะฮ์ (128 kbps)",
            "mode": "ayah",
            "baseUrl": "https://everyayah.com/data/Alafasy_128kbps",
            "isPartial": False,
        },
        {
            "id": "husary",
            "nameTh": "เชค มะหฺมูด เคาะลีล อัล-หุศ็อรีย์",
            "nameEn": "Mahmoud Khalil Al-Husary",
            "styleTh": "มุรัตตัลช้าชัด เหมาะสำหรับท่องจำ",
            "mode": "ayah",
            "baseUrl": "https://everyayah.com/data/Husary_128kbps",
            "isPartial": False,
        },
        {
            "id": "yasser-dawsari",
            "nameTh": "เชค ยาซิร อัด-เดาซะรีย์",
            "nameEn": "Sheikh Yasir al-Dawsari",
            "styleTh": "มุรัตตัลรายอายะฮ์ (128 kbps)",
            "mode": "ayah",
            "baseUrl": "https://everyayah.com/data/Yasser_Ad-Dussary_128kbps",
            "isPartial": False,
        },
        {
            "id": "abdulrahman-al-ossi",
            "nameTh": "เชค อับดุรเราะห์มาน อัล-เอาซีย์",
            "nameEn": "Sheikh Abdulrahman Al-Ossi",
            "styleTh": "เสียงอ่านรายซูเราะฮ์ (MP3Quran ครบ 114 ซูเราะฮ์)",
            "mode": "surah",
            "baseUrl": "https://cdn.mp3quran.net/audio/abdulrahman-oosi/r1",
            "isPartial": False,
        },
        {
            "id": "raad-al-kurdi",
            "nameTh": "เชค เราะอ์ด อัล-กุรดี",
            "nameEn": "Sheikh Raad Al-Kurdi",
            "styleTh": "เสียงอ่านรายซูเราะฮ์ (MP3Quran ครบ 114 ซูเราะฮ์)",
            "mode": "surah",
            "baseUrl": "https://cdn.mp3quran.net/audio/raad-kurdi/r1",
            "isPartial": False,
        },
    ]
    (AUDIO_DIR / "reciters.json").write_text(
        json.dumps({"reciters": reciters}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(
        f"[Audio] Mapped {sheikh_manifest['totalTracksCount']} Sheikh Abdallah MP3s across {sheikh_manifest['coveredSurahsCount']} surahs"
    )
    return surah_tracks


def build_quran_datasets(sheikh_tracks: dict[int, list[dict[str, str]]]) -> None:
    uthmani_arabic = load_uthmani_arabic()
    rowwad = load_rowwad_sqlite()
    kfgqpc = load_kfgqpc_thai()

    surahs_raw = json.loads(
        fetch_bytes("https://api.alquran.cloud/v1/surah", CACHE_DIR / "surah_meta.json").decode("utf-8")
    )
    surah_list = surahs_raw["data"]

    print("[Tafsir] Fetching 114 thai-mokhtasar surah files...")
    tafsir_map: dict[int, dict[int, str]] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for s_num, t_dict in pool.map(fetch_tafsir_surah, range(1, 115)):
            tafsir_map[s_num] = t_dict

    QURAN_DIR.mkdir(parents=True, exist_ok=True)
    surahs_index = []
    global_num = 0
    total_ayahs = 0

    for s_meta in surah_list:
        s_num = int(s_meta["number"])
        ayah_count = int(s_meta["numberOfAyahs"])
        name_th, meaning_th = SURAH_THAI_META[s_num]
        tracks = sheikh_tracks.get(s_num, [])

        meta_obj = {
            "number": s_num,
            "nameAr": s_meta["name"],
            "nameEn": s_meta["englishName"],
            "nameTh": name_th,
            "meaningTh": meaning_th,
            "revelationType": s_meta["revelationType"],
            "ayahCount": ayah_count,
            "hasSheikhAbdallahAudio": len(tracks) > 0,
            "sheikhTrackCount": len(tracks),
        }
        surahs_index.append(meta_obj)

        ayahs_payload = []
        s_tafsir = tafsir_map.get(s_num, {})
        for a_num in range(1, ayah_count + 1):
            global_num += 1
            total_ayahs += 1
            rw = rowwad.get((s_num, a_num), {})
            arabic_text = uthmani_arabic.get((s_num, a_num), "")
            ayahs_payload.append(
                {
                    "number": a_num,
                    "globalNumber": global_num,
                    "arabic": arabic_text,
                    "words": tokenize_arabic_words(arabic_text),
                    "translations": {
                        "th_kfgqpc": kfgqpc.get((s_num, a_num), ""),
                        "th_rowwad": rw.get("translation", ""),
                    },
                    "footnotes": rw.get("footnotes", ""),
                    "tafsir": s_tafsir.get(a_num, ""),
                }
            )

        surah_payload = {
            "number": s_num,
            "metadata": meta_obj,
            "ayahs": ayahs_payload,
        }
        (QURAN_DIR / f"surah-{s_num}.json").write_text(
            json.dumps(surah_payload, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

    (DATA_DIR / "surahs-index.json").write_text(
        json.dumps(surahs_index, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"[Quran] Built {len(surahs_index)} surahs / {total_ayahs} ayahs")
    from add_mushaf_layout import apply_mushaf_layout

    apply_mushaf_layout()
    if (CACHE_DIR / "qcf_v2_chapters" / "surah-114.json").exists():
        from build_qcf_mushaf import build_qcf_dataset

        build_qcf_dataset()


def col_letters_to_index(cell_ref: str) -> int:
    letters = "".join(ch for ch in cell_ref if ch.isalpha())
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch.upper()) - ord("A") + 1)
    return idx - 1


def parse_hadeethenc_xlsx() -> list[dict[str, object]]:
    ns = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(HADEETH_XLSX) as zf:
        ss_root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
        shared_strings = [
            "".join(t.text or "" for t in si.findall(".//a:t", ns))
            for si in ss_root.findall("a:si", ns)
        ]
        sheet_root = ET.fromstring(zf.read("xl/worksheets/sheet1.xml"))
        rows = sheet_root.findall(".//a:row", ns)

    parsed_rows: list[dict[str, object]] = []
    for row in rows[2:]:
        cells: dict[int, str] = {}
        for c in row.findall("a:c", ns):
            ref = c.attrib.get("r", "")
            col_i = col_letters_to_index(ref) if ref else len(cells)
            ctype = c.attrib.get("t", "")
            val = ""
            if ctype == "s":
                v_el = c.find("a:v", ns)
                if v_el is not None and v_el.text is not None:
                    val = shared_strings[int(v_el.text)]
            elif ctype == "inlineStr":
                val = "".join(t.text or "" for t in c.findall(".//a:t", ns))
            else:
                v_el = c.find("a:v", ns)
                if v_el is not None and v_el.text is not None:
                    val = v_el.text
            cells[col_i] = val

        hid = cells.get(0, "").strip()
        arabic = cells.get(3, "").strip()
        thai_text = clean_thai_text(cells.get(4, ""))
        if not hid or not arabic:
            continue

        title_th = clean_thai_text(cells.get(2, ""))
        explanation_th = clean_thai_text(cells.get(6, ""))
        benefits_th = clean_thai_text(cells.get(8, ""))
        grade_th = clean_thai_text(cells.get(11, ""))
        takhrij_th = clean_thai_text(cells.get(12, ""))
        link = cells.get(14, "").strip()

        parsed_rows.append(
            {
                "id": hid,
                "collection": "hadeethenc",
                "number": hid,
                "titleTh": title_th,
                "titleAr": cells.get(1, "").strip(),
                "arabic": arabic,
                "words": tokenize_arabic_words(arabic),
                "thaiText": thai_text,
                "englishText": "",
                "explanationTh": explanation_th,
                "benefitsTh": benefits_th,
                "gradeTh": grade_th,
                "takhrijTh": takhrij_th,
                "link": link,
                "_normTokens": {w for w in normalize_arabic(arabic).split() if len(w) >= 3},
            }
        )
    print(f"[HadeethEnc] Parsed {len(parsed_rows)} Thai hadiths from Excel")
    return parsed_rows


def build_hadith_datasets() -> None:
    HADITH_DIR.mkdir(parents=True, exist_ok=True)
    hadeethenc_items = parse_hadeethenc_xlsx()

    ara_nawawi = json.loads(
        fetch_bytes(
            "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-nawawi.min.json",
            CACHE_DIR / "ara-nawawi.min.json",
        ).decode("utf-8")
    )
    eng_nawawi = json.loads(
        fetch_bytes(
            "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-nawawi.min.json",
            CACHE_DIR / "eng-nawawi.min.json",
        ).decode("utf-8")
    )

    eng_by_num = {
        int(item["hadithnumber"]): item.get("text", "").strip()
        for item in eng_nawawi.get("hadiths", [])
    }

    nawawi_out = []
    matched_count = 0
    for item in ara_nawawi.get("hadiths", []):
        num = int(item["hadithnumber"])
        ar_text = item.get("text", "").strip()
        ar_tokens = {w for w in normalize_arabic(ar_text).split() if len(w) >= 3}

        best_match: dict[str, object] | None = None
        best_score = 0.0
        if ar_tokens:
            for candidate in hadeethenc_items:
                cand_tokens = candidate["_normTokens"]
                if not isinstance(cand_tokens, set) or not cand_tokens:
                    continue
                inter = len(ar_tokens & cand_tokens)
                if inter < 3:
                    continue
                jaccard = inter / len(ar_tokens | cand_tokens)
                containment = inter / min(len(ar_tokens), len(cand_tokens))
                score = 0.6 * containment + 0.4 * jaccard
                if score > best_score:
                    best_score = score
                    best_match = candidate

        matched = best_match if best_score >= 0.48 else None
        if matched:
            matched_count += 1

        nawawi_out.append(
            {
                "id": f"nawawi-{num}",
                "collection": "nawawi40",
                "number": num,
                "titleTh": (
                    str(matched["titleTh"])
                    if matched and matched.get("titleTh")
                    else f"ฮะดีษที่ {num} (40 ฮะดีษ อิมาม นะวาวีย์)"
                ),
                "arabic": ar_text,
                "words": tokenize_arabic_words(ar_text),
                "thaiText": str(matched["thaiText"]) if matched else "",
                "englishText": eng_by_num.get(num, ""),
                "explanationTh": str(matched["explanationTh"]) if matched else "",
                "benefitsTh": str(matched["benefitsTh"]) if matched else "",
                "gradeTh": str(matched["gradeTh"]) if matched else "รายงานโดยอัล-บุคอรี / มุสลิม (นะวาวีย์ 40)",
                "takhrijTh": str(matched["takhrijTh"]) if matched else "",
                "link": str(matched["link"]) if matched else "",
                "matchedHadeethEncId": str(matched["id"]) if matched else None,
            }
        )

    # Strip temporary token sets before writing JSON
    full_out = []
    index_out = []
    for h in hadeethenc_items:
        clean_h = {k: v for k, v in h.items() if k != "_normTokens"}
        full_out.append(clean_h)
        thai_preview = str(h["thaiText"])
        index_out.append(
            {
                "id": h["id"],
                "titleTh": h["titleTh"],
                "gradeTh": h["gradeTh"],
                "takhrijTh": h["takhrijTh"],
                "previewTh": (thai_preview[:140] + "…") if len(thai_preview) > 140 else thai_preview,
            }
        )

    (HADITH_DIR / "nawawi40.json").write_text(
        json.dumps(nawawi_out, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (HADITH_DIR / "hadeethenc-index.json").write_text(
        json.dumps(index_out, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    (HADITH_DIR / "hadeethenc-full.json").write_text(
        json.dumps(full_out, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"[Hadith] Built {len(nawawi_out)} Nawawi40 hadiths ({matched_count} matched with Thai HadeethEnc) and {len(full_out)} HadeethEnc entries")


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    sheikh_tracks = build_audio_manifests()
    build_quran_datasets(sheikh_tracks)
    build_hadith_datasets()
    print("[Done] All NoorPath datasets built successfully.")


if __name__ == "__main__":
    main()
