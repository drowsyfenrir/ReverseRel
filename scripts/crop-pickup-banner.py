from pathlib import Path
import sys

from PIL import Image, ImageChops


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: crop-pickup-banner.py INPUT OUTPUT")
        return 1

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    image = Image.open(input_path).convert("RGB")
    background = Image.new("RGB", image.size, (255, 255, 255))
    difference = ImageChops.difference(image, background)
    bounds = difference.getbbox()
    if not bounds or bounds[3] < 120:
        print("Rendered pickup banner is empty.")
        return 1

    bottom = min(image.height, bounds[3] + 1)
    cropped = image.crop((0, 0, image.width, bottom))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(output_path, "PNG", optimize=True)
    print(f"Saved {output_path} ({cropped.width}x{cropped.height})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
