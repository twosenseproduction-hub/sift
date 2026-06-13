#!/usr/bin/env python3
"""Build blue/red siege sprite sets from the hand-authored attack strip."""

from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
ATTACK_SOURCE = ROOT / "Siege_Attack_source.png"
TS = ROOT.parents[1] / "rts-game/assets/tiny-swords/Units"
SRC_FW = SRC_FH = 128
OUT_FW = OUT_FH = 192
IDLE_COUNT = 6
WALK_COUNT = 6

FACTIONS = {
    "blue": {
        "label": "Blue",
        "run_sheet": TS / "Blue Units/Warrior/Warrior_Run.png",
        "palette": {
            "dark": (55, 68, 102),
            "mid": (72, 88, 132),
            "light": (70, 120, 145),
            "highlight": (104, 140, 138),
        },
    },
    "red": {
        "label": "Red",
        "run_sheet": TS / "Red Units/Warrior/Warrior_Run.png",
        "palette": {
            "dark": (110, 48, 66),
            "mid": (146, 65, 89),
            "light": (199, 82, 82),
            "highlight": (231, 97, 97),
        },
    },
}


def key_black(img: Image.Image, threshold: int = 35) -> Image.Image:
    out = img.convert("RGBA").copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a and r <= threshold and g <= threshold and b <= threshold:
                px[x, y] = (0, 0, 0, 0)
    return out


def crop_frames(sheet: Image.Image, fw: int) -> list[Image.Image]:
    count = sheet.width // fw
    return [sheet.crop((i * fw, 0, (i + 1) * fw, sheet.height)) for i in range(count)]


def bbox_center(img: Image.Image) -> tuple[float, float]:
    bb = img.getbbox()
    if not bb:
        return img.width / 2, img.height / 2
    return (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2


def shift_image(img: Image.Image, dx: int, dy: int) -> Image.Image:
    out = Image.new("RGBA", (img.width, img.height), (0, 0, 0, 0))
    out.paste(img, (dx, dy), img)
    return out


def pad_frame(frame: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (OUT_FW, OUT_FH), (0, 0, 0, 0))
    x = (OUT_FW - frame.width) // 2
    y = (OUT_FH - frame.height) // 2
    canvas.alpha_composite(frame, (x, y))
    return canvas


def sheet(frames: list[Image.Image]) -> Image.Image:
    out = Image.new("RGBA", (OUT_FW * len(frames), OUT_FH), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        out.alpha_composite(pad_frame(frame), (i * OUT_FW, 0))
    return out


def pixel_kind(r: int, g: int, b: int) -> str:
    mx = max(r, g, b)
    mn = min(r, g, b)
    spread = mx - mn

    if mx < 45:
        return "outline"
    if spread < 15 and mx > 118:
        return "metal"
    if r > 175 and g > 170 and b > 155:
        return "skin"
    if r > 190 and g > 190 and b > 190:
        return "fx"
    if r > 150 and g > 110 and b < 90:
        return "fuse"
    if b >= r - 4 and b >= g - 8:
        return "team"
    return "other"


def team_shade(r: int, g: int, b: int, palette: dict[str, tuple[int, int, int]]) -> tuple[int, int, int]:
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    if lum < 78:
        return palette["dark"]
    if lum < 108:
        return palette["mid"]
    if lum < 138:
        return palette["light"]
    return palette["highlight"]


def recolor_frame(frame: Image.Image, palette: dict[str, tuple[int, int, int]]) -> Image.Image:
    out = frame.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            kind = pixel_kind(r, g, b)
            if kind == "team":
                px[x, y] = (*team_shade(r, g, b, palette), a)
    return out


def neutral_frame(attack_frames: list[Image.Image]) -> Image.Image:
    return attack_frames[-1].copy()


def make_idle(neutral: Image.Image) -> list[Image.Image]:
    frames: list[Image.Image] = []
    for i in range(IDLE_COUNT):
        bob = round(math.sin(i / IDLE_COUNT * math.pi * 2) * 1.5)
        frames.append(shift_image(neutral, 0, bob))
    return frames


def make_walk(neutral: Image.Image, run_sheet: Path) -> list[Image.Image]:
    run = key_black(Image.open(run_sheet).convert("RGBA"))
    run_fw = run.width // WALK_COUNT
    ref_center: tuple[float, float] | None = None
    frames: list[Image.Image] = []

    for i in range(WALK_COUNT):
        run_frame = run.crop((i * run_fw, 0, (i + 1) * run_fw, run.height))
        run_frame = run_frame.resize((SRC_FW, SRC_FH), Image.NEAREST)
        center = bbox_center(run_frame)
        if ref_center is None:
            ref_center = center
        dx = int(round(center[0] - ref_center[0]))
        dy = int(round(center[1] - ref_center[1]))
        frames.append(shift_image(neutral, dx, dy))

    return frames


def build_faction(faction_id: str, attack_frames: list[Image.Image]) -> dict[str, Image.Image]:
    cfg = FACTIONS[faction_id]
    palette = cfg["palette"]

    colored_attack = [recolor_frame(frame, palette) for frame in attack_frames]
    neutral = recolor_frame(neutral_frame(attack_frames), palette)
    idle_frames = make_idle(neutral)
    walk_frames = make_walk(neutral, cfg["run_sheet"])

    return {
        "Siege_Attack.png": sheet(colored_attack),
        "Siege_Idle.png": sheet(idle_frames),
        "Siege_Walk.png": sheet(walk_frames),
    }


def main() -> None:
    if not ATTACK_SOURCE.exists():
        raise SystemExit(f"missing source attack strip: {ATTACK_SOURCE}")

    attack_sheet = key_black(Image.open(ATTACK_SOURCE).convert("RGBA"))
    attack_frames = crop_frames(attack_sheet, SRC_FW)
    attack_count = len(attack_frames)

    meta_factions: dict[str, object] = {}

    for faction_id in FACTIONS:
        out_dir = ROOT / faction_id
        out_dir.mkdir(parents=True, exist_ok=True)
        outputs = build_faction(faction_id, attack_frames)
        for name, image in outputs.items():
            path = out_dir / name
            image.save(path)
            print(f"wrote {path} {image.size}")
        meta_factions[faction_id] = {
            "dir": faction_id,
            "clips": {
                "idle": {"file": f"{faction_id}/Siege_Idle.png", "count": IDLE_COUNT, "speed": 1.8},
                "walk": {"file": f"{faction_id}/Siege_Walk.png", "count": WALK_COUNT, "speed": 7},
                "attack": {
                    "file": f"{faction_id}/Siege_Attack.png",
                    "count": attack_count,
                    "speed": 8,
                },
            },
        }

    # Keep root copies synced to blue for older paths.
    blue_outputs = build_faction("blue", attack_frames)
    for name, image in blue_outputs.items():
        path = ROOT / name
        image.save(path)
        print(f"wrote {path} {image.size}")

    meta = {
        "style": "tiny-swords",
        "concept": "Custom siege bomber — grey helm, faction plume/tunic/sack",
        "source": {
            "attack": "Siege_Attack_source.png (author)",
            "idle": "derived from attack recovery frame",
            "walk": "recovery frame + faction Warrior_Run motion",
        },
        "frameW": OUT_FW,
        "frameH": OUT_FH,
        "srcFrameW": SRC_FW,
        "srcFrameH": SRC_FH,
        "factions": meta_factions,
    }
    (ROOT / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")


if __name__ == "__main__":
    main()
