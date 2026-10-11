// DebugLogger.js — Global error catcher with downloadable bug report
// Must load BEFORE all other scripts to catch early errors.
//
// On file:// pages Chrome treats every script as a separate opaque origin, so an
// uncaught error reaches window.onerror sanitized to "Script error." at 0:0 with a
// null error object. To get real stacks we wrap the callbacks the app actually runs
// from (event listeners, timers, animation frames) and catch the Error before it
// becomes uncaught, then rethrow so behaviour is unchanged.

const DebugLogger = (function () {
  const MAX_ENTRIES = 200;
  const MAX_CRUMBS = 40;
  const _log = [];
  const _crumbs = [];

  // Captured before any patching, so our own internals never re-enter the wrappers.
  const _origAddEventListener = EventTarget.prototype.addEventListener;
  const _origRemoveEventListener = EventTarget.prototype.removeEventListener;

  function _ts() {
    return new Date().toISOString();
  }

  function _push(entry) {
    const last = _log[_log.length - 1];
    if (last && last.type === entry.type && last.message === entry.message && last.stack === entry.stack) {
      last.count = (last.count || 1) + 1;
      last.time = entry.time;
      return last;
    }
    if (_log.length >= MAX_ENTRIES) _log.shift();
    _log.push(entry);
    return entry;
  }

  function _stackStr(err) {
    if (err && err.stack) return err.stack;
    if (err) return String(err);
    return '(no stack)';
  }

  // ── Breadcrumbs ──
  // Element identity only — never values or text, so real business data stays out of reports.
  function _describe(el) {
    if (!el || !el.tagName) return '(unknown)';
    let s = el.tagName.toLowerCase();
    if (el.id) return s + '#' + el.id;
    if (typeof el.className === 'string' && el.className.trim()) {
      const c = el.className.trim().split(/\s+/).slice(0, 2).join('.');
      if (c) s += '.' + c;
    }
    return s;
  }

  function _crumb(kind, detail) {
    if (_crumbs.length >= MAX_CRUMBS) _crumbs.shift();
    _crumbs.push({ time: _ts(), kind: kind, detail: detail });
  }

  // ── Central error recorder ──
  function _record(type, err, extra) {
    const entry = {
      type: type,
      time: _ts(),
      message: err && err.message ? String(err.message) : String(err),
      stack: _stackStr(err)
    };
    if (extra) {
      for (const k in extra) entry[k] = extra[k];
    }
    _showErrorBanner(_push(entry));
  }

  // ── Callback wrapping (the part that survives file:// sanitization) ──
  const _wrapped = new WeakMap();

  function _wrap(fn, origin) {
    if (typeof fn !== 'function') return fn;
    const existing = _wrapped.get(fn);
    if (existing) return existing;
    const wrapper = function () {
      try {
        return fn.apply(this, arguments);
      } catch (err) {
        _record('caught-' + origin, err, { origin: origin });
        throw err;
      }
    };
    _wrapped.set(fn, wrapper);
    return wrapper;
  }

  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (typeof listener === 'function') {
      return _origAddEventListener.call(this, type, _wrap(listener, 'listener:' + type), options);
    }
    return _origAddEventListener.call(this, type, listener, options);
  };

  EventTarget.prototype.removeEventListener = function (type, listener, options) {
    if (typeof listener === 'function') {
      const wrapper = _wrapped.get(listener);
      if (wrapper) return _origRemoveEventListener.call(this, type, wrapper, options);
    }
    return _origRemoveEventListener.call(this, type, listener, options);
  };

  function _patchCallbackTaker(name) {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function (fn) {
      if (typeof fn !== 'function') return orig.apply(window, arguments);
      const args = Array.prototype.slice.call(arguments);
      args[0] = _wrap(fn, name);
      return orig.apply(window, args);
    };
  }

  _patchCallbackTaker('setTimeout');
  _patchCallbackTaker('setInterval');
  _patchCallbackTaker('requestAnimationFrame');

  // ── Capture global errors ──
  // "ResizeObserver loop …" is not a fault: the browser is telling us it ran out
  // of delivery passes and will finish on the next frame. Nothing is broken and
  // there is no stack to act on, so it is logged for context but never banners —
  // otherwise a routine resize scares the user with a red error bar.
  function _isBenign(message) {
    return /^ResizeObserver loop/.test(String(message));
  }

  window.onerror = function (message, source, lineno, colno, error) {
    if (_isBenign(message)) {
      _push({
        type: 'benign',
        time: _ts(),
        message: String(message),
        source: source || '(unknown)',
        note: 'Browser notification, not an app fault — logged for context only, no banner shown.'
      });
      return false;
    }
    const sanitized = !error && String(message) === 'Script error.';
    const entry = {
      type: 'error',
      time: _ts(),
      message: String(message),
      source: source || '(unknown)',
      line: lineno,
      col: colno,
      stack: _stackStr(error),
      note: sanitized
        ? 'Cross-origin sanitized by the browser (file:// page) — no stack available. See breadcrumbs below for what the user was doing.'
        : undefined
    };
    _push(entry);
    _showErrorBanner(entry);
    return false;
  };

  // Resource load failures (images, scripts) don't reach window.onerror — they only
  // fire a capture-phase error event on the element. Worth catching: the app runs off
  // a network share where letterhead images can go missing.
  _origAddEventListener.call(window, 'error', function (e) {
    if (!e || e.target === window || !e.target || !e.target.tagName) return;
    const el = e.target;
    _push({
      type: 'resource-error',
      time: _ts(),
      message: 'Failed to load ' + el.tagName.toLowerCase() + ': ' + (el.src || el.href || '(no url)'),
      element: _describe(el)
    });
  }, true);

  _origAddEventListener.call(window, 'unhandledrejection', function (e) {
    _record('unhandled-promise', e.reason);
  });

  // ── Breadcrumb collection ──
  _origAddEventListener.call(document, 'click', function (e) {
    _crumb('click', _describe(e.target));
  }, true);

  _origAddEventListener.call(document, 'change', function (e) {
    _crumb('change', _describe(e.target));
  }, true);

  // ── Console interception (errors & warns only) ──
  const _origError = console.error;
  const _origWarn = console.warn;

  console.error = function () {
    _push({ type: 'console.error', time: _ts(), args: _serializeArgs(arguments) });
    _origError.apply(console, arguments);
  };

  console.warn = function () {
    _push({ type: 'console.warn', time: _ts(), args: _serializeArgs(arguments) });
    _origWarn.apply(console, arguments);
  };

  function _serializeArgs(args) {
    const parts = [];
    for (let i = 0; i < args.length; i++) {
      try { parts.push(typeof args[i] === 'object' ? JSON.stringify(args[i], null, 2) : String(args[i])); }
      catch (_) { parts.push('[unserializable]'); }
    }
    return parts.join(' ');
  }

  // ── Error banner UI ──
  let _bannerEl = null;
  let _errorCount = 0;

  // Observers told about every error that raises the banner. Used by the stress
  // tester (bugs/monkey/monkey.js) to capture a report the moment a fault fires.
  const _listeners = [];

  function _showErrorBanner(entry) {
    for (var li = 0; li < _listeners.length; li++) {
      try { _listeners[li](entry); } catch (_) {}
    }
    _errorCount++;
    if (!_bannerEl) {
      _bannerEl = document.createElement('div');
      _bannerEl.className = 'debug-error-banner';
      _bannerEl.innerHTML =
        '<span class="debug-error-msg"></span>' +
        '<div class="debug-error-btns">' +
          '<button class="debug-btn-download" title="Download bug report">Download Report</button>' +
          '<button class="debug-btn-dismiss" title="Dismiss">&times;</button>' +
        '</div>';
      document.body.appendChild(_bannerEl);

      _bannerEl.querySelector('.debug-btn-download').addEventListener('click', function () {
        downloadReport();
      });
      _bannerEl.querySelector('.debug-btn-dismiss').addEventListener('click', function () {
        _bannerEl.classList.remove('visible');
        _errorCount = 0;
      });
    }

    var msgEl = _bannerEl.querySelector('.debug-error-msg');
    if (_errorCount === 1) {
      msgEl.textContent = 'An error occurred: ' + entry.message;
    } else {
      msgEl.textContent = _errorCount + ' errors occurred — latest: ' + entry.message;
    }
    _bannerEl.classList.add('visible');
  }

  // ── Report identity ──
  // Bug reports are identified so they can be triaged and de-duplicated:
  //   Bug ID    — hash of the first error's signature (type + message + top stack
  //               frame, with volatile bits stripped). Stable across sessions and
  //               machines, so the same underlying fault always collides.
  //   Report ID — hash of the whole body with timestamps removed. Identical ID
  //               means a byte-identical resend of the same capture.
  // Neither contains user or client data — both are one-way hashes.
  function _seed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function _versionString() {
    return (typeof APP_VERSION !== 'undefined') ? APP_VERSION : 'unknown';
  }

  // Timestamps, line/column numbers and absolute paths differ between two
  // captures of the very same fault; strip them before hashing.
  function _volatile(str) {
    return String(str)
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.-]+Z?/g, '')
      .replace(/:\d+:\d+/g, '')
      // Directory prefixes only. This used to be /^.*[\\/]/gm, which on the
      // single joined line "type|message|top frame" stripped everything up to
      // the last slash of the frame's path — the error message with it. Two
      // unrelated faults thrown from the same file therefore hashed to one Bug
      // ID. Anchoring on a URL scheme or a drive letter keeps the strip inside
      // the path token.
      .replace(/(?:[a-z][a-z0-9+.-]*:\/\/|[A-Za-z]:[\\/])[^\s)]*[\\/]/g, '');
  }

  function _bugId() {
    var first = null;
    for (var i = 0; i < _log.length; i++) {
      // Neither a warning nor a benign browser notification identifies a fault.
      if (_log[i].type !== 'console.warn' && _log[i].type !== 'benign') { first = _log[i]; break; }
    }
    if (!first) return 'none';
    var topFrame = (first.stack || '').split('\n')[1] || first.source || '';
    return _seed(_volatile([first.type, first.message, topFrame].join('|'))).toString(36).slice(0, 8);
  }

  // ── Build & download report ──
  function _buildReport() {
    var lines = [];
    lines.push('── Environment ──');
    lines.push('URL:        ' + window.location.href);
    lines.push('User Agent: ' + navigator.userAgent);
    lines.push('Platform:   ' + navigator.platform);
    lines.push('Screen:     ' + screen.width + 'x' + screen.height + ' (device pixel ratio: ' + (window.devicePixelRatio || 1) + ')');
    lines.push('Window:     ' + window.innerWidth + 'x' + window.innerHeight);
    lines.push('Electron:   ' + (window.POLICYGEN_CONFIG ? 'yes (server: ' + (window.POLICYGEN_CONFIG.serverUrl || 'n/a') + ')' : 'no'));
    lines.push('Online:     ' + navigator.onLine);
    lines.push('');
    lines.push('── Error Log (' + _log.length + ' entries) ──');
    lines.push('');

    _log.forEach(function (e, i) {
      var head = '--- #' + (i + 1) + ' [' + e.type + '] ' + e.time;
      if (e.count > 1) head += ' (x' + e.count + ')';
      lines.push(head + ' ---');
      if (e.message) lines.push('Message: ' + e.message);
      if (e.origin) lines.push('Origin:  ' + e.origin);
      if (e.element) lines.push('Element: ' + e.element);
      if (e.source) lines.push('Source:  ' + e.source + ':' + e.line + ':' + e.col);
      if (e.note) lines.push('Note:    ' + e.note);
      if (e.stack && e.stack !== '(no stack)') lines.push('Stack:\n' + e.stack);
      if (e.args) lines.push('Output:  ' + e.args);
      lines.push('');
    });

    lines.push('── Breadcrumbs (' + _crumbs.length + ', oldest first) ──');
    lines.push('');
    _crumbs.forEach(function (c) {
      lines.push(c.time + '  ' + c.kind + '  ' + c.detail);
    });
    lines.push('');

    // Header last, so the body can be hashed into the Report ID. The generation
    // timestamp deliberately sits in the header, outside the hash.
    var body = lines.join('\n');
    var bugId = _bugId();
    var reportId = _seed(_volatile(body)).toString(36).slice(0, 10);

    var head = [];
    head.push('=== PolicyGenerator Bug Report ===');
    head.push('Generated:   ' + _ts());
    head.push('App version: v' + _versionString());
    head.push('Bug ID:      ' + bugId);
    head.push('Report ID:   ' + reportId);
    head.push('');
    head.push('Triage (developer): App version is the build the user was actually');
    head.push('running — if it predates the fix for this fault, the report is stale,');
    head.push('not a regression. Report ID is a hash of everything below this header:');
    head.push('an identical ID means an identical capture (a duplicate send, ignore');
    head.push('it). Bug ID is stable per underlying fault across sessions and machines:');
    head.push('same Bug ID with a different Report ID is another occurrence of a bug');
    head.push('already logged. Log both in bugs/INDEX.md.');
    head.push('');

    return { text: head.join('\n') + '\n' + body, bugId: bugId, reportId: reportId };
  }

  function downloadReport() {
    var report = _buildReport();
    var blob = new Blob([report.text], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    a.href = url;
    a.download = 'bug-report-v' + _versionString() + '-' +
      d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' +
      pad(d.getHours()) + pad(d.getMinutes()) + '-' +
      report.bugId + '-' + report.reportId + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Start a fresh capture: empty the error log and hide the banner, so the next
  // fault gets its own Bug ID instead of inheriting the first one's. Breadcrumbs
  // are kept — they are a rolling window and still describe what led up to it.
  function reset() {
    _log.length = 0;
    _errorCount = 0;
    if (_bannerEl) _bannerEl.classList.remove('visible');
  }

  return {
    log: _log,
    crumbs: _crumbs,
    downloadReport: downloadReport,
    buildReport: _buildReport,
    record: _record,
    onError: function (fn) { if (typeof fn === 'function') _listeners.push(fn); },
    reset: reset
  };
})();
