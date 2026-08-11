from pathlib import Path
import sys

from PIL import Image


def main() -> None:
    source = Path(sys.argv[1])
    icon_dir = Path(sys.argv[2])
    image = Image.open(source).convert("RGBA")

    pixels = []
    for red, green, blue, alpha in image.getdata():
        spread = max(red, green, blue) - min(red, green, blue)
        if alpha and spread <= 24 and max(red, green, blue) >= 38:
            light = max(red, green, blue) / 255
            red = round(42 + 93 * light)
            green = round(92 + 125 * light)
            blue = round(142 + 113 * light)
        pixels.append((red, green, blue, alpha))
    image.putdata(pixels)

    canonical = image.resize((512, 512), Image.Resampling.LANCZOS)
    canonical.save(icon_dir / "icon.png")
    canonical.save(icon_dir / "icon-blue-outline-v2.png")

    for filename, size in {
        "32x32.png": 32,
        "64x64.png": 64,
        "128x128.png": 128,
        "128x128@2x.png": 256,
    }.items():
        canonical.resize((size, size), Image.Resampling.LANCZOS).save(icon_dir / filename)

    frames = [
        canonical.resize((size, size), Image.Resampling.LANCZOS)
        for size in (16, 24, 32, 48, 64, 128, 256)
    ]
    frames[-1].save(
        icon_dir / "icon.ico",
        format="ICO",
        append_images=frames[:-1],
        sizes=[(size, size) for size in (16, 24, 32, 48, 64, 128, 256)],
    )
    frames[-1].save(
        icon_dir / "icon-blue-outline-unified-v3.ico",
        format="ICO",
        append_images=frames[:-1],
        sizes=[(size, size) for size in (16, 24, 32, 48, 64, 128, 256)],
    )


if __name__ == "__main__":
    main()
