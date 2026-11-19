import argparse
import json
import os
import re
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zipfile import BadZipFile, ZipFile

from build import extension_files


ORIGIN = "https://chromewebstore.googleapis.com"


def verify_package(package, tag, source):
    version = json.loads((source / "manifest.json").read_text(encoding="utf-8"))["version"]
    if tag != f"v{version}":
        raise ValueError(f"La etiqueta {tag} no coincide con la versión {version} del manifiesto.")

    expected = {path.name: path for path in extension_files(source)}
    with ZipFile(package) as archive:
        names = archive.namelist()
        if sorted(names) != sorted(expected):
            raise ValueError("El ZIP debe contener exactamente los archivos de la extensión de la etiqueta.")
        for name in names:
            if archive.read(name) != expected[name].read_bytes():
                raise ValueError(f"El archivo {name} del ZIP no coincide con la etiqueta.")
    print(f"Paquete {tag} verificado.")
    return version


def call(token, resource, operation, body=None, content_type=None, upload=False):
    url = f"{ORIGIN}{'/upload' if upload else ''}/v2/{resource}:{operation}"
    headers = {"Authorization": f"Bearer {token}"}
    if content_type:
        headers["Content-Type"] = content_type
    request = Request(url, data=body, headers=headers)
    try:
        with urlopen(request, timeout=30) as response:
            return json.load(response)
    except HTTPError as error:
        try:
            detail = json.loads(error.read()).get("error", {}).get("message", error.reason)
        except ValueError:
            detail = error.reason
        raise RuntimeError(f"Chrome Web Store rechazó {operation} (HTTP {error.code}): {detail}") from None
    except URLError as error:
        raise RuntimeError(f"Error de conexión en {operation}: {error.reason}") from None


def comparable(version):
    parts = tuple(int(part) for part in version.split("."))
    return parts + (0,) * (4 - len(parts))


def submit(package, version):
    token = os.environ.get("CWS_TOKEN")
    publisher = os.environ.get("CWS_PUBLISHER_ID", "")
    item = os.environ.get("CWS_ITEM_ID", "")
    if not token or not re.fullmatch(r"[A-Za-z0-9_-]+", publisher) or not re.fullmatch(r"[a-p]{32}", item):
        raise ValueError("Falta la configuración válida de Chrome Web Store.")
    resource = f"publishers/{publisher}/items/{item}"

    status = call(token, resource, "fetchStatus")
    revisions = [status.get("publishedItemRevisionStatus", {}), status.get("submittedItemRevisionStatus", {})]
    for revision in revisions:
        for channel in revision.get("distributionChannels", []):
            if channel.get("crxVersion") and comparable(channel["crxVersion"]) >= comparable(version) and (
                revision.get("state") in {"PUBLISHED", "PUBLISHED_TO_TESTERS", "PENDING_REVIEW", "STAGED"}
            ):
                print(f"La tienda ya tiene la versión {channel['crxVersion']} publicada o en revisión.")
                return
    if revisions[1].get("state") in {"PENDING_REVIEW", "STAGED"}:
        raise RuntimeError("Hay una versión pendiente en Chrome Web Store. Completa su revisión y vuelve a ejecutar el envío.")

    uploaded = call(token, resource, "upload", package.read_bytes(), "application/zip", upload=True)
    upload_state = uploaded.get("uploadState")
    if uploaded.get("crxVersion") not in {None, version}:
        raise RuntimeError("La versión que informó Chrome Web Store no coincide con el ZIP.")
    for _ in range(12):
        if upload_state not in {"IN_PROGRESS", "UPLOAD_IN_PROGRESS"}:
            break
        time.sleep(5)
        upload_state = call(token, resource, "fetchStatus").get("lastAsyncUploadState")
    if upload_state not in {"SUCCEEDED", "UPLOAD_SUCCEEDED"}:
        raise RuntimeError(f"La subida a Chrome Web Store no terminó correctamente: {upload_state}.")

    request = json.dumps({"publishType": "DEFAULT_PUBLISH"}).encode()
    submission = call(token, resource, "publish", request, "application/json")
    if submission.get("state") not in {"PENDING_REVIEW", "PUBLISHED", "PUBLISHED_TO_TESTERS"}:
        raise RuntimeError(f"Estado inesperado de la solicitud: {submission.get('state')}.")
    print(f"Versión {version} enviada. Estado en Chrome Web Store: {submission['state']}.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("package", type=Path)
    parser.add_argument("tag")
    parser.add_argument("source", type=Path)
    parser.add_argument("--submit", action="store_true")
    args = parser.parse_args()
    try:
        version = verify_package(args.package, args.tag, args.source)
        if args.submit:
            submit(args.package, version)
    except (OSError, RuntimeError, ValueError, BadZipFile) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
