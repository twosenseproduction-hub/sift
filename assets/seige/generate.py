#!/usr/bin/env python3
"""Generate Tiny Swords siege sprites: Pawn + bomb sack + Pirate Fish bomb."""

from __future__ import annotations

import json
import math
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
TS = ROOT.parents[1] / "rts-game/assets/tiny-swords/Units/Blue Units/Pawn"
PIRATE_BOMB = (
    ROOT.parents[1]
    / "rts-game/assets/tiny-swords-enemy/Enemies/Pirate Fish/Bomb/Bomb_Idle.png"
)
BOMB_CACHE = ROOT / "pirate_bomb.png"
FW = FH = 192

METAL_COLORS = {
    (151, 123, 107),
    (160, 179, 182),
    (105, 119, 127),
    (76, 82, 92),
    (134, 99, 83),
    (71, 65, 68),
}
HANDLE_COLORS = {(200, 168, 118)}

# Per-frame bomb offset from pickaxe metal centroid (dx, dy, height, show).
ATTACK_OFFSETS = [
    (0, 4, 30, True),
    (-2, 3, 28, True),
    (0, 4, 28, True),
    (2, 3, 28, True),
    (6, 2, 26, True),
    (14, 0, 24, True),
    (0, 0, 20, True),
    (0, 0, 0, False),
]


def crop_frame(sheet: Image.Image, i: int, count: int) -> Image.Image:
    fw = sheet.width // count
    return sheet.crop((i * fw, 0, (i + 1) * fw, sheet.height))


def key_black(img: Image.Image, threshold: int = 28) -> Image.Image:
    out = img.convert("RGBA").copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a and r <= threshold and g <= threshold and b <= threshold:
                px[x, y] = (0, 0, 0, 0)
    return out


def prepare_pirate_bomb() -> Image.Image:
    src = key_black(Image.open(PIRATE_BOMB).convert("RGBA"))
    bbox = src.getbbox()
    if not bbox:
        raise RuntimeError("Pirate Fish bomb has no visible pixels")
    bomb = src.crop(bbox)
    bomb.save(BOMB_CACHE)
    return bomb


_BOMB_SOURCE: Image.Image | None = None


def load_bomb_sprite(height: int = 22) -> Image.Image:
    global _BOMB_SOURCE
    if _BOMB_SOURCE is None:
        _BOMB_SOURCE = prepare_pirate_bomb()
    scale = height / _BOMB_SOURCE.height
    return _BOMB_SOURCE.resize(
        (max(1, int(_BOMB_SOURCE.width * scale)), height), Image.NEAREST
    )


def paste_sprite(base: Image.Image, sprite: Image.Image, cx: float, cy: float) -> None:
    base.alpha_composite(sprite, (int(cx - sprite.width / 2), int(cy - sprite.height / 2)))


def draw_sack(img: Image.Image, bob: float = 0) -> None:
    """Bomb sack strapped to the pawn's back — overlaps the body's left edge."""
    cx, cy = 68, 103 + bob
    sack_dark = (74, 52, 34, 255)
    sack_mid = (109, 76, 46, 255)
    sack_hi = (156, 112, 68, 255)
    rope = (214, 176, 62, 255)

    blobs = [(cx, cy, 11, 13), (cx - 7, cy + 1, 7, 9), (cx + 5, cy + 3, 6, 8)]
    for bx, by, rx, ry in blobs:
        for y in range(int(by - ry), int(by + ry) + 1):
            for x in range(int(bx - rx), int(bx + rx) + 1):
                if not (0 <= x < FW and 0 <= y < FH):
                    continue
                if x > 80 or y < 90 or y > 124:
                    continue
                nx = (x - bx) / rx
                ny = (y - by) / ry
                dist = nx * nx + ny * ny
                if dist > 1:
                    continue
                c = sack_hi if dist < 0.35 else sack_mid if dist < 0.75 else sack_dark
                img.putpixel((x, y), c)

    for x in range(int(cx - 5), int(cx + 3)):
        y = int(cy - 12 + bob)
        if 0 <= x < FW and 0 <= y < FH and x <= 78 and y >= 90:
            img.putpixel((x, y), rope)


def is_swipe_pixel(r: int, g: int, b: int, a: int) -> bool:
    if a <= 128:
        return False
    if r > 200 and g > 200 and b > 200:
        return True
    # Pickaxe interact uses a pale mint arc, not pure white.
    return r >= 210 and g >= 235 and b >= 225


def metal_center(frame: Image.Image) -> tuple[float, float]:
    px = frame.load()
    xs: list[int] = []
    ys: list[int] = []
    for y in range(FH):
        for x in range(FW):
            if px[x, y][3] and px[x, y][:3] in METAL_COLORS:
                xs.append(x)
                ys.append(y)
    if not xs:
        return FW / 2, FH / 2
    return sum(xs) / len(xs), sum(ys) / len(ys)


def strip_tool(frame: Image.Image) -> Image.Image:
    """Remove pickaxe metal/handle only — keep body outline intact."""
    out = frame.convert("RGBA").copy()
    src = frame.load()
    px = out.load()

    for y in range(FH):
        for x in range(FW):
            r, g, b, a = src[x, y]
            if a and is_swipe_pixel(r, g, b, a):
                px[x, y] = (0, 0, 0, 0)

    seeds = [
        (x, y)
        for y in range(FH)
        for x in range(FW)
        if src[x, y][3] and src[x, y][:3] in METAL_COLORS
    ]
    if not seeds:
        return out

    xs = [s[0] for s in seeds]
    ys = [s[1] for s in seeds]
    pad = 6
    x0 = max(0, min(xs) - pad)
    x1 = min(FW - 1, max(xs) + pad)
    y0 = max(0, min(ys) - pad)
    y1 = min(FH - 1, max(ys) + pad)
    allowed = METAL_COLORS | HANDLE_COLORS

    tool: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque(seeds)
    while queue:
        x, y = queue.popleft()
        if (x, y) in tool:
            continue
        if not (x0 <= x <= x1 and y0 <= y <= y1):
            continue
        if src[x, y][:3] not in allowed:
            continue
        tool.add((x, y))
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                queue.append((x + dx, y + dy))

    for x, y in tool:
        px[x, y] = (0, 0, 0, 0)

    return out


def cleanup_pickaxe_ghosts(
    body: Image.Image,
    raw: Image.Image,
    bomb_x: float,
    bomb_y: float,
    bomb_h: int,
) -> Image.Image:
    """Remove pickaxe outline rings left after stripping tool fill."""
    out = body.copy()
    px = out.load()
    raw_px = raw.load()
    keep_r = max(14, bomb_h // 2 + 2)

    for y in range(FH):
        for x in range(FW):
            r, g, b, a = px[x, y]
            if not a:
                continue
            if (r, g, b) != (22, 28, 46) and (r, g, b) not in METAL_COLORS | HANDLE_COLORS:
                continue

            near_tool = False
            for dy in range(-4, 5):
                for dx in range(-4, 5):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < FW and 0 <= ny < FH and raw_px[nx, ny][:3] in METAL_COLORS | HANDLE_COLORS:
                        near_tool = True
                        break
                if near_tool:
                    break
            if not near_tool:
                continue
            if ((x - bomb_x) ** 2 + (y - bomb_y) ** 2) ** 0.5 <= keep_r:
                continue
            px[x, y] = (0, 0, 0, 0)

    return out


def attack_pose(raw: Image.Image, frame_idx: int) -> dict[str, float | int | bool]:
    dx, dy, height, show = ATTACK_OFFSETS[frame_idx]
    if frame_idx < 6:
        cx, cy = metal_center(raw)
        return {
            "x": cx + dx,
            "y": cy + dy,
            "h": height,
            "show": show,
        }
    if frame_idx == 6:
        return {"x": 148, "y": 82, "h": 20, "show": True}
    return {"x": 112, "y": 116, "h": 0, "show": False}


def extract_swipe(frame: Image.Image) -> Image.Image:
    swipe = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    src = frame.load()
    dst = swipe.load()
    for y in range(FH):
        for x in range(FW):
            r, g, b, a = src[x, y]
            if is_swipe_pixel(r, g, b, a):
                dst[x, y] = (r, g, b, a)
    return swipe


def compose_siege(
    pawn_frame: Image.Image,
    bomb_x: float,
    bomb_y: float,
    sack_bob: float = 0,
    show_bomb: bool = True,
    bomb_h: int = 22,
    swipe: Image.Image | None = None,
) -> Image.Image:
    """Layer order: sack → pawn body → swipe → bomb."""
    canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))

    sack_layer = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    draw_sack(sack_layer, sack_bob)
    canvas.alpha_composite(sack_layer)

    canvas.alpha_composite(pawn_frame.convert("RGBA"))

    if swipe is not None:
        canvas.alpha_composite(swipe)

    if show_bomb and bomb_h > 0:
        bomb = load_bomb_sprite(bomb_h)
        paste_sprite(canvas, bomb, bomb_x, bomb_y)
        # Hide any leftover pickaxe outline directly under the bomb.
        mask_r = max(12, bomb_h // 2 + 2)
        px = canvas.load()
        for y in range(FH):
            for x in range(FW):
                if ((x - bomb_x) ** 2 + (y - bomb_y) ** 2) ** 0.5 > mask_r:
                    continue
                r, g, b, a = px[x, y]
                if not a:
                    continue
                if (r, g, b) == (22, 28, 46) or (r, g, b) in METAL_COLORS | HANDLE_COLORS:
                    px[x, y] = (0, 0, 0, 0)
        paste_sprite(canvas, bomb, bomb_x, bomb_y)

    return canvas


def sheet(frames: list[Image.Image]) -> Image.Image:
    out = Image.new("RGBA", (FW * len(frames), FH), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        out.paste(frame, (i * FW, 0))
    return out


def main() -> None:
    prepare_pirate_bomb()

    pawn_idle = Image.open(TS / "Pawn_Idle.png")
    pawn_run = Image.open(TS / "Pawn_Run.png")
    pawn_pickaxe = Image.open(TS / "Pawn_Interact Pickaxe.png")

    idle_count = pawn_idle.width // FW
    run_count = pawn_run.width // FW
    pick_count = pawn_pickaxe.width // FW

    hold_x, hold_y = 112, 116

    idle_frames = []
    for i in range(6):
        frame = crop_frame(pawn_idle, i % idle_count, idle_count)
        bob = math.sin(i / 6 * math.pi * 2) * 1.5
        idle_frames.append(compose_siege(frame, hold_x, hold_y + bob, sack_bob=bob * 0.5))

    walk_frames = []
    for i in range(6):
        frame = crop_frame(pawn_run, i % run_count, run_count)
        walk_frames.append(
            compose_siege(
                frame,
                hold_x + (i % 2),
                hold_y + abs(int(math.sin(i / 6 * math.pi * 2) * 2)),
                sack_bob=(i % 3) - 1,
            )
        )

    attack_frames = []
    for i in range(len(ATTACK_OFFSETS)):
        if i < pick_count:
            raw = crop_frame(pawn_pickaxe, i, pick_count)
            pose = attack_pose(raw, i)
            body = cleanup_pickaxe_ghosts(
                strip_tool(raw),
                raw,
                float(pose["x"]),
                float(pose["y"]),
                int(pose["h"]),
            )
            swipe = extract_swipe(raw)
            sack_bob = {0: 0, 1: -1, 2: 1, 3: 2, 4: 0, 5: -1}[i]
        else:
            idle_idx = 0 if i == 7 else 1
            body = crop_frame(pawn_idle, idle_idx, idle_count)
            swipe = None
            pose = attack_pose(body, i)
            sack_bob = 0

        attack_frames.append(
            compose_siege(
                body,
                float(pose["x"]),
                float(pose["y"]),
                sack_bob=sack_bob,
                show_bomb=bool(pose["show"]),
                bomb_h=int(pose["h"]),
                swipe=swipe,
            )
        )

    files = {
        "Siege_Idle.png": sheet(idle_frames),
        "Siege_Walk.png": sheet(walk_frames),
        "Siege_Attack.png": sheet(attack_frames),
    }
    for name, image in files.items():
        path = ROOT / name
        image.save(path)
        print(f"wrote {path} {image.size}")

    meta = {
        "style": "tiny-swords",
        "concept": "Pawn with bomb sack on back, Pirate Fish bomb, pickaxe throw swipe",
        "source": {
            "body": "Blue Units/Pawn",
            "idle": "Pawn_Idle.png",
            "walk": "Pawn_Run.png",
            "attack": "Pawn_Interact Pickaxe.png (tool stripped, swipe kept)",
            "bomb": "Enemies/Pirate Fish/Bomb/Bomb_Idle.png",
        },
        "frameW": FW,
        "frameH": FH,
        "clips": {
            "idle": {"file": "Siege_Idle.png", "count": 6, "speed": 1.8},
            "walk": {"file": "Siege_Walk.png", "count": 6, "speed": 7},
            "attack": {"file": "Siege_Attack.png", "count": 8, "speed": 8},
        },
    }
    (ROOT / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")


if __name__ == "__main__":
    main()
