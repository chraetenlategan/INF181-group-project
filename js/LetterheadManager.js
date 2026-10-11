// LetterheadManager.js — Supplies header/footer letterhead images (dummy PNGs in this build)
// Depends on: config.js

class LetterheadManager {
  constructor() {
    this.ca = { header: [], footer: [] };
    this.audit = { header: [], footer: [] };
    this.loaded = false;
    this._loadPromise = null;
  }

  async load() {
    if (this._loadPromise) return this._loadPromise;
    this._loadPromise = this._doLoad();
    return this._loadPromise;
  }

  // The dummy letterheads ship as plain PNGs (see config.js), so there is no
  // .docx to unzip; the same header/footer shape is built from those paths.
  async _doLoad() {
    this.ca = { header: [CA_LETTERHEAD], footer: [LETTERHEAD_FOOTER_IMG] };
    this.audit = { header: [AUDIT_LETTERHEAD], footer: [AUDIT_FOOTER_IMG] };
    this.loaded = true;
  }

  async _extractImages(path) {
    const result = { header: [], footer: [] };
    try {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`Failed to fetch ${path}: ${resp.status}`);
      const buf = await resp.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);

      result.header = await this._getImagesFromPart(zip, 'header');
      result.footer = await this._getImagesFromPart(zip, 'footer');
    } catch (e) {
      console.warn('LetterheadManager: could not load', path, e);
    }
    return result;
  }

  async _getImagesFromPart(zip, partType) {
    const rels = await this._parseRels(zip, 'word/_rels/document.xml.rels');
    if (!rels) return [];

    const partRels = rels.filter(r =>
      r.type.toLowerCase().includes(partType)
    );
    if (!partRels.length) return [];

    for (const partRel of partRels) {
      const partPath = 'word/' + partRel.target;
      const partRelsPath = partPath.replace('word/', 'word/_rels/').replace('.xml', '.xml.rels');
      const innerRels = await this._parseRels(zip, partRelsPath);
      if (!innerRels) continue;

      const imgRels = innerRels.filter(r =>
        r.type.toLowerCase().includes('image')
      );
      if (!imgRels.length) continue;

      const images = [];
      for (const imgRel of imgRels) {
        const imgPath = 'word/' + imgRel.target;
        const imgFile = zip.file(imgPath);
        if (!imgFile) continue;

        const imgData = await imgFile.async('base64');
        const ext = imgPath.split('.').pop().toLowerCase();
        const mime = ext === 'png' ? 'image/png'
          : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
            : ext === 'gif' ? 'image/gif'
              : 'image/png';
        images.push(`data:${mime};base64,${imgData}`);
      }
      if (images.length) return images;
    }
    return [];
  }

  async _parseRels(zip, path) {
    const xml = await this._readText(zip, path);
    if (!xml) return null;

    const rels = [];
    const regex = /<Relationship[^>]+>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      const tag = match[0];
      const id = this._attr(tag, 'Id');
      const type = this._attr(tag, 'Type');
      const target = this._attr(tag, 'Target');
      if (id && type && target) rels.push({ id, type, target });
    }
    return rels;
  }

  _attr(tag, name) {
    const m = tag.match(new RegExp(`${name}="([^"]+)"`));
    return m ? m[1] : null;
  }

  async _readText(zip, path) {
    const file = zip.file(path);
    if (!file) return null;
    return file.async('string');
  }

  caHeader() { return this.ca.header[0] || null; }
  caFooter() { return this.ca.footer[0] || null; }
  caFooterImages() { return this.ca.footer; }
  auditHeader() { return this.audit.header[0] || null; }
  auditFooter() { return this.audit.footer[0] || null; }
  auditFooterImages() { return this.audit.footer; }
}
