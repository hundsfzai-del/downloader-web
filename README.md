# Downloader Web

Downloader Web is a Flask-based control center for [`yt-dlp`](https://github.com/yt-dlp/yt-dlp). Launch the Python application and it spins up a local web interface where you can:

- Inspect the available formats for a single URL and download the exact stream you need (video, audio, or converted MP3).
- Paste a list of URLs or upload a `.txt` file to run bulk downloads.
- Optionally bundle the results into a ZIP archive for quick retrieval.
- Configure the default download directory and whether bulk downloads should automatically be archived.

The app is designed so it can later be frozen into an executable. For now you can run it with Python and the dependencies listed below.

## Getting started

1. Create a virtual environment (recommended) and install the dependencies:

   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. Launch the web UI:

   ```bash
   python main.py
   ```

   The server starts on `http://127.0.0.1:5000/` and automatically opens your default browser. Use `--no-browser` to suppress auto launch or `--port`/`--host` to customise the binding.

## Features

### Single download

- Paste a URL and click **Check available formats** to fetch metadata and the list of available streams.
- Pick a specific format from the dropdown or keep the default "Auto (best)".
- Toggle **Convert to MP3 (audio only)** to extract audio with FFmpeg (bundled with `yt-dlp`).
- Provide a custom output template (defaults to `%(title)s [%(id)s].%(ext)s`).
- Choose the destination folder (defaults to your Downloads directory, which you can override in settings).
- Scan the condensed format table with quick filters (recommended/video/audio) and live search to jump to the stream you need.
- After a download finishes, toast notifications, an activity sidebar, and inline links make it easy to grab the files immediately.

### Bulk download

- Paste multiple URLs (one per line) or upload a text file containing the links.
- Reuse the same format selector and audio-only toggle as in the single form.
- Automatically zip the results with the **Create ZIP archive** option (or enable auto-archive in settings).
- Watch for warnings or errors after the run—successful downloads still produce their own links even if some URLs fail.

### Settings

- Change the default download directory; the server ensures the folder exists.
- Toggle automatic archiving for bulk downloads.
- Settings persist to a JSON file under your home directory (`~/.downloader_web_config.json`).

## Building an executable later

Once you're happy with the workflow you can convert the project into a standalone executable with a tool such as `pyinstaller`:

```bash
pyinstaller --name downloader --onefile main.py
```

Place the resulting binary on your `PATH` so you can run `downloader` from the command line. The executable will behave like the Python script: start the server, open the browser, and remember your settings.

## Notes

- Downloads are stored in the configured directory (default: `~/downloader_web_downloads`).
- The `/files` endpoint only serves files from that directory for safety.
- `yt-dlp` relies on FFmpeg for format conversions; make sure it is installed and accessible on your system path if you plan to convert or merge media.
