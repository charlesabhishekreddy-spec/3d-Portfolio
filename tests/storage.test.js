import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStorage} from '../storage.js';
import {mkdtemp, readFile, readdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

async function dirs() {
  const root = await mkdtemp(path.join(tmpdir(), 'storage-test-'));
  return {root, dataDir: path.join(root, 'data'), uploadDir: path.join(root, 'uploads')};
}

test('disk backend round-trips content and images', async () => {
  const {root, dataDir, uploadDir} = await dirs();
  try {
    const storage = createStorage({dataDir, uploadDir});
    await storage.init();
    assert.equal(storage.mode, 'disk');

    // With no saved file, it falls back to the bundled resume defaults.
    const initial = await storage.read();
    assert.equal(initial.name, 'Charles');
    assert.ok(Array.isArray(initial.projects));

    const edited = {...initial, name: 'Edited Name'};
    await storage.write(edited);
    assert.equal((await storage.read()).name, 'Edited Name');

    const name = await storage.putImage({data: Buffer.from('image-bytes'), extension: '.png'});
    assert.match(name, /^[a-f0-9]{32}\.png$/);
    assert.equal((await storage.getImage(name)).toString(), 'image-bytes');
    assert.equal(await storage.getImage('missing.png'), null);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('missing content file falls back to bundled defaults, not an exception', async () => {
  const {root, dataDir, uploadDir} = await dirs();
  try {
    const storage = createStorage({dataDir, uploadDir});
    // Deliberately no init() and no data dir on disk.
    const content = await storage.read();
    assert.equal(content.name, 'Charles');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('image names are restricted to the generated pattern', async () => {
  const {root, dataDir, uploadDir} = await dirs();
  try {
    const storage = createStorage({dataDir, uploadDir});
    await storage.init();
    // Path traversal attempts resolve to null instead of escaping the folder.
    assert.equal(await storage.getImage('../../../etc/passwd'), null);
    assert.equal(await storage.getImage('..%2F..%2Fetc%2Fpasswd'), null);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('github backend is selected when a token and repo are provided', async () => {
  const {root, dataDir, uploadDir} = await dirs();
  try {
    const storage = createStorage({token: 'x', repo: 'owner/name', branch: 'main', dataDir, uploadDir});
    assert.equal(storage.mode, 'github');
    assert.equal(typeof storage.read, 'function');
    assert.equal(typeof storage.write, 'function');
    assert.equal(typeof storage.putImage, 'function');
    assert.equal(typeof storage.getImage, 'function');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('github backend reports a clear error when the token is rejected', async () => {
  const {root, dataDir, uploadDir} = await dirs();
  try {
    const storage = createStorage({token: 'x', repo: 'owner/name', branch: 'main', dataDir, uploadDir});
    // A rejected token must surface an actionable message, not a generic crash.
    const original = globalThis.fetch;
    globalThis.fetch = async () => ({status: 401, ok: false, json: async () => ({})});
    try {
      await assert.rejects(() => storage.write({name: 'X'}), /token/i);
    } finally {
      globalThis.fetch = original;
    }
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
