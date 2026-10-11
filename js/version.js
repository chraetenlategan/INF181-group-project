// Single source of truth for the app version.
//
// This number is stamped into every change report the auditors send back, so it
// is how we know which build a report describes. If a report arrives naming an
// older version than the fix that addresses it, the user was on a stale build —
// the fix is not broken, it just had not reached them yet.
//
// Bump this in the SAME commit as the change it describes, add a matching entry
// to CHANGELOG.md.
// See CLAUDE.md → "Versioning & change reports" for when to bump major/minor/patch.
const APP_VERSION = '4.99.0';
const APP_VERSION_DATE = '2026-10-09';
