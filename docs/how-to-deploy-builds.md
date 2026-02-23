# How to Deploy Builds (Vercel)

This repo is a Vite + Three.js project and the current live app is deployed on **Vercel**.

Live site:
- `https://chess-pi-wheat.vercel.app/`

---

## What "deploy" means here

When this repo is connected to Vercel, a deploy typically means:

1. Vercel pulls the latest commit from GitHub
2. Installs dependencies
3. Runs the build (`npm run build`)
4. Publishes the output from `dist/`

You do **not** commit `dist/`.

---

## Repo settings that matter

### 1) Vite base path should stay root (`/`)

This repo currently builds for a root-domain deployment (Vercel), not GitHub Project Pages.

Check:
- `vite.config.ts`

Current setting:

```ts
export default defineConfig({
  // Default: Vercel + local dev (root domain)
  base: "/",
});
```

If this is changed to `/chess/`, the Vercel deployment can break (missing assets / blank page).

---

### 2) Runtime asset paths should avoid hardcoded absolute assumptions

If you load assets manually (OBJ/PNG/etc), prefer `import.meta.env.BASE_URL` patterns for portability.

Example:

```ts
const base = import.meta.env.BASE_URL;
const url = `${base}assets/chess/scifi/scifichess-king.obj`;
```

This works locally and keeps paths stable if hosting changes again later.

---

## One-time Vercel setup (if reconnecting or recreating the project)

### 1) Import the repo into Vercel

In Vercel:

1. Click **Add New -> Project**
2. Import the GitHub repo
3. Let Vercel detect the framework (usually **Vite**)

---

### 2) Confirm build settings

Vercel usually auto-detects these correctly, but verify:

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

If Vercel does not auto-detect Vite, set these manually.

---

### 3) Production branch

Confirm the production branch is:

- `main`

This ensures pushes to `main` update `https://chess-pi-wheat.vercel.app/`.

---

## Normal deployment flow

### Deploy to production (recommended)

1. Commit and push to `main`:

```bash
git add -A
git commit -m "Your change"
git push origin main
```

2. Watch the deploy in Vercel:

- Vercel Dashboard -> Project -> **Deployments**
- Wait for the latest production deploy to finish

3. Verify the live site:

- `https://chess-pi-wheat.vercel.app/`

---

## Preview deploys (optional but useful)

If the repo is connected to Vercel and preview deployments are enabled:

- Pull requests / non-`main` pushes can get preview URLs
- Use previews to sanity check UI changes before merging

Preview URLs are shown in:
- Vercel Dashboard -> Project -> **Deployments**
- (Often) GitHub PR checks, if the integration is enabled

---

## How to redeploy without code changes

Sometimes you want to force a redeploy after changing Vercel settings or recovering from a transient build issue.

### Option A - Redeploy from Vercel UI

1. Vercel Dashboard -> Project -> **Deployments**
2. Open the most recent successful deployment
3. Click **Redeploy**

### Option B - Make a no-op commit

```bash
git commit --allow-empty -m "chore: trigger vercel deploy"
git push origin main
```

---

## How to verify the right build is live

### 1) Confirm deployment status in Vercel

- Latest production deployment should be marked successful
- Commit hash / message should match what you pushed

### 2) Browser checks

Open the live site and confirm:

- No missing assets (DevTools -> Network -> filter `404`)
- Board renders and pieces load
- AI controls still work
- Share/play links point to `https://chess-pi-wheat.vercel.app/`

---

## Common issues & fixes

### Issue: App loads but assets (OBJ/PNG) 404
**Cause:** Wrong Vite base path or hardcoded asset URLs.

**Fix:**
- Ensure `vite.config.ts` uses `base: "/"`
- Ensure asset loading uses `import.meta.env.BASE_URL` patterns where needed

---

### Issue: Blank page after deploy
Common causes:
- Build failed but an older deployment is still being viewed
- Vite base path is wrong (for example `/chess/` instead of `/`)
- Runtime exception in the browser

**Fix:**
- Check the latest Vercel deployment logs
- Confirm `vite.config.ts` still has `base: "/"`
- Open DevTools Console for runtime errors

---

### Issue: Vercel build fails on install/build step
Check:
- `package-lock.json` is committed and in sync
- `npm run build` succeeds locally
- Node version / project settings in Vercel are compatible

---

### Issue: Push to `main` does not update production
Check:
- Vercel project is connected to the correct GitHub repo
- Production branch is `main`
- The deployment was not canceled

---

## Local build sanity check (optional)

Before pushing, you can confirm the project builds cleanly:

```bash
npm install
npm run test
npm run build
npm run preview
```

Then open the preview URL shown in the terminal.

---

## Versioning tip (optional)

When you publish meaningful milestones, tag them:

```bash
git tag v1.2.0
git push origin v1.2.0
```

Tags do not deploy by themselves unless your deployment setup is configured to do so.

---

## Files involved

Typical files you might touch for Vercel deployments:

- `vite.config.ts` (base path)
- Asset loader modules (prefer `import.meta.env.BASE_URL`)
- `.gitignore` (ensure `dist/` is ignored)
- `README.md` (live URL)

Optional / legacy:
- `.github/workflows/pages.yml` (GitHub Pages workflow; not the current production deployment path)

