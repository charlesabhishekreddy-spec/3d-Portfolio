import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('host build installs devDependencies needed to build the client', async () => {
  // Regression guard. A host commonly runs the build with NODE_ENV=production,
  // which makes plain `npm ci` omit devDependencies and remove the vite binary,
  // failing the build with "sh: 1: vite: not found". Every build config must
  // therefore install devDependencies explicitly.
  const manifest = JSON.parse(await readFile('package.json', 'utf8'));
  assert.ok(manifest.devDependencies?.vite, 'vite must be a devDependency');

  const [render, dockerfile] = await Promise.all([
    readFile('render.yaml', 'utf8'),
    readFile('Dockerfile', 'utf8'),
  ]);

  const renderBuild = render.match(/buildCommand:\s*(.+)/)?.[1] ?? '';
  assert.match(renderBuild, /npm ci\s+--include=dev/, 'render.yaml build must install dev deps');
  assert.match(renderBuild, /npm run build/, 'render.yaml must build the client');

  // The Docker build stage must do the same before it prunes to runtime deps.
  assert.match(dockerfile, /npm ci\s+--include=dev/, 'Dockerfile must install dev deps to build');
  assert.match(dockerfile, /npm run build/, 'Dockerfile must build the client');
  assert.match(dockerfile, /npm prune --omit=dev/, 'Dockerfile should prune to runtime deps afterwards');
});

test('build tooling is not required at runtime', async () => {
  // server.js must never import Vite when NODE_ENV=production, otherwise a
  // runtime image without devDependencies would crash on boot.
  const server = await readFile('server.js', 'utf8');
  // The production branch must serve the prebuilt client; vite may only be
  // imported dynamically in the else (development) branch. A static top-level
  // import would crash a runtime image that has no devDependencies.
  const staticImport = /^\s*import .*from ['"]vite['"]/m.test(server);
  assert.ok(!staticImport, 'server.js must not statically import vite');

  const branch = server.split("if(process.env.NODE_ENV==='production')")[1] ?? '';
  const elseIndex = branch.indexOf('}else{');
  assert.ok(elseIndex !== -1, 'expected a production/dev branch');
  const devBranch = branch.slice(elseIndex);
  const prodBranch = branch.slice(0, elseIndex);
  assert.ok(devBranch.includes("await import('vite')"), 'vite must be imported only in the dev branch');
  assert.ok(!prodBranch.includes('vite'), 'the production branch must not reference vite');
  assert.ok(prodBranch.includes("express.static('dist')"), 'the production branch must serve the built client');
});
