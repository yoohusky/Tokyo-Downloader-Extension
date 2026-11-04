# Installing Tokyo Downloader (Chrome, Edge, Brave — Mac and Windows)

1. Download `Tokyo-Downloader-Extension-<version>.zip` from the project's Releases page (or build it with `scripts/build-zip.sh`).
2. **Unzip it** into a folder you will keep (Windows: right-click → Extract All). Chrome reads the extension from this folder, so don't delete or move it afterwards.
3. Open `chrome://extensions` (Edge: `edge://extensions`).
4. Turn on **Developer mode** (top right).
5. Click **Load unpacked** and select the unzipped folder — the one that directly contains `manifest.json`.
6. Pin the red **TD** icon if you like, and click it to open the dashboard.

## First use
1. Sign in to TokyoInsider in the same browser profile if you have an account.
2. Paste an anime page URL (e.g. `https://www.tokyoinsider.com/anime/C/Chainsaw_Man_(TV)`) and click **Load episodes**.
3. Enter an episode range (`1-5`, `1,3,7-10` or `all`), choose the file rule, **Add to queue**, then **Start / resume**.
4. Check the first file plays before queueing a whole series.

Files are saved in your browser's Downloads folder under `Tokyo Downloader/<anime title>/`.

## Updating
Unzip the new version over the old folder (same location), then click the reload icon on the extension at `chrome://extensions`.

## Troubleshooting
- **"Manifest file is missing"** — you selected the wrong folder; select the one containing `manifest.json`.
- **Verification / "Just a moment"** — click **Show reader tab**, complete the site's check yourself, then **Retry failed**.
- **Windows long paths** — very long titles can exceed Windows' path limit; use a shorter file name template.
- On a managed work/school computer an administrator may block unpacked extensions.
