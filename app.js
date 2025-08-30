(() => {
  const APP_VERSION = '0.6.1';
  // Public URL for sharing/QR when running locally
  const PUBLIC_APP_URL = 'https://visionsofchaos.github.io/Sports-App/';
  const state = {
    scale: parseFloat(localStorage.getItem('a11y_scale')) || 1.25,
    theme: localStorage.getItem('a11y_theme') || 'light',
    readAloud: false,
    favorites: JSON.parse(localStorage.getItem('a11y_favorites') || '[]'),
    activeTab: 'scores',
    voicesReady: false,
    data: { scores: [], headlines: [], teams: [] },
    lastUpdated: null,
    timer: null,
    deferredInstall: null,
  };

  const ENDPOINTS = {
    nfl: {
      scoreboard: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
      news: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=10'
    },
    mlb: {
      scoreboard: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
      news: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?limit=10'
    },
    cfb: {
      scoreboard: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
      news: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/news?limit=10'
    }
  };

  // DOM elements
  const el = {
    decreaseText: document.getElementById('decreaseText'),
    increaseText: document.getElementById('increaseText'),
    themeSelect: document.getElementById('themeSelect'),
    refresh: document.getElementById('refreshData'),
    updateApp: document.getElementById('updateApp'),
    installApp: document.getElementById('installApp'),
    shareMobile: document.getElementById('shareMobile'),
    qrSection: document.getElementById('qrSection'),
    qrImg: document.getElementById('qrImg'),
    shareUrl: document.getElementById('shareUrl'),
    copyLink: document.getElementById('copyLink'),
    closeQR: document.getElementById('closeQR'),
    lastUpdated: document.getElementById('lastUpdated'),
    overlay: document.getElementById('articleOverlay'),
    closeArticle: document.getElementById('closeArticle'),
    articleTitle: document.getElementById('articleTitle'),
    articleMeta: document.getElementById('articleMeta'),
    articleImage: document.getElementById('articleImage'),
    articleBody: document.getElementById('articleBody'),
    tabs: {
      scores: document.getElementById('tab-scores'),
      headlines: document.getElementById('tab-headlines'),
      stories: document.getElementById('tab-stories'),
      myteams: document.getElementById('tab-myteams'),
    },
    panels: {
      scores: document.getElementById('panel-scores'),
      headlines: document.getElementById('panel-headlines'),
      stories: document.getElementById('panel-stories'),
      myteams: document.getElementById('panel-myteams'),
    },
    lists: {
      scores: document.getElementById('scoresList'),
      headlines: document.getElementById('headlinesList'),
      stories: document.getElementById('storiesList'),
      teams: document.getElementById('teamsList'),
    }
  };

  // Apply initial settings
  function applyScale() {
    document.documentElement.style.setProperty('--scale', String(state.scale));
    localStorage.setItem('a11y_scale', String(state.scale));
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    el.themeSelect.value = state.theme;
    localStorage.setItem('a11y_theme', state.theme);
  }

  // Read-aloud removed

  async function fetchJSON(url) {
    const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function parseScoreboardLeagueTag(tag) {
    switch (tag) {
      case 'nfl': return 'NFL';
      case 'mlb': return 'MLB';
      case 'cfb': return 'NCAA Football';
      default: return tag.toUpperCase();
    }
  }

  function mapScoreboardEvent(ev, leagueTag) {
    const comp = ev.competitions && ev.competitions[0];
    const status = (comp && comp.status && comp.status.type) || (ev.status && ev.status.type) || {};
    const shortStatus = status.shortDetail || status.detail || status.description || 'TBD';
    const stateStr = status.state || 'pre';
    const competitors = comp && comp.competitors ? comp.competitors : [];
    const home = competitors.find(c => c.homeAway === 'home') || competitors[0] || {};
    const away = competitors.find(c => c.homeAway === 'away') || competitors[1] || {};
    const toTeam = (c) => ({
      name: c.team && (c.team.displayName || c.team.shortDisplayName) || 'TBD',
      abbr: c.team && c.team.abbreviation || 'N/A',
      score: (c.score != null ? String(c.score) : '0'),
      logo: c.team && (c.team.logo || (c.team.logos && c.team.logos[0] && c.team.logos[0].href)) || ''
    });
    return {
      id: ev.id,
      league: parseScoreboardLeagueTag(leagueTag),
      status: shortStatus,
      state: stateStr, // pre | in | post
      startTime: ev.date,
      home: toTeam(home),
      away: toTeam(away),
    };
  }

  async function loadScores() {
    const leagues = ['nfl', 'mlb', 'cfb'];
    const all = [];
    const teamSet = new Map(); // key: abbr|league, val: {id, name, league}
    for (const lg of leagues) {
      try {
        // Use EST timezone explicitly for date window
        const now = new Date();
        const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const yyyymmdd = `${est.getFullYear()}${String(est.getMonth()+1).padStart(2,'0')}${String(est.getDate()).padStart(2,'0')}`;
        const base = ENDPOINTS[lg].scoreboard;
        const params = new URLSearchParams();
        params.set('dates', yyyymmdd);
        params.set('limit', '300');
        params.set('tz', 'America/New_York');
        if (lg === 'cfb') params.set('groups', '80');
        params.set('_', String(Date.now()));
        let url = `${base}?${params.toString()}`;
        let data = await fetchJSON(url);
        // Fallback: try FCS if FBS empty
        if (lg === 'cfb' && (!data || !Array.isArray(data.events) || data.events.length === 0)) {
          params.set('groups', '81');
          url = `${base}?${params.toString()}`;
          data = await fetchJSON(url);
        }
        // Fallback: try without explicit date if still empty
        if (!data || !Array.isArray(data.events) || data.events.length === 0) {
          const p2 = new URLSearchParams();
          p2.set('limit', '300');
          p2.set('tz', 'America/New_York');
          if (lg === 'cfb') p2.set('groups', '80');
          url = `${base}?${p2.toString()}`;
          data = await fetchJSON(url);
          if (lg === 'cfb' && (!data || !Array.isArray(data.events) || data.events.length === 0)) {
            p2.set('groups', '81');
            url = `${base}?${p2.toString()}`;
            data = await fetchJSON(url);
          }
        }
        const events = (data && data.events) || [];
        for (const ev of events) {
          const mapped = mapScoreboardEvent(ev, lg);
          all.push(mapped);
          // collect teams
          for (const t of [mapped.home, mapped.away]) {
            const key = `${t.abbr}|${mapped.league}`;
            if (!teamSet.has(key)) {
              teamSet.set(key, { id: t.abbr, name: t.name, league: mapped.league });
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load', lg, e);
      }
    }

    // Sort: live first, then upcoming, then finals. Within, by league then time.
    const rank = { in: 0, pre: 1, post: 2 };
    all.sort((a, b) => (rank[a.state] - rank[b.state]) || a.league.localeCompare(b.league) || String(a.startTime).localeCompare(String(b.startTime)));

    state.data.scores = all;
    state.data.teams = Array.from(teamSet.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async function loadHeadlines() {
    const leagues = ['nfl', 'mlb', 'cfb'];
    const items = [];
    for (const lg of leagues) {
      try {
        const data = await fetchJSON(ENDPOINTS[lg].news + `&_=${Date.now()}`);
        const arts = (data && data.articles) || [];
        for (const a of arts) {
          const web = (a.links && a.links.web && a.links.web.href) || a.link || '';
          const api = (a.links && a.links.api && (a.links.api.news && a.links.api.news.href) || a.links.api && a.links.api.self && a.links.api.self.href) || '';
          items.push({
            id: (a.guid || a.id || ((a.headline || '') + (a.published || ''))),
            title: a.headline || 'Headline',
            summary: (a.description || '').trim(),
            league: parseScoreboardLeagueTag(lg),
            published: a.published || '',
            url: web,
            apiUrl: api,
            image: (a.images && a.images[0] && (a.images[0].url || a.images[0].href)) || '',
            imageAlt: (a.images && a.images[0] && (a.images[0].name || a.images[0].caption)) || '',
            byline: a.byline || ''
          });
        }
      } catch (e) {
        console.warn('Failed to load news', lg, e);
      }
    }
    // Dedupe by canonical fields: apiUrl, then url, then guid/id, then normalized title
    const seen = new Map();
    for (const it of items) {
      const key = it.apiUrl || it.url || it.id || (it.title || '').toLowerCase().trim();
      if (!seen.has(key)) {
        seen.set(key, it);
      } else {
        const existing = seen.get(key);
        if (existing.league && it.league && !existing.league.includes(it.league)) {
          existing.league = `${existing.league}, ${it.league}`;
        }
        // Prefer image if existing lacks one
        if (!existing.image && it.image) existing.image = it.image;
        if (!existing.imageAlt && it.imageAlt) existing.imageAlt = it.imageAlt;
        // Prefer longer summary
        if ((it.summary || '').length > (existing.summary || '').length) existing.summary = it.summary;
      }
    }
    const deduped = Array.from(seen.values());
    deduped.sort((a, b) => String(b.published).localeCompare(String(a.published)));
    state.data.headlines = deduped.slice(0, 20);
  }

  async function refreshData() {
    const started = Date.now();
    try {
      await Promise.all([loadScores(), loadHeadlines()]);
      state.lastUpdated = new Date();
      el.lastUpdated.textContent = `v${APP_VERSION} • Updated ${state.lastUpdated.toLocaleTimeString()}`;
      renderScores();
      renderHeadlines();
      renderStories();
      renderTeams();
      localStorage.setItem('a11y_data_backup', JSON.stringify({ ts: Date.now(), data: state.data }));
    } catch (e) {
      console.error('Refresh failed', e);
      el.lastUpdated.textContent = `v${APP_VERSION} • Update failed. Check connection.`;
    } finally {
      // ensure minimum delay for UX if needed
      const elapsed = Date.now() - started;
      if (elapsed < 300) await new Promise(r => setTimeout(r, 300 - elapsed));
    }
  }

  // Render functions
  function renderScores() {
    const list = el.lists.scores;
    list.innerHTML = '';
    const items = state.data.scores.slice();
    const filtered = items;

    for (const g of filtered) {
      const card = document.createElement('article');
      card.className = 'card';
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', `${g.league} ${g.status}. ${g.away.name} ${g.away.score}, ${g.home.name} ${g.home.score}`);
      card.innerHTML = `
        <div class="meta">${g.league} • ${g.status}</div>
        <div class="team">
          <div class="team-name">${g.away.name}</div>
          <div class="spacer"></div>
          <div class="score">${g.away.score}</div>
        </div>
        <div class="team">
          <div class="team-name">${g.home.name}</div>
          <div class="spacer"></div>
          <div class="score">${g.home.score}</div>
        </div>
      `;
      list.appendChild(card);
    }

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'hint';
      empty.textContent = 'No games scheduled right now.';
      list.appendChild(empty);
    }
  }

  function renderHeadlines() {
    const list = el.lists.headlines;
    list.innerHTML = '';
    for (const h of state.data.headlines) {
      const card = document.createElement('article');
      card.className = 'card clickable';
      const titleId = `head-${h.id}`;
      card.setAttribute('aria-labelledby', titleId);
      const imgHtml = h.image ? `<img class="thumb" src="${h.image}" alt="${(h.imageAlt || '').replace(/"/g,'&quot;')}" />` : '';
      card.innerHTML = `
        ${imgHtml}
        <h3 id="${titleId}" class="headline-link" tabindex="0">${h.title}</h3>
        <div class="meta">${h.league}${h.byline ? ' • ' + h.byline : ''}</div>
        <p>${h.summary || ''}</p>
      `;
      const opener = (ev) => { ev.preventDefault(); openArticle(h, card); };
      card.addEventListener('click', opener);
      const headEl = card.querySelector('.headline-link');
      headEl.addEventListener('click', opener);
      headEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') opener(e); });
      const img = card.querySelector('.thumb');
      if (img) img.addEventListener('click', opener);
      list.appendChild(card);
    }
  }

  function buildFavoriteKeywords() {
    const favs = new Set(state.favorites);
    const names = new Set();
    for (const t of state.data.teams) {
      if (favs.has(t.id)) names.add(t.name);
    }
    if (favs.has('TB') && names.size === 0) {
      ['Tampa Bay', 'Buccaneers', 'Bucs', 'Rays'].forEach(n => names.add(n));
    }
    return Array.from(names);
  }

  function renderStories() {
    const list = el.lists.stories;
    list.innerHTML = '';
    const keys = buildFavoriteKeywords();
    const lowerKeys = keys.map(k => k.toLowerCase());
    const items = state.data.headlines.filter(h => {
      const text = `${h.title} ${h.summary}`.toLowerCase();
      return lowerKeys.some(k => text.includes(k));
    });

    if (items.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = 'No recent team stories yet. They will appear here as they publish.';
      list.appendChild(hint);
      return;
    }

    for (const h of items) {
      const card = document.createElement('article');
      card.className = 'card clickable';
      const titleId = `story-${h.id}`;
      card.setAttribute('aria-labelledby', titleId);
      const imgHtml = h.image ? `<img class="thumb" src="${h.image}" alt="${(h.imageAlt || '').replace(/"/g,'&quot;')}" />` : '';
      card.innerHTML = `
        ${imgHtml}
        <h3 id="${titleId}" class="headline-link" tabindex="0">${h.title}</h3>
        <div class="meta">${h.league}${h.byline ? ' • ' + h.byline : ''}</div>
        <p>${h.summary || ''}</p>
      `;
      const opener = (ev) => { ev.preventDefault(); openArticle(h, card); };
      card.addEventListener('click', opener);
      const headEl = card.querySelector('.headline-link');
      headEl.addEventListener('click', opener);
      headEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') opener(e); });
      const img = card.querySelector('.thumb');
      if (img) img.addEventListener('click', opener);
      list.appendChild(card);
    }
  }

  function renderTeams() {
    const list = el.lists.teams;
    list.innerHTML = '';
    const favs = new Set(state.favorites);

    const teams = state.data.teams.slice();
    if (!teams.length) {
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = 'Teams will appear here on game days for NFL, MLB, and NCAA Football.';
      list.appendChild(hint);
      return;
    }
    for (const t of teams) {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <div class="row">
          <div>
            <h3 style="margin:0">${t.name}</h3>
            <div class="meta">${t.league}</div>
          </div>
          <button class="btn favorite-btn" aria-pressed="${favs.has(t.id)}" aria-label="${favs.has(t.id) ? 'Remove from' : 'Add to'} favorites: ${t.name}">
            ${favs.has(t.id) ? '★ Favorited' : '☆ Favorite'}
          </button>
        </div>
      `;
      const btn = card.querySelector('.favorite-btn');
      btn.addEventListener('click', () => toggleFavorite(t.id, t.name, btn));
      list.appendChild(card);
    }
  }

  function toggleFavorite(id, name, btn) {
    const idx = state.favorites.indexOf(id);
    if (idx >= 0) state.favorites.splice(idx, 1); else state.favorites.push(id);
    localStorage.setItem('a11y_favorites', JSON.stringify(state.favorites));
    if (btn) {
      const pressed = state.favorites.includes(id);
      btn.setAttribute('aria-pressed', String(pressed));
      btn.textContent = pressed ? '★ Favorited' : '☆ Favorite';
      btn.setAttribute('aria-label', `${pressed ? 'Remove from' : 'Add to'} favorites: ${name}`);
    }
    renderScores();
  }

  // Tab logic
  function setActiveTab(name) {
    state.activeTab = name;
    for (const t in el.tabs) {
      const selected = t === name;
      el.tabs[t].setAttribute('aria-selected', String(selected));
      el.panels[t].hidden = !selected;
    }
  }

  // Event bindings
  el.decreaseText.addEventListener('click', () => {
    state.scale = Math.max(1.0, Math.round((state.scale - 0.05) * 100) / 100);
    applyScale();
  });
  el.increaseText.addEventListener('click', () => {
    state.scale = Math.min(2.0, Math.round((state.scale + 0.05) * 100) / 100);
    applyScale();
  });
  el.themeSelect.addEventListener('change', (e) => {
    state.theme = e.target.value;
    applyTheme();
  });

  el.refresh.addEventListener('click', () => refreshData());

  // read-aloud removed

  el.tabs.scores.addEventListener('click', () => setActiveTab('scores'));
  el.tabs.headlines.addEventListener('click', () => setActiveTab('headlines'));
  el.tabs.stories.addEventListener('click', () => setActiveTab('stories'));
  el.tabs.myteams.addEventListener('click', () => setActiveTab('myteams'));

  // Keyboard navigation for tabs
  for (const name in el.tabs) {
    const btn = el.tabs[name];
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const order = ['scores', 'headlines', 'stories', 'myteams'];
        const idx = order.indexOf(state.activeTab);
        const next = e.key === 'ArrowRight' ? (idx + 1) % order.length : (idx + order.length - 1) % order.length;
        const nextName = order[next];
        setActiveTab(nextName);
        el.tabs[nextName].focus();
      }
    });
  }

  // Init
  function init() {
    applyScale();
    applyTheme();
    // Prefill favorites with Tampa Bay if none
    if (!state.favorites || state.favorites.length === 0) {
      state.favorites = ['TB'];
      localStorage.setItem('a11y_favorites', JSON.stringify(state.favorites));
    }

    // Ensure article overlay starts hidden
    if (el.overlay) el.overlay.hidden = true;

    el.lastUpdated.textContent = `v${APP_VERSION}`;
    refreshData();
    setActiveTab('scores');

    // No speech synthesis

    // Auto refresh every 60s
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(refreshData, 60 * 1000);

    // Load any backup data for quick first paint
    try {
      const backup = JSON.parse(localStorage.getItem('a11y_data_backup') || 'null');
      if (backup) {
        state.data = backup.data || state.data;
        renderScores();
        renderHeadlines();
        renderStories();
        renderTeams();
      }
    } catch {}

    // Register service worker for installable mobile app
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    // PWA install handling
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredInstall = e;
      if (el.installApp) el.installApp.hidden = false;
    });
    window.addEventListener('appinstalled', () => {
      if (el.installApp) el.installApp.hidden = true;
      state.deferredInstall = null;
    });
    if (el.installApp) {
      el.installApp.addEventListener('click', async () => {
        if (state.deferredInstall) {
          try {
            state.deferredInstall.prompt();
            const choice = await state.deferredInstall.userChoice;
            state.deferredInstall = null;
            el.installApp.hidden = true;
            console.log('Install choice', choice && choice.outcome);
          } catch (err) {
            console.warn('Install prompt failed', err);
          }
        } else {
          alert('Installation tips:\n\n- iPhone/iPad (Safari): Share → Add to Home Screen\n- Android (Chrome): Menu ⋮ → Install app or Add to Home Screen\n- Desktop (Chrome/Edge): Address bar install icon or Menu → Install app');
        }
      });
    }

    // QR / share to mobile
    if (el.shareMobile) {
      el.shareMobile.addEventListener('click', () => {
        try {
          const isLocal = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
          const url = isLocal ? PUBLIC_APP_URL : location.href;
          if (el.qrImg) {
            const encoded = encodeURIComponent(url);
            // Public QR service; image loads on demand
            el.qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}`;
          }
          if (el.shareUrl) el.shareUrl.textContent = url;
          if (el.qrSection) el.qrSection.hidden = false;
          if (el.copyLink) el.copyLink.focus();
        } catch {}
      });
    }
    if (el.copyLink) {
      el.copyLink.addEventListener('click', async () => {
        try {
          const isLocal = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
          const url = isLocal ? PUBLIC_APP_URL : location.href;
          await navigator.clipboard.writeText(url);
          el.copyLink.textContent = 'Copied!';
          setTimeout(() => (el.copyLink.textContent = 'Copy Link'), 1200);
        } catch {}
      });
    }
    if (el.closeQR) {
      el.closeQR.addEventListener('click', () => { if (el.qrSection) el.qrSection.hidden = true; });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  // In-app article viewer
  let lastFocus = null;
  async function openArticle(item, sourceEl) {
    lastFocus = sourceEl || null;
    el.articleTitle.textContent = item.title || 'Story';
    const meta = [];
    if (item.league) meta.push(item.league);
    if (item.byline) meta.push(item.byline);
    if (item.published) meta.push(new Date(item.published).toLocaleString());
    el.articleMeta.textContent = meta.join(' • ');
    if (item.image) {
      el.articleImage.src = item.image;
      el.articleImage.alt = item.imageAlt || '';
      el.articleImage.hidden = false;
    } else {
      el.articleImage.hidden = true;
    }
    el.articleBody.textContent = 'Loading…';
    el.overlay.hidden = false;
    el.closeArticle.focus();

    // Try to load full article body from API if available
    try {
      if (item.apiUrl) {
        const article = await fetchJSON(item.apiUrl + (item.apiUrl.includes('?') ? '&' : '?') + '_=' + Date.now());
        const story = article && (article.story || article.article || article.body || '');
        if (typeof story === 'string' && story.trim()) {
          el.articleBody.innerHTML = sanitizeStoryHtml(story);
          return;
        }
      }
      // Fallback: if summary exists, show it
      el.articleBody.textContent = item.summary || 'Full story unavailable. Please try again later.';
    } catch (e) {
      el.articleBody.textContent = item.summary || 'Full story unavailable. Please try again later.';
    }
  }
  function closeArticle() {
    el.overlay.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  el.closeArticle.addEventListener('click', closeArticle);
  el.overlay.addEventListener('click', (e) => { if (e.target === el.overlay) closeArticle(); });
  document.addEventListener('keydown', (e) => { if (!el.overlay.hidden && e.key === 'Escape') closeArticle(); });

  // Update App: unregister SW, clear caches, reload
  if (el.updateApp) {
    el.updateApp.addEventListener('click', async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch (e) { /* ignore */ }
      location.reload(true);
    });
  }

  function sanitizeStoryHtml(html) {
    // Very simple sanitizer: allow a small subset of tags, strip others
    const tmpl = document.createElement('template');
    tmpl.innerHTML = html;
    const allowed = new Set(['P','STRONG','EM','B','I','UL','OL','LI','BR','A','H2','H3','H4','BLOCKQUOTE']);
    const walker = document.createTreeWalker(tmpl.content, NodeFilter.SHOW_ELEMENT, null);
    const toRemove = [];
    while (walker.nextNode()) {
      const el = walker.currentNode;
      if (!allowed.has(el.tagName)) toRemove.push(el);
      if (el.tagName === 'A') {
        el.setAttribute('target','_blank');
        el.setAttribute('rel','noopener');
      } else {
        el.removeAttribute('onclick');
        el.removeAttribute('onmouseover');
      }
    }
    for (const n of toRemove) {
      const parent = n.parentNode;
      while (n.firstChild) parent.insertBefore(n.firstChild, n);
      parent.removeChild(n);
    }
    return tmpl.innerHTML;
  }
})();
