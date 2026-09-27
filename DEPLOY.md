# Deploying your portfolio

Your portfolio is a **Node/Express app**, not a static site. The server does the
admin login, saves your edits, and stores uploaded images — so it must run on a
host that keeps a **persistent disk**. Deploying to a static host (GitHub Pages,
Netlify static, plain S3) will show the site but the admin will not save.

**Ready-to-use configs are in this repo:** `render.yaml` (Render), `fly.toml`
(Fly.io), and `Dockerfile` (any container host).

---

## The one rule

Mount a persistent disk and point `DATA_DIR` + `UPLOAD_DIR` at it.

| Variable | Purpose |
|---|---|
| `DATA_DIR` | Your saved content (`content.json`) |
| `UPLOAD_DIR` | Project images you upload |
| `ADMIN_PASSWORD` | Your private studio password — **set in the host dashboard, never in Git** |
| `PORT` | Provided by the host; don't hardcode it |

Without a disk, a restart or deploy silently wipes your admin edits and images.
On first boot the app seeds `content.json` from the bundled `data/default.json`,
so a fresh disk starts with your resume content intact.

---

## Option A — Render (easiest, ~$7/mo)

1. Push this branch to GitHub (done).
2. At **render.com** → *New → Blueprint* → connect the repo. Render reads
   `render.yaml` and sets up the service, build, disk, and health check.
3. Render shows `ADMIN_PASSWORD` as *sync: false*. Open **Environment** and type
   your own password (set it in the dashboard — never in a committed file).
4. Deploy. You get a URL like `https://charles-portfolio.onrender.com`.

Config uses a 1 GB disk in the Singapore region, closest to India.

> The free plan has **no disk**, so admin changes would be lost. The Starter
> plan ($7/mo) is the cheapest that supports persistent disks. Free instances
> also sleep after inactivity, so the first visit can take ~30s to wake.

## Option B — Fly.io (~$3–5/mo)

```sh
fly launch --no-deploy          # reads fly.toml
fly volumes create portfolio_data --size 1 --region bom
fly secrets set ADMIN_PASSWORD='YOUR-PASSWORD-HERE'
fly deploy
fly open                        # shows your public URL
```

## Option C — Docker anywhere

```sh
docker build -t portfolio .
docker run -d -p 3000:3000 \
  -e ADMIN_PASSWORD='YOUR-PASSWORD-HERE' \
  -v portfolio-data:/data \
  --name portfolio portfolio
```

The image builds the client, then ships only runtime dependencies as a
non-root user, with a `/api/health` health check.

---

## After it's live

1. Visit `/admin` and sign in with your password.
2. Add real project screenshots (Projects tab) — the current covers are decorative.
3. Re-upload the resume-derived content if it was reset.
4. **Connect a custom domain** in the host's Domains tab (optional).

### Setting your password

Your password lives in the untracked `.env` file in this repo, which is
excluded from Git. Copy that value into the host's environment settings
(`ADMIN_PASSWORD`) — never paste it into a file you commit. If you ever move
to a different host, use the same value in that host's dashboard.

### Changing your password later

Update `ADMIN_PASSWORD` in the host's environment settings and trigger a
redeploy. Nothing is stored in code.

### Backing up

Your content lives on the host's disk. To back up, copy `content.json` and the
uploads folder from the host, or keep the git repo as the source of truth for
the default content and re-upload images if the disk is ever lost.

### What is verified, and what isn't

Verified here: production start, health endpoint, content seeding onto an empty
disk, login success/failure, unauthorized upload rejection, an authenticated
image upload round-trip, the SPA fallback route, and serving built assets — all
with only production dependencies installed.

Not verified here: the actual `docker build`, and the hosts' own deploy
pipelines. Docker isn't available in this environment, so the Dockerfile is
written to standard practice but untested. Render/Fly deploy these themselves.
