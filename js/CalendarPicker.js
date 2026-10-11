// CalendarPicker.js — Calendar widget + CAL_CONFIG
// Depends on: (none)

const CAL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const CAL_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Build a CAL_CONFIG map.
 * @param {object} callbacks - { autoFillPrevYear, liveUpdate }
 * @returns {object} calPopupId -> { inputId, format, onpick }
 */
function createCalConfig({ autoFillPrevYear, liveUpdate }) {
  return {
    'cal-yearEnd':       { inputId: 'yearEnd',        format: 'long',   onpick: () => { autoFillPrevYear(); liveUpdate(); } },
    'cal-prevYearEnd':   { inputId: 'prevYearEnd',    format: 'long',   onpick: () => liveUpdate() },
    'cal-dateApproved':  { inputId: 'dateApproved',   format: 'long',   onpick: () => { if (typeof onDateApprovedChange === 'function') onDateApprovedChange(); else liveUpdate(); } },
    'cal-dateSigned':    { inputId: 'dateSigned',     format: 'dotted', onpick: () => { if (typeof onDateSignedInput === 'function') onDateSignedInput(); else liveUpdate(); } },
    'cal-dateOfIssue':   { inputId: 'dateOfIssue',    format: 'long',   onpick: () => { if (typeof onDateOfIssueChange === 'function') onDateOfIssueChange(); else liveUpdate(); } },
    'cal-bcAGMDate':     { inputId: 'bcAGMDate',      format: 'long',   onpick: () => { if (typeof onMeetingDateInput === 'function') onMeetingDateInput('bcAGMDate'); else liveUpdate(); } },
    'cal-trustAGMDate':  { inputId: 'trustAGMDate',   format: 'long',   onpick: () => { if (typeof onMeetingDateInput === 'function') onMeetingDateInput('trustAGMDate'); else liveUpdate(); } },
    'cal-trustResolutionDate': { inputId: 'trustResolutionDate', format: 'long', onpick: () => { if (typeof onMeetingDateInput === 'function') onMeetingDateInput('trustResolutionDate'); else liveUpdate(); } },
    'cal-minutes-date':  { inputId: 'minutes-date',   format: 'long',   onpick: () => { if (typeof onMeetingDateInput === 'function') onMeetingDateInput('minutes-date'); else liveUpdate(); } },
    'cal-cc-minutes-date': { inputId: 'cc-minutes-date', format: 'long', onpick: () => { if (typeof onMeetingDateInput === 'function') onMeetingDateInput('cc-minutes-date'); else liveUpdate(); } },
  };
}

class CalendarPicker {
  /**
   * @param {object} calConfig - a CAL_CONFIG map
   *   (calPopupId -> { inputId, format, onpick, transform? })
   */
  constructor(calConfig) {
    this._config   = calConfig;
    this._calOpen  = null;
    this._calState = {};

    // Bind methods so they work as onclick handlers / global references
    this.toggleCal    = this.toggleCal.bind(this);
    this.renderCal    = this.renderCal.bind(this);
    this.pickDate     = this.pickDate.bind(this);
    this.calNav       = this.calNav.bind(this);
    this.formatCalDate = this.formatCalDate.bind(this);
    this.parseCalDate  = this.parseCalDate.bind(this);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  /** Attach the document-level click-away listener. Call once after DOM is ready. */
  init() {
    document.addEventListener('click', (e) => {
      if (!this._calOpen) return;
      const popup = document.getElementById(this._calOpen);
      if (!popup) return;
      if (!popup.contains(e.target) && !e.target.classList.contains('btn-cal')) {
        popup.classList.add('hidden');
        this._calOpen = null;
      }
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  toggleCal(calId) {
    if (this._calOpen && this._calOpen !== calId) {
      const prev = document.getElementById(this._calOpen);
      if (prev) prev.classList.add('hidden');
      this._calOpen = null;
    }
    const popup = document.getElementById(calId);
    if (!popup) return;
    if (popup.classList.contains('hidden')) {
      this.renderCal(calId);
      popup.classList.remove('hidden');
      this._calOpen = calId;
    } else {
      popup.classList.add('hidden');
      this._calOpen = null;
    }
  }

  renderCal(calId) {
    const cfg = this._config[calId];
    if (!cfg) return;
    const popup = document.getElementById(calId);
    if (!popup) return;

    if (!this._calState[calId]) {
      const input = document.getElementById(cfg.inputId);
      const existing = (input && input.value) ? this.parseCalDate(input.value) : null;
      const seed = existing || new Date();
      this._calState[calId] = { year: seed.getFullYear(), month: seed.getMonth() };
    }

    const { year, month } = this._calState[calId];
    const today = new Date();
    const inputEl = document.getElementById(cfg.inputId);
    const selectedDate = inputEl && inputEl.value ? this.parseCalDate(inputEl.value) : null;

    const firstDay  = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let cells = '';
    CAL_DAYS.forEach(d => { cells += `<div class="cal-dow">${d}</div>`; });
    for (let i = 0; i < firstDay; i++) cells += `<div class="cal-day empty"></div>`;
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day);
      const isSel   = selectedDate && (selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === day);
      let cls = 'cal-day';
      if (isToday) cls += ' today';
      if (isSel)   cls += ' selected';
      cells += `<div class="${cls}" data-cal-id="${calId}" data-year="${year}" data-month="${month}" data-day="${day}">${day}</div>`;
    }

    popup.innerHTML = `
      <div class="cal-nav">
        <button type="button" data-cal-id="${calId}" data-dir="-1">&#8249;</button>
        <span class="cal-month-label">${CAL_MONTHS[month]} ${year}</span>
        <button type="button" data-cal-id="${calId}" data-dir="1">&#8250;</button>
      </div>
      <div class="cal-grid">${cells}</div>`;

    // Attach event listeners (replaces inline onclick)
    popup.querySelectorAll('.cal-nav button[data-dir]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.calNav(btn.dataset.calId, parseInt(btn.dataset.dir, 10));
      });
    });
    popup.querySelectorAll('.cal-day[data-day]').forEach(cell => {
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pickDate(cell.dataset.calId, parseInt(cell.dataset.year, 10), parseInt(cell.dataset.month, 10), parseInt(cell.dataset.day, 10));
      });
    });
  }

  pickDate(calId, year, month, day) {
    const cfg = this._config[calId];
    if (!cfg) return;
    const d = new Date(year, month, day);
    let formatted = this.formatCalDate(d, cfg.format);
    const input = document.getElementById(cfg.inputId);
    if (input) {
      // A field whose convention is more than a bare date (a place prefix, an
      // upper-cased line) says so with a transform, and gets the text it had
      // before the pick so it can keep the part the calendar knows nothing about.
      if (cfg.transform) formatted = cfg.transform(formatted, input.value);
      input.value = formatted;
      input.dispatchEvent(new Event('input'));
    }
    const popup = document.getElementById(calId);
    if (popup) popup.classList.add('hidden');
    this._calOpen = null;
    if (cfg.onpick) cfg.onpick();
  }

  calNav(calId, dir) {
    if (!this._calState[calId]) {
      this._calState[calId] = { year: new Date().getFullYear(), month: new Date().getMonth() };
    }
    let { year, month } = this._calState[calId];
    month += dir;
    if (month < 0)  { month = 11; year--; }
    if (month > 11) { month = 0;  year++; }
    this._calState[calId] = { year, month };
    this.renderCal(calId);
  }

  // ── Formatting / Parsing ────────────────────────────────────────────────────

  formatCalDate(d, format) {
    if (format === 'dotted') {
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yy}.${mm}.${dd}`;
    }
    return `${d.getDate()} ${CAL_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  parseCalDate(str) {
    if (!str) return null;
    const m1 = str.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
    if (m1) {
      const mo = CAL_MONTHS.indexOf(m1[2]);
      if (mo >= 0) return new Date(parseInt(m1[3]), mo, parseInt(m1[1]));
    }
    const m2 = str.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
    if (m2) return new Date(parseInt(m2[1]), parseInt(m2[2]) - 1, parseInt(m2[3]));
    const d = new Date(str);
    return isNaN(d) ? null : d;
  }
}
