// ExcelImporter.js — Label-scanning importer for Registry ClientReg exports
// Depends on: utils.js, config.js (IMPORTER_CONFIGS), BaseImporter.js

class ExcelImporter {
  constructor(entityManager) {
    this.em = entityManager;
  }

  setField(id, val) {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  }

  // Find a label cell matching `pattern` in the worksheet
  _findLabel(cell, pattern, maxRow = 40, maxCol = 35) {
    for (let r = 0; r < maxRow; r++) {
      for (let c = 0; c < maxCol; c++) {
        const addr = XLSX.utils.encode_cell({r, c});
        const val = cell(addr);
        if (val && pattern.test(val.trim())) return {row: r, col: c};
      }
    }
    return null;
  }

  // First non-empty cell to the right of (row, startCol)
  _valueRight(cell, row, startCol, maxOffset = 10) {
    for (let c = startCol + 1; c <= startCol + maxOffset; c++) {
      const addr = XLSX.utils.encode_cell({r: row, c});
      const val = cell(addr);
      if (val) return val;
    }
    return '';
  }

  // Cell value one row below (row, col)
  _valueBelow(cell, row, col) {
    return cell(XLSX.utils.encode_cell({r: row + 1, c: col}));
  }

  // Find a section header (DIRECTORS, MEMBERS, etc.)
  _findSection(cell, pattern, startRow = 30, endRow = 90, maxCol = 10) {
    for (let r = startRow; r < endRow; r++) {
      for (let c = 0; c < maxCol; c++) {
        const addr = XLSX.utils.encode_cell({r, c});
        const val = cell(addr);
        if (val && pattern.test(val.replace(/`/g, '').trim())) return {row: r, col: c};
      }
    }
    return null;
  }

  // Find the column containing an ID-related header in a given row
  _findIdCol(cell, row, maxCol = 40) {
    for (let c = 0; c < maxCol; c++) {
      const addr = XLSX.utils.encode_cell({r: row, c});
      const val = cell(addr);
      if (val && /ID\s*[\/\\]\s*(Reg(istration)?\s*)?(Number|No)|ID\s*[\/\\]\s*Passport/i.test(val.trim())) return c;
    }
    return -1;
  }

  importClientReg(input) {
    const file = input.files[0];
    if (!file) return;
    const status = document.getElementById('import-status');
    status.style.display = 'block';
    status.style.color = 'var(--ink-light)';
    status.textContent = 'Reading file…';

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        this._companyWithoutRep = [];
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];

        function cell(ref) {
          const c = ws[ref];
          if (!c) return '';
          if (c.t === 'd' && c.v instanceof Date) {
            const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
            return `${c.v.getDate()} ${months[c.v.getMonth()]} ${c.v.getFullYear()}`;
          }
          return (c.v != null ? String(c.v) : '').trim();
        }

        function fmtAddr(raw) {
          if (!raw) return '';
          return raw.replace(/\\n/g, '\n').split('\n').map(s => s.trim()).filter(Boolean).join(', ');
        }

        // ── Scan for labels ──
        const entityNameLoc = this._findLabel(cell, /^Entity\s*Name$/i);
        const entityName = entityNameLoc ? this._valueRight(cell, entityNameLoc.row, entityNameLoc.col) : '';
        this.setField('companyName', expandCloseCorporation(entityName));

        // Detect entity type from name — off the raw name, which still carries
        // the "CC" suffix the field above spells out.
        let detectedType = 'company';
        const nameUpper = entityName.toUpperCase();
        if (/\(PTY\)|\bPTY\b|\(EDMS\)|\bEDMS\b|\bBPK\b|\bLTD\b|\bLIMITED\b/.test(nameUpper)) detectedType = 'company';
        else if (/\bCC\b|\bBK\b/.test(nameUpper)) detectedType = 'cc';
        else if (/\bTRUST\b/.test(nameUpper)) detectedType = 'trust';
        else if (/\bNPC\b/.test(nameUpper)) detectedType = 'npc';
        else if (/\bNPO\b/.test(nameUpper)) detectedType = 'npo';
        else if (/\bINC\b|\bINCORPORATED\b/.test(nameUpper)) detectedType = 'attorneys';
        else if (/\bSCHOOL\b|\bSKOOL\b/.test(nameUpper)) detectedType = 'school';
        else if (/\bBODY\s*CORPORATE\b/.test(nameUpper)) detectedType = 'bc';
        else if (/\bCHURCH\b|\bKERK\b|\bGEMEENTE\b/.test(nameUpper)) detectedType = 'church';
        else if (/\bCLUB\b/.test(nameUpper)) detectedType = 'club';

        // Structural detection overrides name-based detection
        const trustTypeLoc = this._findLabel(cell, /^Trust\s*Type$/i, 15);
        if (trustTypeLoc) detectedType = 'trust';

        // CCs have "Accounting Officer" while companies have "Designated Auditor"
        const accOfficerLoc = this._findLabel(cell, /^Accounting\s*Officer$/i);
        if (accOfficerLoc && detectedType === 'company') detectedType = 'cc';

        const cfg = IMPORTER_CONFIGS[detectedType];
        if (!cfg) {
          status.style.color = '#c0392b';
          status.textContent = 'Unknown entity type for: ' + entityName;
          return;
        }

        // ── Registration number ──
        const regLoc = this._findLabel(cell, /^Registration\s*No\.?$/i);
        const regNo = regLoc ? this._valueRight(cell, regLoc.row, regLoc.col) : '';
        if (!cfg.regOptional || regNo) this.setField('regNumber', regNo);

        // ── Year end ──
        const yearEndLoc = this._findLabel(cell, /^Year\s*End$/i);
        const yearEndStr = yearEndLoc ? this._valueRight(cell, yearEndLoc.row, yearEndLoc.col) : '';
        this.setField('yearEnd', yearEndStr);
        const prevYear = calcPrevYearEnd(yearEndStr);
        if (prevYear) this.setField('prevYearEnd', prevYear);

        // Nature of business is never imported — the user types it in.

        // ── Addresses ──
        const postalLoc = this._findLabel(cell, /^Postal\s*Address$/i);
        const regAddrLoc = this._findLabel(cell, /^Reg\s*Office\s*\(Business\)$/i);
        this.setField('postalAddress', postalLoc ? fmtAddr(this._valueBelow(cell, postalLoc.row, postalLoc.col)) : '');
        this.setField('regAddress', regAddrLoc ? fmtAddr(this._valueBelow(cell, regAddrLoc.row, regAddrLoc.col)) : '');
        // Business address is never imported — the export has no reliable source for it,
        // and the fallbacks used to fill it with a postal/PO Box address. Left blank for
        // the user to type in. Same for the physical address.
        this.setField('physAddress', '');
        this.setField('businessAddress', '');

        // ── Partner → INF181 Signatory ──
        const partnerLoc = this._findLabel(cell, /^Partner$/i);
        const partnerVal = partnerLoc ? this._valueRight(cell, partnerLoc.row, partnerLoc.col) : '';
        const signerVal = mapSigner(partnerVal);
        if (signerVal) {
          const el = document.getElementById('compilerSigner');
          if (el) el.value = signerVal;
        }

        // ── Select entity type ──
        const ecCard = document.getElementById(cfg.ecId);
        if (ecCard) this.em.selectEntity(ecCard, detectedType);

        // ── Directors / Trustees / Members ──
        document.getElementById('directors-list').innerHTML = '';
        this.em.directors = [];
        this.em.directorCount = 0;

        // A config for an entity with no governing body (an individual) carries
        // no headerPattern — nothing to scan for.
        const peopleSection = cfg.headerPattern ? this._findSection(cell, cfg.headerPattern) : null;
        let peopleImported = 0;

        if (peopleSection) {
          const headerRow = peopleSection.row + 1;
          const nameCol = peopleSection.col;
          const idCol = this._findIdCol(cell, headerRow);

          let dataRow = headerRow + 1;
          while (dataRow < headerRow + 25) {
            const nameAddr = XLSX.utils.encode_cell({r: dataRow, c: nameCol});
            const name = cell(nameAddr);
            if (!name) break;

            const cleaned = name.replace(/`/g, '').trim();
            if (cfg.stopPattern && cfg.stopPattern.test(cleaned)) break;
            if (/^Total:?$/i.test(cleaned)) break;
            if (/^(ORDINARY|PREFERENCE)\s+SHARE/i.test(cleaned) || /^\d+$/.test(cleaned)) {
              dataRow++;
              continue;
            }

            const { initials, surname } = parseName(cleaned);
            const idNo = idCol >= 0 ? cell(XLSX.utils.encode_cell({r: dataRow, c: idCol})) : '';

            if (detectedType === 'trust' && isRegNumber(idNo)) {
              // Business independent trustee — reg number in ID column means this is a business entity
              this.em.addDirector();
              const idx = this.em.directorCount;
              const indCb = document.getElementById(`dir-ind-${idx}`);
              if (indCb) { indCb.checked = true; this.em.toggleIndependentTrustee(idx); }
              this.setField(`dir-ind-biz-${idx}`, cleaned);
              this.setField(`dir-ind-reg-${idx}`, idNo);
            } else {
              this.em.addDirector();
              const idx = this.em.directorCount;
              this.setField(`dir-init-${idx}`, initials);
              this.setField(`dir-sur-${idx}`, surname);
              this.setField(`dir-id-${idx}`, idNo);
            }
            peopleImported++;
            dataRow++;
          }
        }

        // ── Independent Trustee / Representative (trust only) ──
        if (detectedType === 'trust' && peopleSection) {
          const headerRow = peopleSection.row + 1;
          const nameCol = peopleSection.col;
          let repCol = -1;
          for (let c = nameCol + 1; c < nameCol + 15; c++) {
            const addr = XLSX.utils.encode_cell({r: headerRow, c});
            const val = cell(addr);
            if (val && /representative/i.test(val.trim())) { repCol = c; break; }
          }

          if (repCol >= 0) {
            let repIdCol = -1;
            for (let c = repCol + 1; c < repCol + 5; c++) {
              const addr = XLSX.utils.encode_cell({r: headerRow, c});
              const val = cell(addr);
              if (val && /ID|Reg|Number|No/i.test(val.trim())) { repIdCol = c; break; }
            }
            if (repIdCol < 0) repIdCol = repCol + 1;

            let repPersonName = '';
            let repPersonId = '';
            let repBizName = '';
            let repBizReg = '';

            let repRow = headerRow + 1;
            while (repRow < headerRow + 25) {
              const repNameAddr = XLSX.utils.encode_cell({r: repRow, c: repCol});
              const repName = (cell(repNameAddr) || '').replace(/`/g, '').trim();
              if (repName && !/^Total:?$/i.test(repName)) {
                const repId = (cell(XLSX.utils.encode_cell({r: repRow, c: repIdCol})) || '').trim();
                if (isRegNumber(repId)) {
                  repBizName = repName;
                  repBizReg = repId;
                } else {
                  repPersonName = repName;
                  repPersonId = repId;
                }
              }
              repRow++;
            }

            // Determine independent trustee type: business (has rep number) or person (ID only)
            if (repBizName) {
              // Business independent trustee – add row even if representative person is missing
              this.em.addDirector();
              const idx = this.em.directorCount;
              const indCb = document.getElementById(`dir-ind-${idx}`);
              if (indCb) { indCb.checked = true; this.em.toggleIndependentTrustee(idx); }
              this.setField(`dir-ind-biz-${idx}`, repBizName);
              this.setField(`dir-ind-reg-${idx}`, repBizReg);
              if (repPersonName) {
                const parsed = parseName(repPersonName);
                this.setField(`dir-init-${idx}`, parsed.initials);
                this.setField(`dir-sur-${idx}`, parsed.surname);
                this.setField(`dir-id-${idx}`, repPersonId);
              } else {
                this._companyWithoutRep.push(idx);
              }
            } else if (repPersonName) {
              // Person independent trustee (no business)
              const parsed = parseName(repPersonName);
              this.em.addDirector();
              const idx = this.em.directorCount;
              this.setField(`dir-init-${idx}`, parsed.initials);
              this.setField(`dir-sur-${idx}`, parsed.surname);
              this.setField(`dir-id-${idx}`, repPersonId);
              const indCb = document.getElementById(`dir-ind-${idx}`);
              if (indCb) { indCb.checked = true; this.em.toggleIndependentTrustee(idx); }
              const typeRadio = document.querySelector(`input[name="dir-ind-type-${idx}"][value="person"]`);
              if (typeRadio) { typeRadio.checked = true; this.em.toggleIndTrusteeType(idx); }
            }
          }
        }

        // ── Shareholders (company only) ──
        if (cfg.importShareholders) {
          document.getElementById('shareholder-list').innerHTML = '';
          this.em.shareholderCount = 0;

          const shSection = this._findSection(cell, /^(ORDINARY\s+)?SHARE\s*HOLDERS?$/i);
          if (shSection) {
            const shNameCol = shSection.col;
            let shRow = shSection.row + 2; // skip header + column labels
            const shSeen = new Set();

            while (shRow < shSection.row + 30) {
              const shNameAddr = XLSX.utils.encode_cell({r: shRow, c: shNameCol});
              const shName = cell(shNameAddr);
              if (!shName) break;
              if (/^(ORDINARY|PREFERENCE)\s+SHARE/i.test(shName.trim()) || /^\d+$/.test(shName.trim())) {
                shRow++;
                continue;
              }
              const shKey = shareholderKey(shName);
              if (shSeen.has(shKey)) { // one row per share transaction, one shareholder
                shRow++;
                continue;
              }
              shSeen.add(shKey);
              this.em.addShareholder();
              const idx = this.em.shareholderCount;
              this.setField(`sh-name-${idx}`, toTitleCase(shName));
              if (/\bPTY\b|\bLTD\b|\bCC\b|\bTRUST\b|\bINC\b/i.test(shName)) {
                const radio = document.querySelector(`input[name="sh-type-${idx}"][value="entity"]`);
                if (radio) { radio.checked = true; this.em.onShareholderTypeChange(idx); }
              }
              shRow++;
            }
          }
        }

        status.style.display = 'none';

        // Every field above was written straight to .value, so none of the
        // oninput handlers fired. Push the imported address/dates into the
        // fields that track them and are still on auto — otherwise the meeting
        // venues keep their starting value even though an address just arrived.
        if (typeof syncAutoMeetingVenues === 'function') syncAutoMeetingVenues();
        if (typeof syncAutoSigningDates === 'function') syncAutoSigningDates();
        if (typeof syncAutoMeetingDates === 'function') syncAutoMeetingDates();
        if (typeof syncAutoLoanCertDates === 'function') syncAutoLoanCertDates();

        // Trust warning: prompt user to verify independent trustees and representative
        if (detectedType === 'trust') {
          this._showTrustWarning();
          if (this._companyWithoutRep.length > 0) {
            this._highlightTrusteeInputs(this._companyWithoutRep);
          }
        }

        // Same as the register import: with no document on screen yet a plain
        // liveUpdate() does nothing, and the .xlsx would appear to import into
        // an empty preview.
        if (typeof ensureDocumentGenerated === 'function') ensureDocumentGenerated();
        else this.em.liveUpdate();
      } catch (err) {
        status.style.color = '#c0392b';
        status.textContent = 'Error reading file: ' + err.message;
        console.error('Import error:', err);
      }
    };
    reader.readAsArrayBuffer(file);
    input.value = '';
  }

  _showTrustWarning() {
    // Toast only — the old inline banner ate a large slice of the form bar.
    const msg = 'Double-check <strong>Step 4</strong> — verify independent trustees and representatives imported correctly. ClientReg data may be incomplete or outdated.';
    if (typeof BusinessInfoManager !== 'undefined' && BusinessInfoManager.showToast) {
      BusinessInfoManager.showToast(msg, 'warning', 10000);
    } else {
      console.warn(msg.replace(/<[^>]+>/g, ''));
    }
  }

  _highlightTrusteeInputs(directorIndices) {
    directorIndices.forEach(idx => {
      const fields = [
        document.getElementById(`dir-init-${idx}`),
        document.getElementById(`dir-sur-${idx}`),
        document.getElementById(`dir-id-${idx}`)
      ];
      fields.forEach(el => {
        if (!el || el.value.trim()) return;
        el.style.border = '2px solid #c0392b';
        el.addEventListener('input', function handler() {
          el.style.border = '';
          el.removeEventListener('input', handler);
        });
      });
    });
  }
}
