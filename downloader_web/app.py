from __future__ import annotations

import datetime as dt
from pathlib import Path
from typing import Any, Dict, List

from flask import Flask, jsonify, render_template, request, send_file

from .config import config_manager
from .downloader import create_archive, download_bulk, download_single, extract_info


def create_app() -> Flask:
    app = Flask(__name__)

    @app.get("/")
    def index() -> str:
        return render_template("index.html", config=config_manager.to_dict())

    @app.post("/api/info")
    def api_info():
        payload = request.get_json(force=True, silent=True) or {}
        url = (payload.get("url") or "").strip()
        if not url:
            return jsonify({"ok": False, "error": "Please provide a URL."}), 400
        try:
            info = extract_info(url)
        except Exception as exc:  # pylint: disable=broad-except
            return jsonify({"ok": False, "error": f"Failed to fetch info: {exc}"}), 400

        def simplify_format(fmt: Dict[str, Any]) -> Dict[str, Any]:
            return {
                "format_id": fmt.get("format_id"),
                "ext": fmt.get("ext"),
                "filesize": fmt.get("filesize") or fmt.get("filesize_approx"),
                "resolution": fmt.get("resolution") or fmt.get("height"),
                "vcodec": fmt.get("vcodec"),
                "acodec": fmt.get("acodec"),
                "format_note": fmt.get("format_note"),
            }

        formats = info.get("formats") or []
        simplified = [simplify_format(fmt) for fmt in formats]

        response = {
            "ok": True,
            "info": {
                "title": info.get("title"),
                "description": info.get("description"),
                "uploader": info.get("uploader"),
                "duration": info.get("duration"),
                "thumbnails": info.get("thumbnails", []),
                "formats": simplified,
            },
        }
        return jsonify(response)

    @app.post("/api/download")
    def api_download():
        payload = request.get_json(force=True, silent=True) or {}
        url = (payload.get("url") or "").strip()
        if not url:
            return jsonify({"ok": False, "error": "Please provide a URL."}), 400

        target_dir = Path(payload.get("target_dir") or config_manager.download_dir)
        format_id = payload.get("format_id") or None
        audio_only = bool(payload.get("audio_only"))
        template = payload.get("output_template") or None

        result = download_single(
            url,
            target_dir,
            format_id=format_id,
            audio_only=audio_only,
            output_template=template,
        )

        if not result.success:
            return jsonify({"ok": False, "error": result.message}), 400

        files = [str(path) for path in result.files]
        return jsonify({"ok": True, "message": result.message, "files": files})

    @app.post("/api/bulk")
    def api_bulk():
        payload = request.form.to_dict()
        urls_raw = payload.get("urls", "")
        target_dir = Path(payload.get("target_dir") or config_manager.download_dir)
        format_id = payload.get("format_id") or None
        audio_only = payload.get("audio_only") == "true"
        template = payload.get("output_template") or None
        archive_requested = payload.get("archive") == "true"

        url_list: List[str] = []
        if urls_raw:
            url_list.extend(urls_raw.splitlines())

        if "file" in request.files:
            uploaded = request.files["file"]
            if uploaded and uploaded.filename:
                text = uploaded.read().decode("utf-8", errors="ignore")
                url_list.extend(text.splitlines())

        if not url_list:
            return jsonify({"ok": False, "error": "Provide at least one URL."}), 400

        results = download_bulk(
            url_list,
            target_dir,
            format_id=format_id,
            audio_only=audio_only,
            output_template=template,
        )

        files: List[str] = []
        errors: List[str] = []
        for res in results:
            if res.success:
                files.extend(str(path) for path in res.files)
            else:
                errors.append(res.message)

        archive_path = None
        if (archive_requested or config_manager.auto_archive_bulk) and files:
            timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
            archive_name = f"bulk-download-{timestamp}.zip"
            archive_path = target_dir / archive_name
            try:
                create_archive([Path(f) for f in files], archive_path)
            except Exception as exc:  # pylint: disable=broad-except
                errors.append(f"Archive creation failed: {exc}")
                archive_path = None

        response: Dict[str, Any] = {
            "ok": True,
            "files": files,
            "errors": errors,
        }
        if archive_path and archive_path.exists():
            response["archive"] = str(archive_path)
        if errors and not files:
            response["ok"] = False
        return jsonify(response)

    @app.get("/api/settings")
    def api_settings():
        return jsonify({"ok": True, "settings": config_manager.to_dict()})

    @app.post("/api/settings")
    def api_update_settings():
        payload = request.get_json(force=True, silent=True) or {}
        download_dir = payload.get("download_dir")
        auto_archive = payload.get("auto_archive_bulk")

        updated: Dict[str, Any] = {}
        if isinstance(download_dir, str) and download_dir.strip():
            path = config_manager.set_download_dir(download_dir)
            updated["download_dir"] = str(path)
        if auto_archive is not None:
            config_manager.set_auto_archive_bulk(bool(auto_archive))
            updated["auto_archive_bulk"] = config_manager.auto_archive_bulk

        return jsonify({"ok": True, "settings": {**config_manager.to_dict(), **updated}})

    @app.get("/files")
    def serve_file():
        file_path = request.args.get("path")
        if not file_path:
            return jsonify({"ok": False, "error": "Missing file path."}), 400
        path = Path(file_path).resolve()
        try:
            path.relative_to(config_manager.download_dir)
        except ValueError:
            return jsonify({"ok": False, "error": "File outside of download directory."}), 403
        if not path.exists() or not path.is_file():
            return jsonify({"ok": False, "error": "File not found."}), 404
        return send_file(path, as_attachment=True)

    return app


app = create_app()
