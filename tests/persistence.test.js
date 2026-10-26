import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createProjectStore } from '../server/project-store.js';
import { createDemo } from '../src/demo.js';
import { busGroupKey, validateProject } from '../src/model.js';

async function withStore(fn) {
  const directory = await mkdtemp(path.join(tmpdir(), 'trama-store-'));
  try { await fn(createProjectStore(directory), directory); }
  finally { await rm(directory, { recursive: true, force: true }); }
}
test('repository saves retain all project data and survive a new store instance', () => withStore(async (store, directory) => {
  assert.deepEqual(await store.read(), { project: null, revision: null });
  const project = createDemo();
  project.lineVisibility[busGroupKey('local','39')] = false;
  project.layerColors.urbano = '#12ab34';
  project.featureVisibility[project.features[0].id] = false;
  const saved = await store.write(project, null);
  assert.equal(saved.revision.length,64);
  const disk = JSON.parse(await readFile(store.file,'utf8'));
  assert.deepEqual(disk,validateProject(project));
  assert.deepEqual(await createProjectStore(directory).read(),saved);
  assert.deepEqual(await readdir(directory), ['proyecto.json']);
}));
test('stale and simultaneous saves cannot silently replace a newer project', () => withStore(async (store) => {
  const first = await store.write(createDemo(),null);
  const a = { ...first.project, name:'Versión A' }, b = { ...first.project, name:'Versión B' };
  const attempts = await Promise.allSettled([store.write(a,first.revision),store.write(b,first.revision)]);
  assert.equal(attempts.filter((r) => r.status === 'fulfilled').length,1);
  const failure = attempts.find((r) => r.status === 'rejected').reason;
  assert.equal(failure.status,409);
  assert.equal(failure.project.name,'Versión A');
  assert.equal((await store.read()).project.name,'Versión A');
}));
test('invalid saves and corrupt stored files preserve the existing file', () => withStore(async (store) => {
  const saved = await store.write(createDemo(),null);
  const text = await readFile(store.file,'utf8');
  await assert.rejects(store.write({version:2},saved.revision),{status:400});
  assert.equal(await readFile(store.file,'utf8'),text);
  await writeFile(store.file,'archivo dañado','utf8');
  await assert.rejects(store.read(),{status:500});
  await assert.rejects(store.write(createDemo(),null),{status:500});
  assert.equal(await readFile(store.file,'utf8'),'archivo dañado');
}));
test('manual changes to the repository file are detected as a new revision', () => withStore(async (store) => {
  const saved = await store.write(createDemo(),null);
  const external = { ...saved.project, name:'Cambio desde el archivo' };
  await writeFile(store.file,JSON.stringify(external),'utf8');
  await assert.rejects(store.write(saved.project,saved.revision),{status:409});
  assert.equal((await store.read()).project.name,'Cambio desde el archivo');
}));
