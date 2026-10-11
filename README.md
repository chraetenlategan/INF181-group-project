# INF181 Group Project – Policy Generator (anonymised copy)

A university-project copy of the `web/` front end. Everything firm-specific has been replaced with dummy data.
**Nothing in this folder is a real firm, client, signatory, letterhead or legal template.**

Open `index.html` in a browser (no build step). The LAN database server is not part of this copy, so use
offline mode when asked at start-up.

## What was changed relative to `web/`

| Area | Change |
|---|---|
| Firm name | VDM → "INF181 Group Project" / "INF181 Audit Group" (UI, footers, sign-offs, storage keys, CSS classes, file names) |
| Signatories | Fictional: Alice Anderson, Henry Brooks, Rita Clarke, Rosa Daniels. Fake practice numbers |
| Letterheads, logo, icon, mascot sprites | Replaced with generated placeholder images; letterhead `.docx` files and the PDF-organiser letterhead PDFs removed/regenerated |
| Engagement-letter templates | Rewritten as short generic text (`AdminPanel.js`, `Assurance Engagements/js/templates.js`, and the accounting letter in `DocumentGenerator.js`) |
| Place, contact, network details | Dummyville, PO Box 123, `admin@example.com`, `192.0.2.10` (documentation range) |
| Client/third-party names in examples | Placeholders such as "Example 33 (Proprietary) Limited" |
| Third-party product names | Registry software renamed to "ClientReg" (files renamed too) |
| Admin password / user gates | Admin password is `admin`; user-name gates use dummy names |
| Removed | Real-data scripts, internal CLAUDE.md for the assurance app, saved-business data (never copied) |

## Known limitations

Audit/review/compilation **report** wording, the accounting-policy notes in `config.js` and some long hard-coded
paragraphs in `DocumentGenerator.js` follow public standards (IFRS / ISA / ISRE) and were left as is. Rewrite them
if your course needs fully original text.
