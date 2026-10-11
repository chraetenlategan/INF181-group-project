// utils.js — Shared utility functions
/* globals: getVal, getRadio, formatNumber, toggleVisible, toProperCase, formatIdNumber, toTitleCase,
   isHighlightColour, stripHighlightColour, expandCloseCorporation */

function getVal(id) {
  return (document.getElementById(id)?.value || '').trim();
}

function getRadio(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || '';
}

// A radio group the user may leave with nothing chosen: clicking the ticked
// option again ticks the group's hidden "none" radio instead. Wire the pill
// <label> with onpointerdown="this.control._was=this.control.checked" and the
// radio with onclick="untickRadio(this)". The
// "none" radio is what gets saved, so an empty choice survives a reload.
function untickRadio(el) {
  if (el._was) {
    const none = document.querySelector(`input[name="${el.name}"][value="none"]`);
    if (none) none.checked = true;
  }
  el._was = false;
}

// Format a number string with thousand separators, rounded up to whole number
function formatNumber(val) {
  if (!val) return val;
  const cleaned = val.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return val;
  const rounded = Math.ceil(num);
  return rounded.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/,/g, ' ');
}

function toggleVisible(id, show) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('visible', show);
}

function toProperCase(str) {
  if (!str) return str;
  return str.toLowerCase().replace(/(?:^|\s|,\s*)\S/g, c => c.toUpperCase())
            .replace(/\(\w/g, c => c.toUpperCase())
            .replace(/(\d)([a-z])/g, (_, d, l) => d + l.toUpperCase())
            .replace(/\bPo\b/gi, 'PO').replace(/\bP\.o\./gi, 'P.O.');
}

// ── ID / REGISTRATION NUMBER CHECKER ──
function isIdNumber(val) {
  const digits = (val || '').replace(/\s/g, '');
  return /^\d{13}$/.test(digits);
}

function isRegNumber(val) {
  const trimmed = (val || '').trim();
  if (trimmed.includes('/')) return true;
  return /^IT\s*\d+/i.test(trimmed);
}

// ── ID NUMBER FORMATTING (SA: 000000 0000 00 0) ──
function formatIdNumber(el) {
  if (el.value.includes('/')) return;
  const raw = el.value.replace(/\s/g, '');
  if (!/^\d*$/.test(raw)) { el.value = raw.replace(/\D/g, ''); return; }
  let formatted = '';
  for (let i = 0; i < raw.length && i < 13; i++) {
    if (i === 6 || i === 10 || i === 12) formatted += ' ';
    formatted += raw[i];
  }
  const cursor = el.selectionStart;
  el.value = formatted;
}

function formatIdString(val) {
  if (!val) return '';
  const raw = val.replace(/\s/g, '');
  if (raw.includes('/') || !/^\d{13}$/.test(raw)) return val;
  return raw.slice(0,6) + ' ' + raw.slice(6,10) + ' ' + raw.slice(10,12) + ' ' + raw.slice(12);
}

const _SURNAME_PARTICLES = /^(van|der|de|du|den|te|ten|von|le|la|el|al|bin|ibn)$/i;

function toTitleCase(str) {
  return str.toLowerCase()
    .replace(/(?:^|\s)\S/g, c => c.toUpperCase())
    .replace(/\(\w/g, c => c.toUpperCase())
    .replace(/\S+/g, (word) =>
      _SURNAME_PARTICLES.test(word) ? word.toLowerCase() : word
    );
}

// Anything in brackets — "(Jnr)", "(Snr)", "(II)" — is kept exactly as typed;
// only the text outside the brackets is re-cased by `fn`. An unclosed "(" runs
// to the end, so a suffix half-way through being typed is left alone too.
function _keepBracketed(str, fn) {
  return str.split(/(\([^)]*\)?)/).map(part => part.startsWith('(') ? part : fn(part)).join('');
}

function formatInitials(str) {
  if (!str) return str;
  return _keepBracketed(str, s => s.toUpperCase());
}

// Short words are treated as initials by formatName, which is wrong for the
// handful of real surnames that are three letters or fewer. Add to this set
// whenever another one turns up.
const _SHORT_SURNAMES = new Set(['vos']);

function formatName(str) {
  if (!str) return str;
  return _keepBracketed(str, s => s.replace(/\S+/g, (word) => {
    if (_SURNAME_PARTICLES.test(word)) return word.toLowerCase();
    if (_SHORT_SURNAMES.has(word.toLowerCase())) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    if (word.length <= 3 && /^[a-zA-Z]+$/.test(word)) return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }));
}

// ── Shared importer helpers ──

// Map INF181 partner name to signer value
const SIGNER_MAP = {
  'ALICE ANDERSON': 'A ANDERSON',
  'A ANDERSON': 'A ANDERSON',
  'HENRY BROOKS': 'H BROOKS',
  'H BROOKS': 'H BROOKS',
  'RITA CLARKE': 'R CLARKE',
  'R CLARKE': 'R CLARKE',
  'ROSA WOLMARANS': 'R DANIELS',
  'R DANIELS': 'R DANIELS',
};

function mapSigner(partnerRaw) {
  if (!partnerRaw) return null;
  const pName = partnerRaw.replace(/\s*\[.*\]/, '').trim().toUpperCase();
  return SIGNER_MAP[pName] || null;
}

// Parse "MR ALICE ANDERSON" → { initials, surname }
function parseName(raw) {
  const cleaned = raw
    .replace(/\s*\(Appointed.*?\)/i, '')
    .replace(/^(MR|MRS|MS|MISS|DR|PROF|ADV|ME|MNR)\s+/i, '')
    .trim();
  const parts = cleaned.split(/\s+/);
  const surname = parts.pop() || '';
  const initials = parts.map(p => p.charAt(0).toUpperCase()).join('');
  return { initials, surname };
}

// Surname particles — these mark where the given names stop.
const NAME_PARTICLES = new Set([
  'van', 'von', 'de', 'den', 'der', 'du', 'da', 'das', 'dos', 'di', 'del',
  'le', 'la', 'ter', 'te', 'ten', "van't", "'t",
]);

// "Rita Clarke BCompt CA (SA)" → "R Clarke BCompt CA (SA)"
// Given names collapse to initials; the surname (particles and all) and
// anything trailing it — qualifications, designations — are left untouched.
function abbreviateGivenNames(raw) {
  const cleaned = (raw || '')
    .replace(/^(MR|MRS|MS|MISS|DR|PROF|ADV|ME|MNR)\s+/i, '')
    .trim();
  if (!cleaned) return cleaned;
  const parts = cleaned.split(/\s+/);

  // A particle in the first few words means the surname starts there.
  let surnameAt = -1;
  for (let i = 1; i < Math.min(parts.length, 4); i++) {
    if (NAME_PARTICLES.has(parts[i].toLowerCase())) { surnameAt = i; break; }
  }
  if (surnameAt < 0) {
    // No particle: the plain capitalised words at the front are the name, and
    // the last of them is the surname. Anything shaped otherwise (BCompt,
    // PGDIP, "(SA)") ends the run, so qualifications never get initialised.
    let run = 0;
    while (run < parts.length && /^[A-Z][a-z]+$/.test(parts[run])) run++;
    surnameAt = run - 1;
  }
  if (surnameAt < 1) return cleaned;

  const initials = parts.slice(0, surnameAt).map(p => p.charAt(0).toUpperCase()).join('');
  return [initials, ...parts.slice(surnameAt)].join(' ');
}

// ── Keyword-highlight colour ──
// Every generated value is wrapped in <span class="hl-kw">, and the red checker
// (`body.super-red`) paints those red so the reviewer can spot each variable on the preview
// at a glance. The red is a review aid: it must never reach a printed page or a PDF.
//
// It leaks because the preview is contenteditable. When the auditor corrects a highlighted
// value, the browser carries the deleted text's *computed* colour onto what they type, as
// an inline `color: rgb(211, 47, 47)` (or a <font color>) on a plain wrapper element. That
// wrapper is not `.hl-kw`, so the stylesheet rules that neutralise the highlight never
// matched it — and because editing also pins the page, the baked-in red survived every
// regeneration and printed on the final document.
//
// Keep in step with `.hl-kw` in styles.css.
const HL_KW_RGB = [211, 47, 47]; // #d32f2f

// Parse '#rgb' / '#rrggbb' / 'rgb(…)' / 'rgba(…)' into [r, g, b]; null for anything else.
function parseColourRgb(value) {
  const v = (value || '').trim().toLowerCase();
  if (!v) return null;
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, c => c + c) : hex[1];
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  }
  const fn = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (fn) return [1, 2, 3].map(i => Math.round(parseFloat(fn[i])));
  return null;
}

function isHighlightColour(value) {
  const rgb = parseColourRgb(value);
  return !!rgb && rgb.every((c, i) => c === HL_KW_RGB[i]);
}

// Remove the highlight red wherever an editor has baked it into the document as an inline
// colour. Nothing the generator emits carries an inline colour and the edit toolbar has no
// colour picker, so an exact match on this one value is always the review aid and never a
// format the auditor authored — other pasted formatting (bold, italics, sizes) is untouched.
// Returns how many elements were cleaned.
function stripHighlightColour(root) {
  if (!root || !root.querySelectorAll) return 0;
  let n = 0;
  [root, ...root.querySelectorAll('[style*="color"]')].forEach(el => {
    if (!el.style || !isHighlightColour(el.style.color)) return;
    el.style.removeProperty('color');
    if (!el.getAttribute('style')) el.removeAttribute('style');
    n++;
  });
  [root, ...root.querySelectorAll('font[color]')].forEach(el => {
    if (!el.getAttribute || !isHighlightColour(el.getAttribute('color'))) return;
    el.removeAttribute('color');
    n++;
  });
  return n;
}

// "28 February 2024" → "28 February 2023"
function calcPrevYearEnd(yearEndStr) {
  if (!yearEndStr) return '';
  const m = yearEndStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  return m ? `${m[1]} ${m[2]} ${parseInt(m[3]) - 1}` : '';
}

/**
 * Comparison key for a shareholder name.
 *
 * Registry keeps a register row per share transaction, so the same holder can
 * come back a dozen times in one ClientReg record. Importers key on this to keep
 * only the first occurrence of each name — case, punctuation and stray spacing
 * differ between rows for the same person, so all three are normalised away.
 */
function shareholderKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Close corporations are stored in the source data as "[NAME] CC" — the full
// wording was never written out there, but the generated documents need it.
// Expansion happens on import only; a name the user types is left alone.
function expandCloseCorporation(name) {
  const n = String(name || '').trim();
  if (!n) return n;
  const expanded = n.replace(/[\s,]*\bC\.?\s*C\.?\s*$/i, ' Close Corporation');
  return expanded.replace(/\s+/g, ' ').trim();
}
