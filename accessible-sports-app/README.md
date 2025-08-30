# Accessible Sports — Large‑Type, High‑Contrast Sports Viewer

A lightweight, ESPN‑inspired web app focused on **low‑vision accessibility**. It surfaces live scores and headlines in **huge, adjustable type**, with **high‑contrast themes**, simple navigation, keyboard support, and an **offline‑capable** app shell (PWA).

> This project was generated with the help of Codex and then refined. It uses only static assets (HTML/CSS/JS) and fetches public data from ESPN’s site APIs at runtime—no server code is required beyond any basic static file host.

---

## ✨ Features

- **Big, scalable text** with A− / A+ controls (persisted in `localStorage`).
- **Themes**: Light, Dark, and High‑Contrast.
- **Live scores & headlines** for NFL, MLB, and NCAA Football (CFB) via ESPN site APIs.
- **Tabbed UI**: Scores, Headlines, Team Stories, and My Teams.
- **Favorites**: Mark teams; favorites are prioritized in the Scores view.
- **In‑app article viewer**: Opens stories in an accessible overlay with basic HTML sanitization.
- **PWA**: Service worker caches the app shell for fast loads and limited offline use.
- **Keyboard & screen‑reader friendly**: ARIA roles for tabs and live regions, skip‑link, focus management.

> **Note:** The current build intentionally **does not include read‑aloud** (Web Speech API) — the code comments indicate it was removed for reliability. If you want it back, see the “Optional Enhancements” section below.

---

## 🗂 Project Structure

```
accessible-sports-app/
├─ index.html
├─ styles.css
├─ app.js
├─ manifest.webmanifest
├─ sw.js
└─ README.md  (original minimal notes)
```

- **`index.html`** – Core markup and tab panels (Scores, Headlines, Team Stories, My Teams).
- **`styles.css`** – Theme variables, large‑type defaults, high‑contrast scheme, layout.
- **`app.js`** – App logic, state, fetch to ESPN APIs, rendering, favorites, article overlay, PWA registration.
- **`manifest.webmanifest`** – PWA metadata (name, colors, start URL).
- **`sw.js`** – Service worker (app‑shell caching + simple runtime caching for same‑origin and CDN assets).

---

## 🚀 Quick Start (Local)

Because browsers restrict network access from `file://` and some APIs require HTTPS or an actual origin, **serve the folder with a static server**.

### Option A — Python 3 (built‑in, easiest)
```bash
# from the folder that *contains* accessible-sports-app/
cd accessible-sports-app
python3 -m http.server 8000
# now open: http://localhost:8000/
```

### Option B — Node http‑server (if you prefer Node)
```bash
npm i -g http-server
cd accessible-sports-app
http-server -p 8000
# open: http://localhost:8000/
```

### Use on your phone/tablet
Find your computer’s LAN IP, then open e.g. `http://192.168.1.50:8000` on your phone (both devices on the same network).

---

## ⚙️ Configuration & Notes

### Data sources
`app.js` reads from ESPN’s public site APIs:
- NFL scoreboard/news  
- MLB scoreboard/news  
- NCAA Football scoreboard/news  

Endpoints are defined in `ENDPOINTS` at the top of `app.js`. **These are unofficial, may change or rate‑limit**, and should be used in accordance with ESPN’s site terms. Treat this as a personal demo / educational project.

### Favorites
Favorites are stored in `localStorage` under `a11y_favorites`. The initial build seeds a default favorite of **“TB” (Tampa Bay)** if none exist. You can change or remove this default in `app.js` (search for `Prefill favorites with Tampa Bay`).

### Themes & Scale
- The selected theme is stored under `a11y_theme`.
- The text scale is stored under `a11y_scale`. The UI constrains it between `1.0` and `2.0` in 0.05 steps.

### PWA / Offline
- The **service worker** (`sw.js`) pre‑caches the app shell and does opportunistic caching for CDN/same‑origin resources.
- Click the **“Update App”** button in the header to flush caches and re‑register the SW when shipping updates.
- Offline is limited: live data still requires a network connection.

### Accessibility choices
- **Skip‑link** to main content.
- **ARIA**: `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, etc.
- **Live regions** for dynamic lists.
- **Overlay dialog** with `aria-modal` and focus trapping/restore.
- **High‑contrast** theme tuned for legibility.

---

## 🧩 Known Limitations

- **Unofficial APIs**: ESPN endpoints can change or block frequent requests. If you see errors, try again later or add a server‑side proxy with caching and rate‑limits.
- **Article bodies**: The app requests story bodies when available and lightly sanitizes allowed tags. Some articles may only show summary/metadata.
- **iOS/PWA quirks**: Safari iOS limits some PWA behaviors (e.g., cache size, background fetch). Features vary by OS and browser.
- **No Text‑to‑Speech**: Read‑aloud was removed in this version for stability; see the enhancement ideas below.

---

## 🛠 Optional Enhancements (Ideas)

- **Re‑enable Read‑Aloud** via the Web Speech API:
  - Add a “Read” button on headlines/articles.
  - Use `speechSynthesis.speak(new SpeechSynthesisUtterance(text))` with pause/stop.
  - Provide a voice selector and respect prefers‑reduced‑motion/sound.
- **Leagues & Sports**: Extend `ENDPOINTS` to NHL, NBA, WNBA, soccer, etc.
- **Team Logos**: Add lazy‑loaded team logos with accessible alt text.
- **Server‑side proxy/cache**: For stability, proxy ESPN calls and add ETags + stale‑while‑revalidate.
- **Installable icons**: Add icons to `manifest.webmanifest` for a better homescreen experience.
- **Analytics (privacy‑friendly)**: If desired, instrument with a local, anonymized analytics solution.

---

## 🔒 Privacy

- No accounts, no tracking, no analytics by default.
- Only uses `localStorage` for UI preferences (scale, theme) and favorites.
- All data requests go directly from the browser to ESPN’s public site APIs.

---

## 🧪 Browser Support

Modern Chromium browsers (Chrome/Edge), Firefox, and recent Safari should work. PWA behaviors and speech features (if you add them) vary by platform.

---

## 📜 License / Attribution

If you intend to publish this, choose a license that matches your goals (MIT/Apache‑2.0/Proprietary).  
**Copyright © 2025 Angel Lebron.**

---

## 🙌 Credits

- **Angel / Codex** for the initial build and concept.
- ESPN’s publicly accessible site APIs for data (unofficial; subject to change).
