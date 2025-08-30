Accessible Sports (Large-Type, High-Contrast)

Overview
- A lightweight, ESPN-inspired sports viewer optimized for users with low vision.
- Features large, scalable text; high-contrast and dark themes; simple navigation; and optional read‑aloud.
- Live scores and headlines from ESPN’s public site API for NFL, MLB, and NCAA Football.

How to Run
- Serve the folder with a static server due to CORS/network: `python3 -m http.server` from this directory, then open `http://localhost:8000/`.
- On a phone or tablet, open the same URL on your LAN (e.g., `http://YOUR-IP:8000`).
- Direct `file://` opening may block network requests or Speech API on some browsers.

Key Features
- Text size controls (A− and A+), persisted across sessions.
- Theme selector: Light, Dark, High Contrast.
- Live data: NFL, MLB, NCAA Football (auto-refresh every 60s; manual Refresh button).
- Big tap targets (48px+), strong focus outlines, semantic HTML.
- Scores show all games; favorites don’t filter scores (they help personalize stories).
- Simplified views: Scores, Headlines (with images), Team Stories, My Teams.
- In‑app story reader: Tap Open to view articles in an overlay without leaving the app.
- Team Stories: A tab that highlights news mentioning your favorite teams (prefilled with Tampa Bay). Each card includes an Open link to the full story.

Install on Mobile (PWA)
- Android (Chrome): Open the app URL, tap the menu (⋮), then "Install app" or "Add to Home screen".
- iPhone/iPad (Safari): Tap Share, then "Add to Home Screen".
- The app caches itself for quick launches and limited offline support (scores/headlines require internet to update).

Notes
- This is a simplified, original app, not an ESPN clone.
- Data source: ESPN’s public site API endpoints (no API key required). If they change or rate-limit, refresh may fail temporarily.
- Currently supports NFL, MLB, and NCAA Football. Other sports can be added later.
