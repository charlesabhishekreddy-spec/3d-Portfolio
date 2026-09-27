# Charles · An immersive personal studio

A responsive, white-and-lavender portfolio with a real Three.js low-poly room, floating crystals, particles, mouse parallax, camera transitions, and clickable monitor/books. Includes project details, skills, an about section, contact, reduced-motion support, animation pause, and a WebGL fallback.

## Run locally

Requires Node.js 22+.

```sh
npm install
cp .env.example .env
# Set a strong, unique ADMIN_PASSWORD in .env (never commit this file).
npm run dev
```

Open port 3000. Private editing is at `/admin`. **Without ADMIN_PASSWORD, admin access is locked, not publicly editable.** The password is checked on the server. Login uses random, HttpOnly, SameSite=Strict session cookies and rate limiting. Sessions expire after 8 hours or a server restart. Production requires HTTPS for secure cookies. Use one server instance; use a shared session store before scaling horizontally.

## Content management

Edit the name, role, homepage headline/introduction, about text, availability, contact email, skills, and projects. The Resume tab manages experience, education, certifications, and languages, including entry ordering. Add/remove projects, edit descriptions/links, choose placeholder artwork and colors, and upload PNG/JPEG/WebP images (8 MB max, server-side signature checking). Click **Publish changes** to persist changes. Uncheck **Show sample content notice** after replacing the examples.

Initial content is transcribed from the owner’s supplied resume screenshots, including four projects, five internships, education, certifications, and languages. Email and LinkedIn are left blank pending confirmation; project URLs and screenshots can be added in the admin. Abstract project covers are decorative artwork, not actual project screenshots.

Published content lives in `data/content.json`; uploads live in `uploads/`. Both are intentionally excluded from Git. Back up and persist these paths when deploying. Uploaded files are public portfolio assets; do not upload private documents. Replaced/deleted image assets are retained to avoid breaking existing references; unused assets can be cleaned up manually.

## Production

```sh
npm run build
npm start
```

Host the Node server behind HTTPS with persistent disk storage. Do not deploy as a static-only website: authentication, publishing, and uploads require the server. Configure ADMIN_PASSWORD as a private deployment environment variable, never a client-side variable. A live preview is not a permanent deployment.

## Verification

`npm run build` checks the production bundle. `npm test` runs API checks on an isolated temporary data directory: public reads, blocked unauthorized writes/uploads, invalid login, valid login, publishing, file validation, and logout.
