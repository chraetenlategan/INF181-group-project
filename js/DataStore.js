// DataStore.js — client data layer. Talks to the LAN database service (server/) over HTTP.
//
// The database now lives on the always-on office server at a FIXED address. The web app
// always targets it — there is no per-user "server address" or online/offline setting any
// more. (The desktop Electron build may still inject its own serverUrl via the preload.)

const DataStore = (() => {
  // Single source of truth for the server address. Point every browser here, always.
  const SERVER_URL = 'http://192.0.2.10:4000';

  // Old versions let each browser cache its own server address / connection mode in
  // localStorage, which left some machines stuck defaulting to a wrong or old address.
  // Those settings are gone now — wipe any leftover values so they can never override the
  // fixed address below.
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('policygenServerUrl');
      localStorage.removeItem('policygenMode');
      localStorage.removeItem('policygenOffline');
    }
  } catch (_) { /* ignore */ }

  function baseUrl() {
    const cfg = (typeof window !== 'undefined' && window.POLICYGEN_CONFIG) || {};
    return (cfg.serverUrl || SERVER_URL).replace(/\/+$/, '');
  }

  // Live connectivity state, driven by ConnectionManager's health monitor — this is NOT a
  // user choice any more. It's set true when the server is currently unreachable, so the app
  // can skip doomed network calls (auto-save, lock acquire) and fall back to the local /
  // JSON-file workflow without waiting on a timeout. The health monitor clears it as soon as
  // the server responds again.
  let _offline = false;
  function setOffline(off) { _offline = !!off; }
  function isOffline() { return _offline; }

  function connectionError() {
    const err = new Error(
      `Cannot reach the business database at ${baseUrl()}. ` +
      `Make sure the office PC's database service is running and reachable on the network.`
    );
    err.isConnectionError = true;
    return err;
  }

  async function request(method, path, body) {
    // While the server is known to be unreachable, fail fast so user-initiated saves drop
    // straight to the JSON-file fallback instead of hanging on a doomed round-trip. The
    // health monitor probes with ping() (which bypasses this) to notice the server return.
    if (isOffline()) throw connectionError();

    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 15000) : null;
    const opts = { method, headers: {}, signal: ctrl ? ctrl.signal : undefined };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(baseUrl() + path, opts);
    } catch (networkErr) {
      if (timer) clearTimeout(timer);
      const err = connectionError();
      err.cause = networkErr;
      err.networkDetail = networkErr.name + ': ' + networkErr.message;
      throw err;
    }
    if (timer) clearTimeout(timer);
    if (res.status === 204) return null;
    const text = await res.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (_) {
      // Server returned non-JSON (e.g. an HTML error page for an unknown route).
      throw new Error(
        res.ok
          ? 'Unexpected response from server (not JSON).'
          : `Server error ${res.status} — the database service may need to be restarted.`
      );
    }
    if (!res.ok) {
      throw new Error((payload && payload.error) || `Request failed (${res.status})`);
    }
    return payload;
  }

  // Probe a server URL without changing the saved configuration — used by the startup
  // prompt to confirm "Work Online" can actually reach the database before committing.
  async function ping(url) {
    const target = (url || baseUrl()).replace(/\/+$/, '');
    // Fail fast instead of hanging on "Connecting…" when the address is wrong, the server is
    // down, or the browser silently blocks the request (e.g. Private Network Access).
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
    try {
      const res = await fetch(target + '/api/health', {
        method: 'GET',
        signal: ctrl ? ctrl.signal : undefined,
      });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      return await res.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // Stable random ID for this browser tab — survives refreshes via sessionStorage
  // so a page reload doesn't register as a new user in the online count.
  const CLIENT_ID = (function() {
    var key = 'policygenClientId';
    var id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(key, id);
    }
    return id;
  })();

  function heartbeat(label) {
    return request('POST', '/api/heartbeat', { clientId: CLIENT_ID, label: label || '' });
  }

  function clientId() { return CLIENT_ID; }

  // ── Business locking ──
  function acquireLock(bizId, label) {
    return request('POST', `/api/locks/${bizId}`, { clientId: CLIENT_ID, label: label || '' });
  }
  function releaseLock(bizId) {
    return request('DELETE', `/api/locks/${bizId}`, { clientId: CLIENT_ID });
  }
  function checkLock(bizId) {
    return request('GET', `/api/locks/${bizId}`);
  }

  return {
    baseUrl,
    setOffline,
    isOffline,
    ping,
    heartbeat,
    clientId,
    acquireLock,
    releaseLock,
    checkLock,
    health: () => request('GET', '/api/health'),
    list: () => request('GET', '/api/businesses'),
    get: (id) => request('GET', `/api/businesses/${id}`),
    create: (record) => request('POST', '/api/businesses', record),
    update: (id, record) => request('PUT', `/api/businesses/${id}`, { ...record, clientId: CLIENT_ID }),
    // Soft delete: the server moves the record to the recycle bin (deleted_at).
    remove: (id) => request('DELETE', `/api/businesses/${id}`, { clientId: CLIENT_ID }),
    // Move / rename a statement (folder and/or file) without resending its data blob.
    moveBusiness: (id, loc) => request('PATCH', `/api/businesses/${id}`, loc),

    // ── Recycle Bin ──
    listRecycleBin: () => request('GET', '/api/recycle-bin'),
    restore: (id) => request('POST', `/api/recycle-bin/${id}/restore`),
    permanentDelete: (id, password) => request('DELETE', `/api/recycle-bin/${id}`, { password }),
    emptyRecycleBin: (password) => request('DELETE', '/api/recycle-bin', { password }),

    // ── Folders (File Explorer) ──
    listFolders: () => request('GET', '/api/folders'),
    createFolder: (name) => request('POST', '/api/folders', { name }),
    renameFolder: (name, newName) =>
      request('PUT', `/api/folders/${encodeURIComponent(name)}`, { name: newName }),
    // deleteContents=true also removes every statement inside the folder.
    deleteFolder: (name, deleteContents) =>
      request('DELETE', `/api/folders/${encodeURIComponent(name)}${deleteContents ? '?deleteContents=1' : ''}`),
  };
})();
