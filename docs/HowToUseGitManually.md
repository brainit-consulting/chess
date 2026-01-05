# HowToUseGitManually.md

A practical, step-by-step guide for using Git manually and safely, based on a real production example from the Scorpion Chess Engine repository.

This guide is written for:
- Windows users
- VS Code users
- Developers who want clean releases
- Developers who want to avoid accidental commits

---

## Core Concepts (Quick Primer)

### Branch
A movable pointer to a line of work.

### Tag
A fixed pointer to a release (example: v1.1.67).  
Tags never move.

### Stash
A temporary shelf for uncommitted work.

### Worktree
A separate folder with its own checked-out branch from the same repository.

---

## The Real Scenario (Example Used)

- main was at v1.1.66
- One UI fix was added
- v1.1.67 was prepared and released
- Unfinished work was archived without committing
- Work continued safely on main

---

## Step 1: Confirm Your Current Version

```bat
git describe --tags
```

Example output:
```
v1.1.66-1-g9756f67
```

Meaning:
- Last release: v1.1.66
- You are one commit ahead
- Preparing the next release

---

## Step 2: Locate the App Version

Search the codebase:

```bat
git grep -n "APP_VERSION" src
```

Example result:
```
src/ui/ui.ts:14:const APP_VERSION = 'v1.1.66';
```

Update it to:
```ts
const APP_VERSION = 'v1.1.67';
```

---

## Step 3: Update the CHANGELOG

Open CHANGELOG.md and add at the top:

```md
## v1.1.67
- Fix: Analyzer links now open via anchor navigation for Edge compatibility.
```

Keep entries short, factual, and user-facing.

---

## Step 4: Review Changes Before Committing

```bat
git diff -- src/ui/ui.ts
git diff -- CHANGELOG.md
```

Check status:

```bat
git status --porcelain
```

Expected:
```
 M src/ui/ui.ts
 M CHANGELOG.md
```

Nothing else should be modified.

---

## Step 5: Commit the Release

Stage only the intended files:

```bat
git add src/ui/ui.ts CHANGELOG.md
git commit -m "chore(release): v1.1.67"
```

---

## Step 6: Tag the Release

```bat
git tag v1.1.67
```

---

## Step 7: Push Code and Tag

```bat
git push origin main
git push origin v1.1.67
```

---

## Step 8: Verify the Release

```bat
git describe --tags --exact-match
```

Expected output:
```
v1.1.67
```

This confirms HEAD is exactly the release.

---

## How to Archive Unfinished Work (Without Committing)

If you have WIP changes you do not want on main:

```bat
git stash push -u -m "WIP: king-safety experiments"
```

Restore later:

```bat
git stash pop
```

---

## How to Archive a Branch Permanently

Create an archive tag:

```bat
git tag archive/v1.1.67-king-safety
git push origin archive/v1.1.67-king-safety
```

This preserves history without committing.

---

## Working with Multiple Folders (Worktrees)

Example layout:

```
H:\chess            → main
H:\chess-baseline   → parking/baseline
```

Rules:
- A branch can only be checked out in one worktree
- To switch branches, switch folders

Open the correct folder in VS Code:
```
File → Open Folder → H:\chess
```

---

## Safe Daily Workflow

Start work:
```bat
cd H:\chess
code .
```

Archive WIP:
```bat
git stash push -u -m "WIP"
```

Verify clean state:
```bat
git status
```

---

## Golden Rules

- Tags represent releases
- Branches represent work
- Stash is not a commit
- Never commit just to save work
- Always verify with git describe --tags

---

## One-Line Sanity Check

```bat
git status && git describe --tags
```

If this looks correct, you are safe.

---

End of document.
