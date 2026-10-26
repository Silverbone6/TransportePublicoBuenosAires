import { test, expect } from '@playwright/test';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { emptyProject } from '../../src/model.js';

const projectFile = () => path.join(process.env.TRAMA_E2E_DATA_DIR, 'proyecto.json');
const diskProject = async () => JSON.parse(await readFile(projectFile(), 'utf8'));
const stubTiles = (page) => page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
test.beforeEach(async ({ page }) => {
  await rm(projectFile(), { force: true });
  await stubTiles(page);
});
async function ready(page) {
  await page.goto('/');
  await expect(page.locator('#save-status')).toContainText(/Guardado|Repositorio listo/);
}
async function imported(page) {
  await ready(page);
  await page.locator('.header-actions [data-action="import"]').click();
  await page.locator('#kml-files').setInputFiles(path.resolve('tests/fixtures/recorridos.kml'));
  await page.locator('#import-confirm').click();
  await expect(page.locator('#route-list .route-row')).toHaveCount(2);
}
async function saved(page) { await expect(page.locator('#save-status')).toHaveText('Guardado en el repositorio'); }

test('imports, edits and line visibility are written to disk and restored in a fresh browser context', async ({ page, browser }) => {
  const navigations = []; page.on('framenavigated', () => navigations.push(1));
  await imported(page); await saved(page);
  await page.locator('#route-list [data-feature]').first().click();
  await page.locator('#feature-name').fill('Línea guardada en disco'); await page.locator('#feature-name').press('Tab');
  await page.locator('#feature-bus-line').fill('59'); await page.locator('#feature-bus-line').press('Tab');
  await saved(page);
  await page.locator('.bus-layer-tree[aria-label="Líneas de Colectivo local"] [data-line-visibility]').click();
  await saved(page);
  const disk = await diskProject();
  expect(disk.features[0].name).toBe('Línea guardada en disco');
  expect(disk.features[0].busLine).toBe('Línea 59');
  expect(disk.lineVisibility['["local","linea 59"]']).toBe(false);
  expect(navigations).toHaveLength(1);
  const other = await browser.newContext();
  try {
    const fresh = await other.newPage(); await stubTiles(fresh);
    await fresh.goto('http://127.0.0.1:5174'); await saved(fresh);
    await expect(fresh.locator('#route-list .route-row')).toHaveCount(2);
    await expect(fresh.locator('#route-list')).toContainText('Línea guardada en disco');
    await expect(fresh.locator('[data-line-visibility]')).toHaveAttribute('aria-checked','false');
  } finally { await other.close(); }
});

test('an existing browser-only project is migrated automatically when there is no repository file', async ({ page }) => {
  await ready(page);
  const legacy = { ...emptyProject(), name:'Proyecto anterior', features:[{id:'legacy-node',name:'Nodo anterior',layer:'nodos',nodeType:'combinacion',geometry:{type:'Point',coordinates:[-58.4,-34.6]}}] };
  await page.evaluate(async (project) => {
    await new Promise((resolve,reject) => {
      const request=indexedDB.open('trama-local',1);
      request.onsuccess=()=>{
        const tx=request.result.transaction('projects','readwrite');
        tx.objectStore('projects').put(project,'current');
        tx.objectStore('projects').delete('sync');
        tx.oncomplete=()=>{request.result.close();resolve();};tx.onerror=()=>reject(tx.error);
      };request.onerror=()=>reject(request.error);
    });
  },legacy);
  await page.reload(); await saved(page);
  await expect(page.locator('#route-list')).toContainText('Nodo anterior');
  expect((await diskProject()).name).toBe('Proyecto anterior');
});

test('a failed repository save remains pending and recovers automatically after reconnecting and reloading', async ({ page }) => {
  await page.route('**/api/project', (route) => route.request().method() === 'PUT' ? route.fulfill({status:507,contentType:'application/json',body:JSON.stringify({error:'Fallo de escritura simulado'})}) : route.continue());
  await imported(page);
  await expect(page.locator('#save-status')).toContainText('Pendiente de guardar');
  await expect(page.locator('[data-action="retry-save"]')).toBeVisible();
  await expect(readFile(projectFile(),'utf8')).rejects.toThrow();
  await page.unroute('**/api/project');
  await page.reload(); await saved(page);
  expect((await diskProject()).features).toHaveLength(2);
  await expect(page.locator('#route-list .route-row')).toHaveCount(2);
});

test('conflicting tabs retain their changes and require choosing a version before replacing the file', async ({ page, context }) => {
  await imported(page); await saved(page);
  const other = await context.newPage(); await stubTiles(other); await ready(other);
  await other.locator('[data-mode="edit"]').click();
  await other.locator('#route-list [data-feature]').first().click();
  await page.locator('#route-list [data-feature]').first().click();
  await page.locator('#feature-name').fill('Versión A'); await page.locator('#feature-name').press('Tab'); await saved(page);
  await other.locator('#feature-name').fill('Versión B'); await other.locator('#feature-name').press('Tab');
  await expect(other.locator('#save-status')).toContainText('Versiones en conflicto');
  expect((await diskProject()).features[0].name).toBe('Versión A');
  await other.locator('[data-action="resolve-storage"]').click();
  await other.locator('#keep-local-project').click(); await saved(other);
  expect((await diskProject()).features[0].name).toBe('Versión B');
});

test('repository persistence works even when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window,'indexedDB',{get(){throw new Error('Almacenamiento de navegador deshabilitado');}}));
  await imported(page); await saved(page);
  expect((await diskProject()).features).toHaveLength(2);
  await page.reload(); await saved(page);
  await expect(page.locator('#route-list .route-row')).toHaveCount(2);
});

test('the local API rejects cross-origin and invalid writes without replacing the project file', async ({ request }) => {
  const crossOrigin=await request.put('/api/project',{headers:{Origin:'https://example.invalid'},data:{project:emptyProject(),baseRevision:null}});
  expect(crossOrigin.status()).toBe(403);
  const savedResponse=await request.put('/api/project',{data:{project:emptyProject(),baseRevision:null}});
  expect(savedResponse.status()).toBe(200);
  const {revision}=await savedResponse.json();
  const before=await readFile(projectFile(),'utf8');
  const invalid=await request.put('/api/project',{data:{project:{version:2},baseRevision:revision}});
  expect(invalid.status()).toBe(400);
  expect(await readFile(projectFile(),'utf8')).toBe(before);
});
