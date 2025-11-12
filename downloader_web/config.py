from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict


class ConfigManager:
    """Simple configuration helper persisted to a JSON file."""

    DEFAULTS: Dict[str, Any] = {
        "download_dir": str(Path.home() / "downloader_web_downloads"),
        "auto_archive_bulk": False,
    }

    def __init__(self, config_path: Path | None = None) -> None:
        base_path = Path(config_path) if config_path else Path.home() / ".downloader_web_config.json"
        self._config_path = base_path
        self._config: Dict[str, Any] = {}
        self._load()
        self.ensure_download_dir()

    # ------------------------------------------------------------------
    def _load(self) -> None:
        if self._config_path.exists():
            try:
                with self._config_path.open("r", encoding="utf-8") as fh:
                    data = json.load(fh)
                if isinstance(data, dict):
                    self._config = {**self.DEFAULTS, **data}
                else:
                    self._config = dict(self.DEFAULTS)
            except (json.JSONDecodeError, OSError):
                self._config = dict(self.DEFAULTS)
        else:
            self._config = dict(self.DEFAULTS)
            self.save()

    # ------------------------------------------------------------------
    def ensure_download_dir(self) -> Path:
        path = self.download_dir
        path.mkdir(parents=True, exist_ok=True)
        return path

    # ------------------------------------------------------------------
    def save(self) -> None:
        try:
            with self._config_path.open("w", encoding="utf-8") as fh:
                json.dump(self._config, fh, indent=2)
        except OSError:
            # We do not want the app to crash if saving fails.
            pass

    # ------------------------------------------------------------------
    @property
    def download_dir(self) -> Path:
        return Path(self._config.get("download_dir", self.DEFAULTS["download_dir"])).expanduser().resolve()

    def set_download_dir(self, directory: str) -> Path:
        path = Path(directory).expanduser().resolve()
        path.mkdir(parents=True, exist_ok=True)
        self._config["download_dir"] = str(path)
        self.save()
        return path

    # ------------------------------------------------------------------
    @property
    def auto_archive_bulk(self) -> bool:
        return bool(self._config.get("auto_archive_bulk", False))

    def set_auto_archive_bulk(self, enabled: bool) -> None:
        self._config["auto_archive_bulk"] = bool(enabled)
        self.save()

    # ------------------------------------------------------------------
    def to_dict(self) -> Dict[str, Any]:
        return {
            "download_dir": str(self.download_dir),
            "auto_archive_bulk": self.auto_archive_bulk,
        }


config_manager = ConfigManager()
