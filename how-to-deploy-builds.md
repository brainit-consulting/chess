# How to Deploy Builds (GitHub Pages)

This repo is a Vite + Three.js project deployed to **GitHub Pages** using **GitHub Actions**.

Live site (project pages):
- `https://<ORG>.github.io/<REPO>/`
- For this repo: `https://brainit-consulting.github.io/chess/`

---

## What “deploy” means here

When you push to `main`, GitHub Actions will:

1. Install dependencies
2. Build the site (`vite build`) into `dist/`
3. Upload the build as a Pages artifact
4. Deploy that artifact to GitHub Pages

You do **not** commit `dist/` and you do **not** run `gh-pages` locally.

---

## One-time setup checklist

### 1) Make sure the workflow file exists

You should have a workflow file at:

- `.github/workflows/pages.yml`

If you ever need to recreate it, use the standard “Vite → GitHub Pages” pattern:
- Build with Node
- Upload artifact from `./dist`
- Deploy to Pages

---

### 2) Set GitHub Pages source to “GitHub Actions”

In GitHub:

1. Go to **Repo → Settings → Pages**
2. Under **Build and deployment → Source**, select **GitHub Actions**

This is required. If you use “Deploy from a branch”, the Actions deploy step may fail with “Not Found”.

---

### 3) Confirm Vite base path matches the repo name

For GitHub Project Pages, your app is served from:

- `/<REPO>/`

So Vite must build with:

- `base: '/<REPO>/'`

Check:

- `vite.config.ts`

Example for this repo:

```ts
export default defineConfig({
  base: '/chess/',
})
```

---

### 4) Ensure runtime asset paths respect the base URL

If you load assets manually (OBJ/PNG/etc), don’t hardcode `/assets/...`.

Use:

- `import.meta.env.BASE_URL`

Example pattern:

```ts
const base = import.meta.env.BASE_URL;
const url = `${base}assets/chess/scifi/scifichess-king.obj`;
```

This ensures assets resolve correctly both locally (`/`) and on Pages (`/chess/`).

---

## Normal deployment flow

### Deploy (recommended)

1. Commit and push to `main`:

```bash
git add -A
git commit -m "Your change"
git push origin main
```

2. Watch the workflow:

- GitHub → **Actions**
- Open workflow: **Deploy Pages**
- Wait for green check ✅

3. Visit the site:

- `https://brainit-consulting.github.io/chess/`

---

## How to redeploy without code changes

Sometimes you want to force a redeploy (e.g., after changing Pages settings).

### Option A — Re-run the workflow in GitHub UI

1. GitHub → **Actions**
2. Select **Deploy Pages**
3. Pick the most recent run
4. Click **Re-run jobs** (or **Re-run all jobs**)

### Option B — Make a “no-op” commit

```bash
git commit --allow-empty -m "chore: trigger pages deploy"
git push
```

---

## How to verify it’s actually deploying the right build

### 1) Check the Pages deployment status

- GitHub → Repo → **Actions**
- The deploy workflow run should be green
- The deploy step should reference Pages / artifact upload

### 2) Check the “Deployments” panel

- GitHub → Repo → **Environments** (or the “Deployments” sidebar)
- Look for a Pages environment entry

### 3) Browser checks

Open the live site and confirm:

- No missing assets (DevTools → Network → filter `404`)
- Board renders and pieces load
- AI toggle works

---

## Common issues & fixes

### Issue: “HttpError: Not Found” during Deploy Pages
**Cause:** Pages is not set to “GitHub Actions” as the source.

**Fix:**
- Repo → Settings → Pages → Source → **GitHub Actions**
- Then re-run the Deploy Pages workflow

---

### Issue: App loads but assets (OBJ/PNG) 404
**Cause:** Vite base path is wrong, or asset URLs are hardcoded.

**Fix:**
- Ensure `vite.config.ts` has `base: '/chess/'`
- Ensure asset loading uses `import.meta.env.BASE_URL`

---

### Issue: Blank page after deploy
Common causes:
- `base` not set correctly
- JS bundle path points to `/assets/...` instead of `/chess/assets/...`

**Fix:**
- Confirm built `index.html` references `/chess/assets/...`
- Confirm Vite `base` is correct

---

### Issue: Workflow doesn’t run on push
Check:
- `.github/workflows/pages.yml` exists on `main`
- The workflow triggers include `on: push: branches: [main]`
- Actions are enabled for the repo (Settings → Actions)

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

Tags don’t deploy by themselves (unless workflow triggers on tags), but they help you track releases.

---

## Files involved

Typical files you’ll touch for Pages deployments:

- `.github/workflows/pages.yml` (Actions workflow)
- `vite.config.ts` (base path)
- Any asset loader modules (use `import.meta.env.BASE_URL`)
- `.gitignore` (ensure `dist/` is ignored)
- `README.md` (include the live URL)

