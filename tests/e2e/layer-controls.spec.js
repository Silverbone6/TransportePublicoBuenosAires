import { test, expect } from '@playwright/test';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { emptyProject } from '../../src/model.js';
import { createDemo } from '../../src/demo.js';

const projectFile = () => path.join(process.env.TRAMA_E2E_DATA_DIR,'proyecto.json');
test.beforeEach(async ({page}) => {
  await rm(projectFile(),{force:true});
  await page.route('https://tile.openstreetmap.org/**',(r) => r.abort());
  await page.goto('/');
  await expect(page.locator('#save-status')).toContainText(/Guardado|Repositorio listo/);
});
async function openProject(page,project) {
  await page.locator('#project-file').setInputFiles({name:'capas.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await expect(page.locator('#save-status')).toHaveText('Guardado en el repositorio');
}
async function color(page,layer,value) {
  await page.locator(`[data-layer-color="${layer}"]`).evaluate((input,value) => { input.value=value; input.dispatchEvent(new Event('change',{bubbles:true})); },value);
  await expect(page.locator('#save-status')).toHaveText('Guardado en el repositorio');
}
test('all layer trees expose their elements; colors and individual visibility persist in the repository and KML',async ({page}) => {
  await openProject(page,createDemo());
  const trains=page.locator('.layer-elements-tree[aria-label="Elementos de Tren urbano"]');
  const nodes=page.locator('.layer-elements-tree[aria-label="Elementos de Nodos"]');
  await expect(trains.locator('[data-layer-feature]')).toHaveCount(2);
  await expect(nodes.locator('[data-layer-feature]')).toHaveCount(5);
  await page.locator('[data-expand-layer="subte"]').click();
  await expect(page.locator('.layer-elements-tree[aria-label="Elementos de Subte"]')).toHaveCount(0);
  await page.locator('[data-expand-layer="subte"]').click();
  await expect(page.locator('.layer-elements-tree[aria-label="Elementos de Subte"] [data-layer-feature]')).toHaveCount(3);
  await color(page,'urbano','#123abc');
  await expect(page.locator('.network-route-path[stroke="#123abc"]')).toHaveCount(2);
  await color(page,'nodos','#11aa66');
  await expect(page.locator('.node-trasbordo > span').first()).toHaveCSS('border-top-color','rgb(17, 170, 102)');
  await nodes.locator('[data-feature-visibility]').first().click();
  await expect(page.locator('.node-marker')).toHaveCount(4);
  await trains.locator('[data-feature-visibility]').first().click();
  await expect(page.locator('.network-route-path[stroke="#123abc"]')).toHaveCount(1);
  await expect(page.locator('#save-status')).toHaveText('Guardado en el repositorio');
  const stored=JSON.parse(await readFile(projectFile(),'utf8'));
  expect(stored.layerColors).toEqual({urbano:'#123abc',nodos:'#11aa66'});
  expect(Object.keys(stored.featureVisibility)).toHaveLength(2);
  await page.reload();
  await expect(page.locator('[data-layer-color="urbano"]')).toHaveValue('#123abc');
  await expect(page.locator('.node-marker')).toHaveCount(4);
  await expect(trains.locator('[data-feature-visibility]').first()).toHaveAttribute('aria-checked','false');
  await trains.locator('[data-layer-feature]').last().click();
  await expect(page.locator('.selected-route-path')).toHaveAttribute('stroke','#d02670');
  await page.locator('[data-action="close-inspector"]').click();
  await expect(page.locator('.network-route-path[stroke="#123abc"]')).toHaveCount(1);
  await page.locator('[data-action="export"]').click();
  const downloaded=page.waitForEvent('download'); await page.locator('[data-action="download-kml"]').click();
  const xml=await readFile(await (await downloaded).path(),'utf8');
  expect(xml).toContain('<color>ffbc3a12</color>');
  expect(xml).toContain('trama_layer_colors');
});

test('all elements are reachable beyond the initial tree and list pages',async ({page}) => {
  const project=emptyProject();
  project.features=Array.from({length:260},(_,i)=>({id:`node-${i}`,name:`Nodo ${i+1}`,layer:'nodos',nodeType:'destino',geometry:{type:'Point',coordinates:[-58.4+i/100000,-34.6]}}));
  project.features.push(...Array.from({length:105},(_,i)=>({id:`bus-${i}`,name:`Ramal ${i+1}`,busLine:'Línea 59',layer:'local',geometry:{type:'LineString',coordinates:[[-58.4,-34.6],[-58.39,-34.59]]}})));
  await openProject(page,project);
  const nodes=page.locator('.layer-elements-tree[aria-label="Elementos de Nodos"]');
  await expect(nodes.locator('[data-layer-feature]')).toHaveCount(100);
  await nodes.locator('[data-tree-more]').click(); await expect(nodes.locator('[data-layer-feature]')).toHaveCount(200);
  await nodes.locator('[data-tree-more]').click(); await expect(nodes.locator('[data-layer-feature]')).toHaveCount(260);
  await expect(nodes.locator('[data-tree-more]')).toHaveCount(0);
  const buses=page.locator('.bus-layer-tree[aria-label="Líneas de Colectivo local"]');
  await buses.locator('[data-expand-line]').click();
  await expect(buses.locator('[data-group-feature]')).toHaveCount(100);
  await buses.locator('[data-tree-more]').click(); await expect(buses.locator('[data-group-feature]')).toHaveCount(105);
  await expect(page.locator('#route-list [data-feature]')).toHaveCount(250);
  await page.locator('[data-action="list-more"]').click();
  await expect(page.locator('#route-list [data-feature]')).toHaveCount(365);
  await expect(page.locator('[data-action="list-more"]')).toHaveCount(0);
  await nodes.locator('[data-layer-feature]').last().click();
  await expect(page.locator('.inspector-name h2')).toHaveText('Nodo 260');
});
