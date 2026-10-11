# INF181 Group Project – Policy Generator

A university group-project web app for generating accounting policies and
engagement documents. Runs entirely in the browser — no build step, no server.

**Live site:** https://chraetenlategan.github.io/INF181-group-project/

All firm, client, signatory, letterhead and legal-template content in this
repository is **fictional dummy data**. Nothing here represents a real firm,
a real client, or a real legal document.

## Running it

Open the live site above, or clone and open `index.html` directly in a browser.

There is no database server in this project, so choose **offline mode** when
asked at start-up. The admin password is `admin`.

## Placeholder data used

| Area | Value |
|---|---|
| Firm name | "INF181 Group Project" / "INF181 Audit Group" |
| Signatories | Alice Anderson, Henry Brooks, Rita Clarke, Rosa Daniels (fake practice numbers) |
| Preparers | Fiona Evans, plus generic roles (Bookkeeper, Treasurer, etc.) |
| Letterheads, logo, icon, mascot sprites | Generated placeholder images |
| Engagement-letter templates | Short generic sample text |
| Place, contact, network details | Dummyville, PO Box 123, `admin@example.com`, `192.0.2.10` (reserved documentation range) |
| Client/third-party names | Placeholders such as "Example 33 (Proprietary) Limited" |
| Registry software | "ClientReg" |

## Known limitations

Audit/review/compilation **report** wording, the accounting-policy notes in
`config.js` and some long hard-coded paragraphs in `DocumentGenerator.js`
follow public standards (IFRS / ISA / ISRE) and were left as is. Rewrite them
if the course requires fully original text.
