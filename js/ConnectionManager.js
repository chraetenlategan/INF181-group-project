// ConnectionManager.js — live connectivity monitor for the shared database.
//
// The database lives on the always-on office server at a fixed address (see DataStore.js).
// There is no online/offline choice and no server-address setting any more: the app always
// tries to reach that one server. This module just watches whether it's reachable and:
//
//   • Reachable   — the Load / Save / Business-Info features talk to the shared database.
//   • Unreachable — DataStore is flipped into offline mode automatically, so saving falls
//                   back to the local draft (DraftCache) and the Load picker reads the bundled
//                   "Saved Businesses" list. It flips back the moment the server responds.
//
// Depends on: DataStore.js

const ConnectionManager = (() => {

  // ── Connectivity badge (header) ──
  //
  // The badge reflects *live* reachability: we ping the server's health endpoint on a timer
  // and flip the badge to a red "Disconnected" state if the office server is down.
  // `reachable` is the last known result (null until the first probe completes).
  const HEALTH_INTERVAL_MS = 20000;
  let healthTimer = null;
  let reachable = null; // null = checking, true = up, false = unreachable
  let onlineCount = 0;  // how many clients the server sees right now
  let onlineUsers = []; // names of currently connected users

  function renderBadge() {
    const badge = document.getElementById('connectivity-badge');
    const dot   = document.getElementById('connectivity-dot');
    const label = document.getElementById('connectivity-label');
    if (!badge) return;

    let bg, fg, dotColor, text, title;
    if (reachable === false) {
      bg = '#fff3e0'; fg = '#e65100'; dotColor = '#fb8c00';
      text = 'Disconnected';
      title = lastHealthError ||
              ('Online mode is selected but the database service at ' + DataStore.baseUrl() +
              ' can\'t be reached. Check that the office PC\'s service is running.');
    } else if (reachable === null) {
      bg = '#eceff1'; fg = '#546e7a'; dotColor = '#90a4ae';
      text = 'Checking…';
      title = 'Checking the connection to ' + DataStore.baseUrl() + '…';
    } else {
      bg = '#e8f5e9'; fg = '#2e7d32'; dotColor = '#43a047';
      text = onlineCount > 0 ? onlineCount + ' online' : 'Connected';
      title = 'Connected to ' + DataStore.baseUrl();
      if (onlineUsers.length > 0) {
        title += '\n\nOnline now:\n' + onlineUsers.map(function(u) { return '• ' + u; }).join('\n');
      } else if (onlineCount > 0) {
        title += ' — ' + onlineCount + ' user' + (onlineCount === 1 ? '' : 's') + ' online';
      }
    }

    badge.style.background = bg;
    badge.style.color      = fg;
    dot.style.background   = dotColor;
    label.textContent      = text;
    badge.title            = title;
  }

  // Probe the server once and refresh the badge with the result.
  let lastHealthError = '';
  async function checkHealth() {
    const wasReachable = reachable;
    try {
      // Probe with ping() first — it bypasses the offline short-circuit, so we detect the
      // server returning after an outage. Once it answers, clear offline and send the
      // heartbeat (which also reports how many users are online).
      await DataStore.ping();
      DataStore.setOffline(false); // server is up — use the shared database
      const res = await DataStore.heartbeat(typeof getUserName === 'function' ? getUserName() : '');
      reachable = true;
      lastHealthError = '';
      onlineCount = (res && res.online) || 0;
      onlineUsers = (res && Array.isArray(res.users)) ? res.users : [];
    } catch (err) {
      reachable = false;
      DataStore.setOffline(true); // server is down — fall back to the local / JSON workflow
      onlineCount = 0;
      onlineUsers = [];
      lastHealthError = diagnoseConnectionError(err, DataStore.baseUrl());
      // The form is kept in localStorage by DraftCache, so a dropped connection loses nothing —
      // just tell the user once, on the transition, rather than downloading a file.
      if (wasReachable === true && typeof BusinessInfoManager !== 'undefined') {
        BusinessInfoManager.showToast(
          'Connection lost — your work is kept on this PC. Save again once the database is back.',
          'warning', 12000
        );
      }
    }
    renderBadge();
  }

  // Start (or restart) the live health monitor. Always runs — there is only one mode now, so
  // we keep polling the fixed server and let the badge / offline fallback follow reachability.
  function startHealthMonitor() {
    if (healthTimer) { clearInterval(healthTimer); healthTimer = null; }
    checkHealth();
    healthTimer = setInterval(checkHealth, HEALTH_INTERVAL_MS);
    // Re-check immediately when the tab regains focus or the OS reports the network is back,
    // so the badge recovers without waiting out the full interval.
    if (typeof window !== 'undefined' && !startHealthMonitor._listenersAdded) {
      window.addEventListener('online', checkHealth);
      window.addEventListener('focus', checkHealth);
      startHealthMonitor._listenersAdded = true;
    }
  }

  // Public entry point: reset the known state for the current mode, paint immediately, then
  // (in online mode) kick off live polling.
  function updateIndicator() {
    reachable = null;
    renderBadge();
    startHealthMonitor();
  }

  // ── Connection error diagnosis ──
  //
  // Turns a raw fetch/ping error into a specific, actionable message so the user
  // (or whoever is helping them) can identify the exact problem without DevTools.
  function diagnoseConnectionError(err, url) {
    const msg = (err && err.message) || '';
    const name = (err && err.name) || '';

    // AbortError comes from our 8-second AbortController timeout in DataStore.ping.
    if (name === 'AbortError' || /abort/i.test(msg)) {
      return 'Connection timed out after 8 seconds. ' +
        'The server at ' + url + ' is not responding — check that the database service is running ' +
        'on the office PC and that no firewall is blocking port ' + extractPort(url) + '.';
    }

    // TypeError with "Failed to fetch" is Chrome/Edge's generic network error. It covers
    // DNS failure, connection refused, CORS block, and Private Network Access block.
    if (/failed to fetch/i.test(msg) || /networkerror/i.test(msg) || /network request failed/i.test(msg)) {
      return 'Could not connect to ' + url + '. This usually means one of:\n' +
        '• The database service is not running on the office PC (start it with "npm start" in app/server/).\n' +
        '• The address is wrong — double-check the PC name or IP and port ' + extractPort(url) + '.\n' +
        '• A firewall is blocking the connection — Windows Firewall must allow Node.js on port ' + extractPort(url) + '.\n' +
        '• The browser blocked a "Private Network Access" request — try using the PC\'s IP instead of its name.';
    }

    // DNS resolution failure (Firefox gives a more specific message).
    if (/not known/i.test(msg) || /dns/i.test(msg) || /getaddrinfo/i.test(msg) || /nodename nor servname/i.test(msg)) {
      return 'Could not find a computer named "' + extractHost(url) + '" on the network. ' +
        'Check the spelling and that both PCs are on the same Wi-Fi or LAN.';
    }

    // Connection actively refused — server is not listening.
    if (/refused/i.test(msg) || /ECONNREFUSED/i.test(msg)) {
      return 'Connection refused by ' + url + '. ' +
        'The computer was found, but nothing is listening on port ' + extractPort(url) + '. ' +
        'Start the database service on the office PC (cd app/server && npm start).';
    }

    // CORS or Private Network Access block (some browsers surface this).
    if (/cors/i.test(msg) || /cross-origin/i.test(msg) || /private.network/i.test(msg) || /access-control/i.test(msg)) {
      return 'The browser blocked the request due to a cross-origin or Private Network Access restriction. ' +
        'Try using the server PC\'s IP address (e.g. http://192.168.1.x:' + extractPort(url) + ') ' +
        'instead of its hostname, or open this tool from the server PC directly.';
    }

    // Server returned an HTTP error (not a network-level failure).
    if (/server responded with/i.test(msg)) {
      return 'The server at ' + url + ' is reachable but returned an error (' + msg + '). ' +
        'The database service may need to be restarted.';
    }

    // SSL/TLS errors.
    if (/ssl/i.test(msg) || /tls/i.test(msg) || /certificate/i.test(msg) || /ERR_CERT/i.test(msg)) {
      return 'SSL/TLS error connecting to ' + url + '. ' +
        'If the server uses plain HTTP, change the address to start with http:// instead of https://.';
    }

    // Fallback — show the raw error so it's at least not swallowed silently.
    return 'Could not reach ' + url + ': ' + msg + '. ' +
      'Check that the database service is running and that this PC can reach the office network.';
  }

  function extractPort(url) {
    try { return new URL(url).port || '4000'; } catch (_) { return '4000'; }
  }

  function extractHost(url) {
    try { return new URL(url).hostname; } catch (_) { return url; }
  }

  // Start monitoring on load. There's no prompt and no choice any more — we simply begin
  // watching the fixed server. The first health probe paints the badge and, if the server is
  // down, flips DataStore into offline mode so the user can keep working from local files.
  function init() {
    updateIndicator();
  }

  return { init, updateIndicator };
})();
