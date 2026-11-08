"""Build web sprites and fixed-size tile atlases from hem/*.png.

Requires Pillow; run from any directory. Panel atlases contain nine 24x24
tiles: four corners, four repeatable edges and a center. CSS uses repeat
(not stretch or round) so resizing a panel adds tiles instead of scaling them.
Controls use the same atlas at a smaller fixed scale; progress tiles are 8x8.
"""

from collections import deque
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "hem"
OUTPUT = ROOT / "assets" / "sprites"


def source(prefix):
    matches = list(SOURCE.glob(prefix + "*.png"))
    if len(matches) != 1:
        raise ValueError(f"Expected one source for {prefix!r}, found {len(matches)}")
    return Image.open(matches[0]).convert("RGBA")


def crop_fraction(image, box):
    width, height = image.size
    return image.crop(tuple(round(value * (width if i % 2 == 0 else height)) for i, value in enumerate(box)))


def clear_background(image):
    # Flood only neutral, pale pixels connected to the outside; keep sprite highlights.
    pixels = image.load()
    width, height = image.size
    visited = set()
    queue = deque([(x, y) for x in range(width) for y in (0, height - 1)])
    queue.extend((x, y) for y in range(height) for x in (0, width - 1))
    queue.append((width // 2, height // 2))
    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or not (0 <= x < width and 0 <= y < height):
            continue
        visited.add((x, y))
        red, green, blue, alpha = pixels[x, y]
        if alpha > 24 and not (min(red, green, blue) > 195 and max(red, green, blue) - min(red, green, blue) < 18):
            continue
        pixels[x, y] = (red, green, blue, 0)
        queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
    return image


def export(name, image, size, clean=False, trim=True):
    if clean:
        image = clear_background(image)
    alpha = image.getchannel("A").point(lambda value: 0 if value < 40 else value)
    image.putalpha(alpha)
    if trim:
        bounds = alpha.point(lambda value: 255 if value > 160 else 0).getbbox()
        if not bounds:
            raise ValueError(f"Empty sprite: {name}")
        image = image.crop(bounds)
    image.thumbnail(size, Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", size)
    canvas.paste(image, ((size[0] - image.width) // 2, (size[1] - image.height) // 2))
    canvas.save(OUTPUT / f"{name}.png", optimize=True)


def tile_frame(name, image, inset, tile=24):
    """Pack fixed corners and repeatable edges into a three-by-three tile atlas."""
    width, height = image.size
    x_slices = [(0, inset), ((width - tile) // 2, (width + tile) // 2), (width - inset, width)]
    y_slices = [(0, inset), ((height - tile) // 2, (height + tile) // 2), (height - inset, height)]
    atlas = Image.new("RGBA", (tile * 3, tile * 3))
    for row, (top, bottom) in enumerate(y_slices):
        for column, (left, right) in enumerate(x_slices):
            piece = image.crop((left, top, right, bottom))
            piece = piece.resize((tile, tile), Image.Resampling.NEAREST)
            atlas.paste(piece, (column * tile, row * tile))
    atlas.save(OUTPUT / f"{name}.png", optimize=True)


def build_tiles():
    panel = Image.open(OUTPUT / "panel-frame.png").convert("RGBA")
    tile_frame("panel-tiles", panel, 32)
    for name in ["nav-normal", "nav-selected", "nav-pressed", "action-normal", "action-hover", "action-pressed"]:
        image = Image.open(OUTPUT / f"{name}.png").convert("RGBA")
        tile_frame(f"{name}-tiles", image, 24)
    for name in ["wood", "parchment"]:
        image = Image.open(OUTPUT / f"{name}.png").convert("RGBA")
        image.crop((96, 96, 144, 144)).resize((24, 24), Image.Resampling.NEAREST).save(OUTPUT / f"{name}-tile.png")
    action = Image.open(OUTPUT / "action-normal.png")
    action.crop((136, 32, 184, 56)).resize((24, 24), Image.Resampling.NEAREST).save(OUTPUT / "green-tile.png")
    stone = Image.open(OUTPUT / "stone.png")
    stone.resize((96, 96), Image.Resampling.NEAREST).save(OUTPUT / "stone-tile.png")
    progress = Image.open(OUTPUT / "progress-frame.png").convert("RGBA")
    tile_frame("progress-tiles", progress, 16, tile=8)


def build_vendor_ui():
    """Extract CC0 components at native resolution; warm the paper palette."""
    vendor = ROOT / "assets" / "vendor"
    panels = Image.open(vendor / "parchment-gui" / "panels.png").convert("RGBA")
    # Original Arne16 yellow is vivid; substitute cream without changing pixel geometry.
    pixels = panels.load()
    for y in range(panels.height):
        for x in range(panels.width):
            red, green, blue, alpha = pixels[x, y]
            if red > 200 and green > 170 and blue < 150:
                pixels[x, y] = (247, 229, 185, alpha)
    panels.crop((48, 0, 96, 48)).save(OUTPUT / "cc0-panel.png")
    panels.crop((64, 16, 80, 32)).save(OUTPUT / "cc0-paper.png")
    wooden = Image.open(vendor / "wooden-gui" / "wooden-gui.png").convert("RGBA")
    # Blank rectangular buttons in the middle (brown) palette, normal and pressed.
    wooden.crop((416, 928, 512, 960)).save(OUTPUT / "cc0-button.png")
    wooden.crop((416, 976, 512, 1008)).save(OUTPUT / "cc0-button-pressed.png")
    wooden.crop((432, 936, 448, 952)).save(OUTPUT / "cc0-wood.png")


def build_warm_ui():
    """Slice varm.png into fixed 24px corners and edges; keep the original intact."""
    image = Image.open(OUTPUT / "varm.png").convert("RGBA")
    pixels = image.load()
    width, height = image.size
    queue = deque([(x, y) for x in range(width) for y in (0, height - 1)])
    queue.extend((x, y) for y in range(height) for x in (0, width - 1))
    visited = set()
    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or not (0 <= x < width and 0 <= y < height):
            continue
        visited.add((x, y))
        if max(pixels[x, y][:3]) > 35:
            continue
        pixels[x, y] = (0, 0, 0, 0)
        queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))

    inset = round(min(width, height) * .192)
    xs = [0, (width - inset) // 2, width - inset]
    ys = [0, (height - inset) // 2, height - inset]
    atlas = Image.new("RGBA", (72, 72))
    for row, top in enumerate(ys):
        for column, left in enumerate(xs):
            tile = image.crop((left, top, left + inset, top + inset))
            atlas.paste(tile.resize((24, 24), Image.Resampling.NEAREST), (column * 24, row * 24))
    atlas.save(OUTPUT / "warm-frame.png", optimize=True)
    # Mirror the paper patch at its boundaries to avoid hard seams when repeating.
    patch = image.crop((xs[1], ys[1], xs[1] + inset, ys[1] + inset))
    patch = patch.resize((48, 48), Image.Resampling.NEAREST)
    paper = Image.new("RGBA", (96, 96))
    paper.paste(patch, (0, 0))
    paper.paste(ImageOps.mirror(patch), (48, 0))
    paper.paste(ImageOps.flip(patch), (0, 48))
    paper.paste(ImageOps.flip(ImageOps.mirror(patch)), (48, 48))
    paper.save(OUTPUT / "warm-paper.png", optimize=True)


def build():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, prefix in [
        ("home", "Svenskt"), ("tools", "Korsad"), ("clipboard", "Pixlig"),
        ("plus", "Pixlad grön"), ("trash", "Pixlad rostig"), ("pencil", "Diagonal"),
    ]:
        export(name, source(prefix), (64, 64))

    for name, prefix in [
        ("stone", "Mossiga"), ("wood", "Sömlös pixelart"), ("parchment", "Sömlös pixlig"),
    ]:
        export(name, source(prefix), (256, 256), trim=False)

    frame = source("Pixelkonst_ Trä- och metallram")
    export("panel-frame", frame, (256, 256))
    landscape = source("Idylliskt")
    landscape.resize((1200, 400), Image.Resampling.NEAREST).save(OUTPUT / "landscape.png", optimize=True)

    navigation = source("Tre staplade")
    for name, box in [
        ("nav-normal", (.255, .012, .745, .325)),
        ("nav-selected", (.25, .34, .75, .658)),
        ("nav-pressed", (.25, .673, .75, .99)),
    ]:
        export(name, crop_fraction(navigation, box), (320, 68), clean=True)

    actions = source("Mossgrön")
    for name, brightness in [
        ("action-normal", 1), ("action-hover", 1.15), ("action-pressed", .85),
    ]:
        export(name, ImageEnhance.Brightness(actions).enhance(brightness), (320, 88), clean=True)

    controls = source("Pixellkonst")
    for name, box in [
        ("check-empty", (.18, .12, .34, .35)),
        ("check-done", (.42, .12, .58, .35)),
        ("check-focus", (.645, .09, .835, .38)),
        ("progress-frame", (.20, .46, .80, .67)),
        ("progress-fill", (.46, .78, .54, .90)),
    ]:
        size = (32, 32) if name.startswith("check") else (320, 64) if name.endswith("frame") else (16, 16)
        export(name, crop_fraction(controls, box), size, clean=True)

    categories = source("Pixelkonst_ trädgårdsikoner")
    for name, box in [
        ("leaves", (0, 0, .25, .49)), ("garden", (.25, 0, .50, .49)),
        ("gutter", (.50, 0, .75, .49)), ("crate", (.75, 0, 1, .49)),
        ("roller", (0, .50, .25, 1)), ("tree", (.25, .50, .50, 1)),
        ("paint", (.50, .50, .75, 1)), ("snow", (.75, .50, 1, 1)),
    ]:
        export(name, crop_fraction(categories, box), (64, 64), clean=True)

    decorations = source("Pixlade lyktor")
    for name, box, size in [
        ("lantern", (.02, .08, .17, .95), (64, 112)),
        ("ivy", (.355, .08, .625, .91), (120, 144)),
        ("ivy-strand", (.64, .10, .735, .98), (48, 160)),
        ("plant", (.78, .08, .98, .98), (80, 128)),
    ]:
        export(name, crop_fraction(decorations, box), size, clean=True)

    construction = source("Pixlad byggsats")
    export("beam", crop_fraction(construction, (.02, .035, .81, .23)), (512, 56), clean=True)
    export("bracket", crop_fraction(construction, (.41, .41, .58, .77)), (48, 64), clean=True)
    build_tiles()
    build_vendor_ui()
    build_warm_ui()
    print(f"Prepared {len(list(OUTPUT.glob('*.png')))} sprites in {OUTPUT}")


if __name__ == "__main__":
    build()
