# How to Stop and Start the Local Chess Dev Server

This project uses **Vite** for local development.

## Stop the local dev server

If you see logs like `[vite] page reload` or the terminal says it's waiting for file changes:

1. Click inside the terminal window running the server
2. Press **Ctrl + C**
3. Wait for the process to exit
4. You can safely close the terminal

Stopping the dev server:
- Does NOT affect GitHub Pages
- Does NOT affect releases or tags
- Does NOT affect the repository

It only stops the local server on your machine.

---

## Start the local dev server

From the project root directory:

```bash
npm run dev
```

Vite will start the server and show a local URL (usually `http://localhost:5173`).

---

## Optional: quick sanity check

If you want to be extra sure everything is fine:

```bash
npm run test
```

---

## Summary

- Stop dev server: **Ctrl + C**
- Start dev server: **npm run dev**
- Safe to stop anytime when you're done working

Happy hacking.
