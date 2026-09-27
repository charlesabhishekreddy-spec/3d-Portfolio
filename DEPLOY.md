# Deploying your portfolio

**The free option works.** This app stores its content and images in your GitHub
repository instead of on local disk, so it can run on Render's free tier — no
paid disk, no card, $0/month.

The repo is a good place for this: it is already your project's home, it is
backed up, every content edit is recorded in history (so any change is
revertible), and the API allows 5,000 writes/hour — far more than a portfolio
will ever use.

---

## How storage works

| Where you host | Where your edits and images are saved |
|---|---|
| Any free host (Render free, Fly, Docker) | **Your GitHub repo** — permanent |
| Local development | Local files in `data/` and `uploads/` |

Set `GITHUB_TOKEN` + `GITHUB_REPO` and the app uses GitHub. Leave them unset and
it uses local disk, which is what the test suite and local development use.
Both are exercised by `npm test`.

---

## ⚠️ Read this first: pick the right branch

This repository's default branch, `main`, contains **only a README**. The
application lives on `arena/01a0e32e-3d-portfolio`. A host that builds `main`
fails immediately with:

```
npm error enoent Could not read package.json
```

**If you see that error, nothing is wrong with the code.** In Render open
**Settings → Build & Deploy → Branch**, choose `arena/01a0e32e-3d-portfolio`,
press **Save**, then **Manual Deploy → Deploy latest commit**.

Long term, merging the session branch into `main` makes this a non-issue — but
that is a repository change only the owner should make.

---

### A note on `NODE_ENV=production`

The build must run `npm ci --include=dev`. Setting `NODE_ENV=production` (which
this app does, for the runtime) makes plain `npm ci` skip devDependencies —
including Vite — so the build dies with `sh: 1: vite: not found`. Build tools
have to be installed *to* build. `render.yaml` already does this.

---

## Option A — Render free ($0/month, recommended)

1. **Create a GitHub token.** Go to GitHub → *Settings → Developer settings →
   Personal access tokens → Fine-grained tokens → Generate*. Name it
   `portfolio`, set expiry, and grant **only**:
   - Repository: `3d-Portfolio`
   - Permissions → **Contents: Read and write**
   
   No other permissions. Copy the token — GitHub shows it once.

2. **Deploy.** At **render.com** → *New → Blueprint* → connect this repo.
   Render reads `render.yaml` (build command, region, health check all set).
   It will show two secrets as `sync: false`:
   - `ADMIN_PASSWORD` → your studio password from `.env`
   - `GITHUB_TOKEN` → the token you just created

3. Render builds and gives you a URL like `https://charles-portfolio.onrender.com`.

**The trade-off:** free services sleep after 15 minutes idle, so the first
visitor to a quiet site waits ~30–60 seconds while it wakes. That is the price
of $0. Upgrade to $7/month only if that bothers you.

## Option B — Fly.io ($0, uses free allowance)

```sh
fly launch --no-deploy
fly secrets set ADMIN_PASSWORD='YOUR-PASSWORD-HERE' \
             GITHUB_TOKEN='YOUR-TOKEN' \
             GITHUB_REPO='charlesabhishekreddy-spec/3d-Portfolio' \
             GITHUB_BRANCH='arena/01a0e32e-3d-portfolio'
fly deploy
fly open
```

## Option C — Docker anywhere ($0 on a free VPS)

```sh
docker build -t portfolio .
docker run -d -p 3000:3000 \
  -e ADMIN_PASSWORD='YOUR-PASSWORD-HERE' \
  -e GITHUB_TOKEN='YOUR-TOKEN' \
  -e GITHUB_REPO='charlesabhishekreddy-spec/3d-Portfolio' \
  -e GITHUB_BRANCH='arena/01a0e32e-3d-portfolio' \
  --name portfolio portfolio
```

No volume needed. The image builds the client and ships only runtime
dependencies as a non-root user.

---

## After it is live

1. Sign in at `/admin` with your password.
2. **Upload real project screenshots** in the Projects tab. The current covers
   are decorative placeholders — this is the biggest visual upgrade available.
3. Every save writes `data/content.json` to your repo as a commit, so your
   content history is visible and reversible in GitHub's UI.

**To change your password:** update `ADMIN_PASSWORD` in the host's environment
settings and redeploy.

**To roll back a bad edit:** restore the previous `data/content.json` in the
GitHub UI and commit. The next page load picks it up.

---

## What is verified, and what is not

Reproduced here: a build of `main` fails with the npm ENOENT above, while a
build of the correct branch succeeds — confirming the failure is the branch, not
the code.

Verified here: production start from an unrelated working directory, GitHub
storage reading published content from the live API, disk storage round-trips,
fallback to bundled defaults, path-traversal rejection, login success/failure,
unauthorized write rejection, image upload round-trip, the SPA fallback route,
serving built assets, and a rejected-token error message.

Not verified here: the actual `docker build` and the hosts' own deploy
pipelines. Docker is unavailable in this environment, so the Dockerfile follows
standard practice but is untested.

One environment-specific note: this sandbox intercepts TLS with its own proxy
CA, so the GitHub API calls were tested with that CA trusted
(`NODE_EXTRA_CA_CERTS`). On Render and Fly the real GitHub certificate validates
normally and no such setting is needed.
