#!/usr/bin/env python3
"""
Each designed screen beside the app's screenshot of it, for the release review
(education build plan, 11.3). Designs: design/education/screens/<row>/<ID>-<name>.png
(2x exports). Screenshots: the walkthrough journey's captures (E2E_CAPTURE_DIR),
named <ID>-<name>.png the same way.

    python3 scripts/review/side-by-side.py <captures dir> <out dir>

Writes one <ID>.png per screen (design left, app right, both scaled to one
width, cut at a common height) and index.md listing every pair, with the
screens that have no capture. Needs Pillow (pip, in a virtualenv).
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parents[2]
DESIGNS = REPO / 'design' / 'education' / 'screens'
COL = 1100          # width of each column
CAP = 4200          # tallest a pair is cut to
GAP, HEAD = 40, 56


def column(img: Image.Image) -> Image.Image:
    scale = COL / img.width
    return img.convert('RGB').resize((COL, max(1, round(img.height * scale))), Image.LANCZOS)


def main(captures: Path, out: Path) -> int:
    out.mkdir(parents=True, exist_ok=True)
    rows, missing = [], []
    for design in sorted(DESIGNS.glob('*/*.png')):
        app = captures / design.name
        if not app.exists():
            missing.append(design.stem)
            continue
        left, right = column(Image.open(design)), column(Image.open(app))
        height = min(max(left.height, right.height), CAP)
        sheet = Image.new('RGB', (COL * 2 + GAP * 3, height + HEAD + GAP), 'white')
        draw = ImageDraw.Draw(sheet)
        draw.text((GAP, 18), f'{design.stem}  ·  design', fill='black')
        draw.text((COL + GAP * 2, 18), f'{design.stem}  ·  app (walkthrough journey)', fill='black')
        sheet.paste(left.crop((0, 0, COL, min(left.height, height))), (GAP, HEAD))
        sheet.paste(right.crop((0, 0, COL, min(right.height, height))), (COL + GAP * 2, HEAD))
        sheet.save(out / f'{design.stem}.png', optimize=True)
        rows.append((design.parent.name, design.stem))
    lines = ['# Every designed screen beside the app', '',
             f'{len(rows)} of {len(rows) + len(missing)} screens captured. Design left, app right.', '']
    for row, stem in rows:
        lines.append(f'- {row} · [{stem}]({stem}.png)')
    if missing:
        lines += ['', 'No capture: ' + ', '.join(missing)]
    (out / 'index.md').write_text('\n'.join(lines) + '\n')
    print(f'{len(rows)} pairs written to {out}; {len(missing)} without a capture: {", ".join(missing) or "none"}')
    return 0 if not missing else 1


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(Path(sys.argv[1]), Path(sys.argv[2])))
