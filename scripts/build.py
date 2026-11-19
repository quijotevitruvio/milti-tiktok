from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def main():
    root = Path(__file__).resolve().parents[1]
    extension = root / "extension"
    dist = root / "dist"
    dist.mkdir(exist_ok=True)
    archive = dist / "MultiTikTok-Chrome.zip"

    with ZipFile(archive, mode="w", compression=ZIP_DEFLATED) as package:
        for source in sorted(extension.iterdir()):
            if source.is_file() and source.suffix in {".css", ".html", ".js", ".json", ".png"}:
                package.write(source, source.name)

    print(archive)


if __name__ == "__main__":
    main()
