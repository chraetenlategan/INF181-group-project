# Archived front-end modules

Code that is out of the app but not out of the project. Nothing here is loaded by
`web/index.html`, and `sync-to-server.bat` excludes this folder, so none of it
reaches the office share.

| File | Removed in | Why |
|---|---|---|
| `MinorEditMode.js` | 2.9.0 | Minor-edit mode collapsed the form to the fields that change year to year. It only existed to make the old "import constants for a new year" flow usable. "Open in New Year" now copies the whole left-hand side instead, so there is nothing to collapse around, and a half-hidden form was itself a source of "where did my field go?" confusion. Kept for the day a genuine year-to-year diff view is wanted — it also carries `MINOR_EDIT_FIELD_IDS`, the hand-curated list of fields that vary between years, which is the useful part. |
| `NpoResponsibilitiesPage.js` | 4.90.0 | The NPO Members' / Directors' Responsibilities and Approval page (added 4.88.0). An NPO set no longer carries a responsibilities page, at the user's request. Holds the page template verbatim plus how to wire it back (generator, both NPO assembly lines, the index row). |
