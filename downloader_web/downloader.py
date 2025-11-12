from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional
import zipfile

from yt_dlp import DownloadError, YoutubeDL


@dataclass
class DownloadResult:
    success: bool
    message: str
    files: List[Path]


# ---------------------------------------------------------------------------
def _base_options(output_template: str, target_dir: Path) -> dict:
    return {
        "outtmpl": str(target_dir / output_template),
        "quiet": True,
        "no_warnings": True,
        "ignoreerrors": False,
        "noplaylist": False,
    }


# ---------------------------------------------------------------------------
def extract_info(url: str) -> dict:
    opts = {
        "quiet": True,
        "skip_download": True,
        "ignoreerrors": False,
        "no_warnings": True,
    }
    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    return info


# ---------------------------------------------------------------------------
def download_single(
    url: str,
    target_dir: Path,
    *,
    format_id: Optional[str] = None,
    audio_only: bool = False,
    output_template: Optional[str] = None,
) -> DownloadResult:
    target_dir.mkdir(parents=True, exist_ok=True)
    template = output_template or "%(title)s [%(id)s].%(ext)s"

    options = _base_options(template, target_dir)
    if format_id:
        options["format"] = format_id

    downloaded_files: List[Path] = []

    def _hook(status: dict) -> None:
        if status.get("status") == "finished":
            filename = status.get("filename")
            if filename:
                downloaded_files.append(Path(filename).resolve())

    options["progress_hooks"] = [_hook]

    if audio_only:
        options["format"] = options.get("format", "bestaudio/best")
        options.setdefault("postprocessors", []).append(
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        )

    try:
        with YoutubeDL(options) as ydl:
            ydl.download([url])
    except DownloadError as exc:
        return DownloadResult(False, str(exc), [])

    if not downloaded_files:
        return DownloadResult(False, "Nothing was downloaded.", [])

    return DownloadResult(True, "Download complete.", downloaded_files)


# ---------------------------------------------------------------------------
def download_bulk(
    urls: Iterable[str],
    target_dir: Path,
    *,
    format_id: Optional[str] = None,
    audio_only: bool = False,
    output_template: Optional[str] = None,
) -> List[DownloadResult]:
    clean_urls = [u.strip() for u in urls if u and u.strip()]
    results: List[DownloadResult] = []
    for url in clean_urls:
        result = download_single(
            url,
            target_dir,
            format_id=format_id,
            audio_only=audio_only,
            output_template=output_template,
        )
        results.append(result)
    return results


# ---------------------------------------------------------------------------
def create_archive(files: Iterable[Path], archive_path: Path) -> Path:
    archive_path.parent.mkdir(parents=True, exist_ok=True)
    files = [Path(file).resolve() for file in files if Path(file).exists()]
    if not files:
        raise FileNotFoundError("No files available to include in archive")

    with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for file in files:
            archive.write(file, arcname=file.name)
    return archive_path
