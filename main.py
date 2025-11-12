from __future__ import annotations

import argparse
import threading
import time
import webbrowser

from downloader_web.app import app
from downloader_web.config import config_manager


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Launch the downloader web interface.")
    parser.add_argument("--port", type=int, default=5000, help="Port to bind the web server to.")
    parser.add_argument("--host", default="127.0.0.1", help="Host/IP to bind the web server to.")
    parser.add_argument("--no-browser", action="store_true", help="Do not automatically open the browser.")
    return parser.parse_args()


def open_browser(host: str, port: int) -> None:
    time.sleep(1)
    url = f"http://{host}:{port}/"
    try:
        webbrowser.open(url)
    except webbrowser.Error:
        pass


def main() -> None:
    args = parse_args()
    config_manager.ensure_download_dir()
    if not args.no_browser:
        thread = threading.Thread(target=open_browser, args=(args.host, args.port), daemon=True)
        thread.start()

    app.run(host=args.host, port=args.port, debug=False)


if __name__ == "__main__":
    main()
