from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def extension_files(extension):
    file_types = {".css", ".html", ".js", ".json", ".png"}
    return sorted(path for path in extension.iterdir() if path.is_file() and path.suffix in file_types)


def main():
    root = Path(__file__).resolve().parents[1]
    extension = root / "extension"
    dist = root / "dist"
    dist.mkdir(exist_ok=True)
    archive = dist / "MultiTikTok-Chrome.zip"

    with ZipFile(archive, mode="w", compression=ZIP_DEFLATED) as package:
        for source in extension_files(extension):
            package.write(source, source.name)

    print(archive)


if __name__ == "__main__":
    main()
