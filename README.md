# Tokyo Downloader (browser extension)

Bulk-download anime episodes from [TokyoInsider](https://www.tokyoinsider.com), which has no bulk download of its own. Pick an anime, type an episode range such as `1-5`, and the extension reads each episode page and downloads the files through **your own browser session**.

> Based on [MaJoRX0/Tokyo-Downloader](https://github.com/MaJoRX0/Tokyo-Downloader). This is an unofficial, independent adaptation and is not affiliated with or endorsed by the original author or by TokyoInsider.

## Features
- Load an anime page, choose episodes by real number: `1-5`, `1,3,7-10`, or `all`
- Types: episodes, OVAs, specials, movies
- Pick the largest, smallest or most-downloaded file for each episode
- Pipelined queue: the next episode is read as soon as the previous download starts (1–5 at once, default 3)
- Auto-retry, "skip failed and continue", pause, resume, cancel and retry with a fresh link
- File name template with zero-padded numbers: `episode 06 - name.mkv` (fields `{title} {type} {number} {name} {size} {uploader} {date}`)
- Handles both `episode/6` and `episode/06` page forms and site redirects
- Queue survives closing and reopening the dashboard
- No server, no Python, no bookmarklet, no external libraries; talks only to tokyoinsider.com

## Install
Quick version: download the zip from **Releases**, unzip it, then in Chrome open `chrome://extensions` → Developer mode → **Load unpacked** → select the folder containing `manifest.json`. Works on Mac and Windows (Chrome, Edge, Brave). Full steps: [INSTALL.md](INSTALL.md).

## How it works
The site sits behind Cloudflare and hides each file link inside an encoded page element whose decoding key changes on every page load. Instead of fighting that from outside, the extension uses a background tab in your browser: it reads the episode page, decodes the link with the key from *that* page, and hands the URL to Chrome's download manager. Cookies, IP address and expiring tokens all match because it is the same browser. It does **not** solve or bypass Cloudflare challenges: if the site asks you to verify, you do it yourself in the reader tab.

Permissions: `downloads`, `storage`, `scripting`, and host access to `*.tokyoinsider.com` only. Nothing is sent anywhere else.

## Limits
- Chrome-family browsers only (Manifest V3). It is not a NAS/server service; move finished files yourself.
- Keep the dashboard tab open while the queue runs.
- Links expire, so files are read right before each download.
- If the site changes its page layout the parser may need updating.

## Development
```bash
node --test extension/test.cjs       # 12 offline tests
scripts/build-zip.sh                 # builds dist/Tokyo-Downloader-Extension-<version>.zip
```
Layout: `extension/` (manifest, dashboard, `parser.js`, `utils.js`, icons), `scripts/`, `INSTALL.md`.

## Responsible use
For personal use of files you are entitled to download. Respect TokyoInsider's terms and the rights of content owners.

## Credits and licence
Original project © 2025 MaJoRX0. This adaptation (browser extension, download queue, strict per-page key handling, tests, icons) is released under the same licence: [Creative Commons Attribution-NonCommercial 4.0 International](LICENSE). **Non-commercial use only**; keep the attribution.
