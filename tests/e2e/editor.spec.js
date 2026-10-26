import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const fixture = path.resolve('tests/fixtures/recorridos.kml');

// Geometry tests do not need external map tiles or load public tile servers.
test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') }));
});

async function ready(page) {
  await page.goto('/');
  await expect(page.locator('#save-status')).toContainText('Guardado');
}
async function importFixture(page) {
  await page.locator('.header-actions [data-action="import"]').click();
  await page.locator('#kml-files').setInputFiles(fixture);
  await page.locator('#import-confirm').click();
  await expect(page.locator('#route-list .route-row')).toHaveCount(2);
}
async function clickLine(page, portion) {
  await page.waitForTimeout(350);
  const point = await page.locator('.leaflet-overlay-pane path.leaflet-interactive').last().evaluate((el, portion) => {
    const p = el.getPointAtLength(el.getTotalLength() * portion);
    const screen = new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());
    return {x:screen.x,y:screen.y};
  }, portion);
  await page.mouse.click(point.x, point.y);
}
async function exportProject(page) {
  await page.locator('[data-action="export"]').click();
  const downloaded = page.waitForEvent('download');
  await page.locator('[data-action="download-project"]').click();
  const download = await downloaded;
  const result = JSON.parse(await readFile(await download.path(), 'utf8'));
  await page.locator('#dialog [data-action="close-dialog"]').first().click();
  return result;
}

test('import, crop and classify a route; undo, redo, persistence and KML export', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await ready(page); await importFixture(page);
  await page.locator('[data-feature]').filter({ hasText: 'Línea de prueba' }).click();
  await page.locator('.edit-tools [data-tool="trim"]').click();
  await clickLine(page, .25); await clickLine(page, .65);
  await expect(page.locator('.cut-steps .done')).toHaveCount(2);
  await page.locator('[data-action="apply-cut"]').click();
  await expect(page.locator('#route-list .route-row')).toHaveCount(4);
  await expect(page.locator('[data-layer="troncal"] .layer-count')).toHaveText('1');
  await expect(page.locator('[data-layer="local"] .layer-count')).toHaveText('2');
  await page.locator('#undo').click(); await expect(page.locator('#route-list .route-row')).toHaveCount(2);
  await page.locator('#redo').click(); await expect(page.locator('#route-list .route-row')).toHaveCount(4);
  await expect(page.locator('#save-status')).toContainText('Guardado');
  await page.reload(); await expect(page.locator('#route-list .route-row')).toHaveCount(4);
  const project = await exportProject(page);
  expect(project.features.filter((f) => f.layer === 'troncal')).toHaveLength(1);
  expect(project.features.filter((f) => f.layer === 'local')).toHaveLength(2);
  const lines = project.features.filter((f) => f.geometry.type === 'LineString');
  expect(lines[0].geometry.coordinates[0]).toEqual(lines[1].geometry.coordinates.at(-1));
  expect(lines[0].geometry.coordinates.at(-1)).toEqual(lines[2].geometry.coordinates[0]);
  await page.locator('[data-action="export"]').click();
  const downloading = page.waitForEvent('download'); await page.locator('[data-action="download-kml"]').click();
  const xml = await readFile(await (await downloading).path(), 'utf8');
  expect(xml).toContain('<Folder><name>Colectivo troncal</name>');
  expect(xml.match(/<Placemark>/g)).toHaveLength(4);
  expect(errors).toEqual([]);
});

test('split creates two independently editable routes; geometry edit can save and cancel', async ({ page }) => {
  await ready(page); await importFixture(page);
  await page.locator('[data-feature]').filter({ hasText: 'Línea de prueba' }).click();
  await page.locator('.edit-tools [data-tool="split"]').click(); await clickLine(page, .45);
  await page.locator('[data-action="apply-cut"]').click();
  await expect(page.locator('#route-list .route-row')).toHaveCount(3);
  await page.locator('#feature-name').fill('Tramo de prueba');
  await page.locator('#feature-layer').selectOption('troncal');
  await page.locator('.edit-tools [data-tool="vertices"]').click();
  await expect(page.locator('[data-action="save-geometry"]')).toBeVisible();
  const vertex = page.locator('.leaflet-marker-icon.marker-icon:not(.marker-icon-middle)').first();
  await expect(vertex).toBeVisible();
  const box = await vertex.boundingBox();
  await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width/2 + 35, box.y + box.height/2 - 20, { steps: 8 }); await page.mouse.up();
  await page.locator('[data-action="save-geometry"]').click();
  const p = await exportProject(page);
  const edited = p.features.find((f) => f.name === 'Tramo de prueba');
  expect(edited.layer).toBe('troncal'); expect(edited.geometry.coordinates[0]).not.toEqual([-58.47,-34.62]);
  await page.locator('[data-feature]').filter({ hasText: 'Tramo de prueba' }).click();
  await page.locator('[data-mode="edit"]').click();
  await page.locator('.edit-tools [data-tool="vertices"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-action="save-geometry"]')).toHaveCount(0);
});

test('create and move a destination node, change visibility and restore a JSON project', async ({ page }) => {
  await ready(page);
  await page.locator('[data-mode="edit"]').click(); await page.locator('[data-tool="node"]').click();
  await page.locator('#map').click({ position: { x: 130,y: 260 } });
  await page.locator('#new-node-name').fill('Destino de prueba'); await page.locator('#new-node-type').selectOption('destino');
  await page.locator('#node-form button[type="submit"]').click();
  await expect(page.locator('[data-layer="nodos"] .layer-count')).toHaveText('1');
  await page.locator('.edit-tools [data-tool="vertices"]').click();
  const marker = page.locator('.node-marker.selected'); const box = await marker.boundingBox();
  await page.mouse.move(box.x+10,box.y+10); await page.mouse.down(); await page.mouse.move(box.x+50,box.y+40,{steps:8}); await page.mouse.up();
  await page.locator('[data-action="save-geometry"]').click();
  const p = await exportProject(page); expect(p.features[0].nodeType).toBe('destino');
  await page.locator('[data-visibility="nodos"]').click(); await expect(page.locator('.node-marker')).toHaveCount(0);
  await page.locator('[data-visibility="nodos"]').click(); await expect(page.locator('.node-marker')).toHaveCount(1);
  await page.locator('#project-file').setInputFiles({ name:'respaldo.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(p)) });
  await page.locator('#confirm-dialog').click(); await expect(page.locator('[data-feature]')).toContainText('Destino de prueba');
});

test('invalid KML imports leave the existing project untouched', async ({ page }) => {
  await ready(page); await importFixture(page);
  await page.locator('.header-actions [data-action="import"]').click();
  await page.locator('#kml-files').setInputFiles({name:'roto.kml',mimeType:'application/xml',buffer:Buffer.from('<kml><bad></kml>')});
  await page.locator('#import-confirm').click(); await expect(page.locator('#import-error')).toContainText('válido');
  await page.locator('#dialog [data-action="close-dialog"]').first().click();
  await expect(page.locator('#route-list .route-row')).toHaveCount(2);
});

test('draw a route and move multiple routes into a layer together', async ({ page }) => {
  await ready(page); await importFixture(page);
  await page.locator('[data-tool="draw"]').click();
  await page.locator('#map').click({ position: { x: 100, y: 300 } });
  await page.locator('#map').click({ position: { x: 220, y: 350 } });
  await page.locator('#map').dblclick({ position: { x: 330, y: 300 } });
  await expect(page.locator('#route-list .route-row')).toHaveCount(3);
  await expect(page.locator('#feature-name')).toHaveValue('Nuevo recorrido');
  await page.locator('#check-all').check();
  await page.locator('#batch-layer').selectOption('urbano');
  await page.locator('[data-action="batch-move"]').click();
  await expect(page.locator('[data-layer="urbano"] .layer-count')).toHaveText('2');
  await expect(page.locator('[data-layer="local"] .layer-count')).toHaveText('0');
  await page.locator('#undo').click();
  await expect(page.locator('[data-layer="local"] .layer-count')).toHaveText('2');
});

test('crop can discard the outside portions when explicitly chosen', async ({ page }) => {
  await ready(page); await importFixture(page);
  await page.locator('[data-feature]').filter({ hasText: 'Línea de prueba' }).click();
  await page.locator('.edit-tools [data-tool="trim"]').click();
  await clickLine(page,.7); await clickLine(page,.2);
  await page.locator('#keep-remainder').uncheck();
  await page.locator('#cut-layer').selectOption('troncal');
  await expect(page.locator('[data-action="apply-cut"]')).toContainText('Conservar solo este tramo');
  await page.locator('[data-action="apply-cut"]').click();
  await expect(page.locator('#route-list .route-row')).toHaveCount(2);
  await expect(page.locator('[data-layer="troncal"] .layer-count')).toHaveText('1');
  await expect(page.locator('[data-layer="local"] .layer-count')).toHaveText('0');
  const p = await exportProject(page);
  const coords = p.features.find((f) => f.geometry.type === 'LineString').geometry.coordinates;
  expect(coords[0]).not.toEqual([-58.47,-34.62]);
  expect(coords.at(-1)).not.toEqual([-58.37,-34.595]);
});

test('mobile workspace has no horizontal overflow and provides working layer navigation', async ({ page }) => {
  await page.setViewportSize({width:390,height:844}); await ready(page);
  await page.locator('.welcome-card [data-action="demo"]').click();
  await page.locator('.mobile-menu').click();
  await expect(page.locator('.sidebar')).toBeInViewport();
  await page.locator('[data-layer="subte"]').click();
  await expect(page.locator('#route-list .route-row')).toHaveCount(3);
  await page.locator('[data-feature]').first().click();
  await expect(page.locator('.inspector-card')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
