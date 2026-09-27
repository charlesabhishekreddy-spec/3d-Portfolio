// Storage backends.
//
// Free hosts (Render free, Vercel, most PaaS) run an *ephemeral* filesystem:
// anything written to disk is erased on spin-down and on every redeploy. A
// portfolio whose admin saves edits and uploads images therefore cannot rely
// on local files while hosted for free.
//
// GitHub is used as the durable store instead. The repository is already the
// project's home, it is backed up, it has full history (so every content edit
// is revertible), and the API allows 5,000 writes/hour authenticated — orders
// of magnitude more than a personal site needs.
//
// Local disk remains the fallback for paid hosts with a persistent volume, and
// is what the test suite and local development exercise.

import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';

// Anchored to this file, not process.cwd(), so a host that starts the app from
// a different directory still finds the bundled defaults.
const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const BUNDLED_SEED = path.join(APP_ROOT, 'data', 'default.json');
const CONTENT_PATH = 'data/content.json';
const UPLOAD_DIR_PATH = 'uploads';

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

async function writeAtomic(file, contents) {
  await fs.mkdir(path.dirname(file), {recursive: true});
  const temporary = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  await fs.writeFile(temporary, contents);
  await fs.rename(temporary, file);
}

// Image names are always server-generated. Validating here means no caller can
// reach outside the uploads folder, whatever it passes in.
const SAFE_NAME = /^[a-f0-9]{32}\.(png|jpg|webp)$/;
function isSafeName(name) {
  return typeof name === 'string' && SAFE_NAME.test(name);
}

function diskStorage({dataDir, uploadDir}) {
  return {
    mode: 'disk',
    async init() {},
    async read() {
      try { return JSON.parse(await fs.readFile(path.join(dataDir, 'content.json'), 'utf8')); }
      catch { return JSON.parse(await fs.readFile(BUNDLED_SEED, 'utf8')); }
    },
    async write(content) { await writeAtomic(path.join(dataDir, 'content.json'), JSON.stringify(content, null, 2)); },
    async putImage(buffer) {
      const name = randomBytes(16).toString('hex') + buffer.extension;
      await fs.writeFile(path.join(uploadDir, name), buffer.data);
      return name;
    },
    async getImage(name) {
      if (!isSafeName(name)) return null;
      try { return await fs.readFile(path.join(uploadDir, name)); } catch { return null; }
    },
  };
}

function githubStorage({token, repo, branch, dataDir, uploadDir}) {
  const [owner, name] = repo.split('/');
  const base = `https://api.github.com/repos/${owner}/${name}/contents`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'charles-portfolio',
  };
  let writable = true;

  async function api(url, options = {}) {
    const response = await fetch(url, {...options, headers: {...headers, ...options.headers}});
    if (response.status === 404) return null;
    if (response.status === 401 || response.status === 403) {
      writable = false;
      throw new Error('GitHub rejected the token. Check that GITHUB_TOKEN is valid and has Contents: write access to this repository.');
    }
    if (response.status === 422) throw new Error('GitHub could not save that change (a branch protection rule may be blocking writes).');
    if (!response.ok) throw new Error(`GitHub API error ${response.status}.`);
    return response.json();
  }

  // The Contents API requires the current file sha to update an existing file.
  async function currentSha(url) {
    const existing = await api(url);
    return existing?.sha ?? null;
  }

  async function commit(url, message, buffer, sha) {
    const body = {message, content: Buffer.from(buffer).toString('base64'), branch};
    if (sha) body.sha = sha;
    await api(url, {method: 'PUT', body: JSON.stringify(body)});
  }

  return {
    mode: 'github',
    async init() {
      // Pull the published content down into the local cache so reads stay fast
      // and the site still renders if GitHub is briefly unreachable.
      const file = await api(`${base}/${CONTENT_PATH}?ref=${branch}`);
      if (file) await writeAtomic(path.join(dataDir, 'content.json'), Buffer.from(file.content, 'base64'));
      await fs.mkdir(uploadDir, {recursive: true});
    },
    async read() {
      try { return JSON.parse(await fs.readFile(path.join(dataDir, 'content.json'), 'utf8')); }
      catch { return JSON.parse(await fs.readFile(BUNDLED_SEED, 'utf8')); }
    },
    async write(content) {
      if (!writable) throw new Error('Storage is read-only because the GitHub token was rejected.');
      const url = `${base}/${CONTENT_PATH}`;
      const body = JSON.stringify(content, null, 2);
      await commit(url, 'Update portfolio content', body, await currentSha(url));
      await writeAtomic(path.join(dataDir, 'content.json'), body);
    },
    async putImage(buffer) {
      if (!writable) throw new Error('Storage is read-only because the GitHub token was rejected.');
      const fileName = randomBytes(16).toString('hex') + buffer.extension;
      await commit(`${base}/${UPLOAD_DIR_PATH}/${fileName}?ref=${branch}`, 'Add portfolio image', buffer.data, null);
      await fs.writeFile(path.join(uploadDir, fileName), buffer.data);
      return fileName;
    },
    async getImage(fileName) {
      if (!isSafeName(fileName)) return null;
      // Local cache first; on a stateless host this is empty after each restart.
      const cached = path.join(uploadDir, fileName);
      if (await exists(cached)) return fs.readFile(cached);
      const file = await api(`${base}/${UPLOAD_DIR_PATH}/${fileName}?ref=${branch}`);
      if (!file) return null;
      const bytes = Buffer.from(file.content, 'base64');
      await fs.mkdir(uploadDir, {recursive: true});
      await fs.writeFile(cached, bytes);
      return bytes;
    },
  };
}

export function createStorage(options) {
  const {token, repo, branch, dataDir, uploadDir} = options;
  if (token && repo) {
    const storage = githubStorage({...options, token, repo, branch, dataDir, uploadDir});
    return {
      ...storage,
      async init() {
        try {
          await storage.init();
          console.log('Storage: GitHub repository (' + repo + ')');
        } catch (error) {
          // Serve what we have rather than refuse to start; writes surface the
          // real reason on the first save attempt.
          await fs.mkdir(uploadDir, {recursive: true});
          console.warn('Storage: GitHub unreachable (' + error.message + '). Serving cached content; saving may fail.');
        }
      },
    };
  }
  const storage = diskStorage({dataDir, uploadDir});
  return {...storage, init: async () => {
    await fs.mkdir(uploadDir, {recursive: true});
    console.log('Storage: local disk (persistent volume)');
  }};
}
