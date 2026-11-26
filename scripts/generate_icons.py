"""Generate crisp PNG PWA icons for NoorPath using only Python stdlib."""
import math
import struct
import zlib
from pathlib import Path


def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    chunk = chunk_type + data
    return struct.pack(">I", len(data)) + chunk + struct.pack(">I", zlib.crc32(chunk) & 0xFFFFFFFF)


def write_png(path: Path, width: int, height: int, rows: list[bytes]) -> None:
    raw = b"".join(b"\x00" + r for r in rows)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(raw, 9)
    png = b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", ihdr) + png_chunk(b"IDAT", idat) + png_chunk(b"IEND", b"")
    path.write_bytes(png)


def lerp(a: float, b: float, t: float) -> int:
    return max(0, min(255, int(round(a + (b - a) * t))))


def render_icon(size: int, out_path: Path) -> None:
    half = size / 2.0
    rows: list[bytes] = []
    # Precompute constants
    star_outer = size * 0.34
    star_inner = size * 0.255
    stroke_w = max(2.0, size * 0.026)

    for y in range(size):
        row = bytearray(size * 4)
        for x in range(size):
            t = (x + y) / (2.0 * size)
            # Emerald gradient background
            r = lerp(15, 8, t)
            g = lerp(107, 66, t)
            b = lerp(83, 51, t)
            a = 255

            dx = x + 0.5 - half
            dy = y + 0.5 - half
            dist = math.hypot(dx, dy)

            # Two rotated squares forming an 8-point Rub el Hizb star
            s1 = max(abs(dx), abs(dy))
            rx = (dx + dy) * 0.70710678
            ry = (dy - dx) * 0.70710678
            s2 = max(abs(rx), abs(ry))

            on_star_border = (
                abs(s1 - star_inner) <= stroke_w or abs(s2 - star_inner) <= stroke_w
            ) and dist <= star_outer + stroke_w

            # Inner circle + crescent
            in_medallion = dist <= size * 0.18
            on_medallion_ring = abs(dist - size * 0.18) <= stroke_w * 0.75

            crescent_outer = math.hypot(dx + size * 0.015, dy) <= size * 0.105
            crescent_cut = math.hypot(dx - size * 0.03, dy) <= size * 0.088
            on_crescent = crescent_outer and not crescent_cut

            on_dot = math.hypot(dx - size * 0.068, dy + size * 0.015) <= size * 0.022

            if in_medallion:
                r, g, b = 11, 83, 64

            if on_star_border or on_medallion_ring or on_crescent:
                # Warm gold
                r = lerp(246, 200, t)
                g = lerp(226, 155, t)
                b = lerp(163, 60, t)

            if on_dot:
                r, g, b = 251, 247, 238

            idx = x * 4
            row[idx] = r
            row[idx + 1] = g
            row[idx + 2] = b
            row[idx + 3] = a
        rows.append(bytes(row))
    write_png(out_path, size, size, rows)


if __name__ == "__main__":
    icons_dir = Path(__file__).resolve().parent.parent / "public" / "icons"
    icons_dir.mkdir(parents=True, exist_ok=True)
    render_icon(180, icons_dir / "apple-touch-icon.png")
    render_icon(192, icons_dir / "icon-192.png")
    render_icon(512, icons_dir / "icon-512.png")
    print("Generated PNG icons in", icons_dir)
