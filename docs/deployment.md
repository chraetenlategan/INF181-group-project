# Deploying the resource

The site is static — HTML, CSS and JavaScript, no build step, no server, no
database. That is deliberate: it has to open on the lecturer's PC during the
pitch without anything being installed, and it has to survive being opened from
a USB stick if the network misbehaves.

## Three ways to run it, in order of preference

### 1. Cloudflare Pages (recommended for the submitted version)

Free, fast from South Africa, gives a stable URL to put on the title slide.

**Via the dashboard** (no tooling needed):
1. Push this folder to a GitHub repository.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Pick the repository. Leave the build command **empty** and set the build
   output directory to `/` — there is nothing to build.
4. Deploy. The URL will be `<project>.pages.dev`.

**Via Wrangler** (if you prefer the command line):

```bash
npx wrangler pages deploy . --project-name=lerato-hardware-is
```

`_headers` in the project root is picked up automatically by Pages and sets the
security headers, including a Content-Security-Policy that blocks any external
request. Since the site loads nothing from anywhere else, that policy should
never need loosening — if it starts breaking something, a dependency has crept
in and that is worth knowing.

### 2. GitHub Pages

Settings → Pages → deploy from branch, root folder. Works fine. Slightly slower
from South Africa than Cloudflare and no `_headers` support.

### 3. Straight from the folder

Open `index.html` in a browser. Everything works, including the demonstration,
because there are no `fetch()` calls and no module imports — the data files are
plain `<script>` tags for exactly this reason.

**Keep a copy on a USB stick for the presentation.** If the venue's network is
down, this is the fallback that still works.

## Optional: restricting the demonstration with Cloudflare Access

Only if the team decides the demo should not be public. **The recommendation is
to leave it public** — the marker must be able to open it without being issued
credentials, and there is no real data in it to protect.

If you do want it restricted:

1. Cloudflare Zero Trust → Access → Applications → Add an application → Self-hosted.
2. Application domain: your Pages domain, path `/demo`.
3. Policy: Allow, with an include rule — `Emails ending in @belgiumcampus.ac.za`,
   or a list of specific addresses.
4. Identity provider: the built-in **One-time PIN** needs no configuration and
   emails a code. Google is also available if the team prefers.

Nothing in the site's code changes. The policy is applied to the path at
Cloudflare's edge, before the page is served. That is the right way to protect a
static site — a password check written into client-side JavaScript is readable by
anyone who opens the page source, which is why `login.html` is a role switcher
and says so.

**If you turn Access on, test it on the presentation machine first.** A demo that
asks the marker for a one-time PIN they cannot receive is a demo that stops.

## Before submitting

- [ ] Every `.todo` block removed from the HTML (they are visible on the page)
- [ ] `docs/` folder not deployed, or it does not matter that it is
- [ ] Site opened on a machine that has never seen it, with the browser's
      storage cleared, to confirm the demonstration seeds itself correctly
- [ ] Tested at phone width — the lecturer may open it on a phone
- [ ] Print an invoice to PDF from the demo to confirm the print stylesheet works
