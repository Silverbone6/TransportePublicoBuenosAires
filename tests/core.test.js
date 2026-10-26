import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { parseKML, exportKML } from '../src/kml.js';
import { length, nearestOnLine, splitLine, extractLine } from '../src/geometry.js';
import { emptyProject, validateProject, normalizeBusLine, inferBusLine, busLineFor, busGroupKey, groupBusFeatures, isFeatureVisible, revealFeature, layerColor, layerById } from '../src/model.js';
import { createDemo } from '../src/demo.js';

const Parser = new JSDOM('').window.DOMParser;
const kml = (content) => `<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2"><Document>${content}</Document></kml>`;
const route = '<LineString><coordinates>-58.5,-34.6 -58.45,-34.6 -58.4,-34.6 -58.35,-34.6</coordinates></LineString>';
const parse = (text, opts = {}) => parseKML(text, { Parser, ...opts });

test('KML import recognizes folders, expands MultiGeometry, and sends points to Nodos', () => {
  const result = parse(kml(`<Folder><name>Colectivo troncal</name><Placemark><name>Línea 59</name><MultiGeometry>${route}${route}<Point><coordinates>-58.4,-34.6,10</coordinates></Point></MultiGeometry></Placemark></Folder>`));
  assert.equal(result.features.length, 3);
  assert.deepEqual(result.features.map((f) => f.layer), ['troncal', 'troncal', 'nodos']);
  assert.equal(new Set(result.features.map((f) => f.id)).size, 3);
  assert.deepEqual(result.features[2].geometry.coordinates, [-58.4,-34.6]);
  assert.equal(result.features[2].nodeType, 'trasbordo');
});

test('folder inference can be disabled and default layer applied', () => {
  const content = kml(`<Folder><name>Subte</name><Placemark>${route}</Placemark></Folder>`);
  assert.equal(parse(content).features[0].layer, 'subte');
  assert.equal(parse(content, { inferLayers: false, defaultLayer: 'local' }).features[0].layer, 'local');
});

test('KML parser supports namespace prefixes and gx:Track', () => {
  const result = parse('<k:kml xmlns:k="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2"><k:Placemark><k:name>Tren</k:name><gx:Track><gx:coord>-58.5 -34.6 0</gx:coord><gx:coord>-58.4 -34.6 0</gx:coord></gx:Track></k:Placemark></k:kml>');
  assert.equal(result.features[0].name, 'Tren');
  assert.equal(result.features[0].geometry.coordinates.length, 2);
});

test('invalid geometries are omitted without joining over bad coordinates', () => {
  const result = parse(kml(`<Placemark>${route}</Placemark><Placemark><LineString><coordinates>-58.5,-34.6 nope -58.3,-34.6</coordinates></LineString></Placemark><Placemark><Polygon/></Placemark>`));
  assert.equal(result.features.length, 1);
  assert.equal(result.skipped, 2);
  assert.throws(() => parse('<kml><broken></kml>'), /válido/);
  assert.throws(() => parse(kml('<Placemark><Point><coordinates>181,5</coordinates></Point></Placemark>')), /válidos/);
  assert.throws(() => parse(kml(`<Placemark>${route}</Placemark>`), { defaultLayer: 'nodos' }), /válida/);
});

test('project KML export round trips categories, notes, names, coordinates and node types', () => {
  const project = createDemo(); project.name = 'Red & <Buenos Aires>';
  project.features[0].name = '<script>alert("a")</script> & tren';
  project.features[0].description = 'Notas & <referencias>';
  const xml = exportKML(project);
  assert.ok(xml.includes('&lt;script&gt;'));
  const result = parse(xml);
  assert.equal(result.features.length, project.features.length);
  for (const f of project.features) {
    const restored = result.features.find((p) => p.name === f.name);
    assert.ok(restored); assert.equal(restored.layer, f.layer); assert.deepEqual(restored.geometry, f.geometry);
    assert.equal(restored.description, f.description); assert.equal(restored.nodeType, f.nodeType);
  }
  assert.ok(parse(exportKML(project, 'nodos')).features.every((f) => f.layer === 'nodos'));
});

test('split projects onto segment interiors, preserves continuity and total length', () => {
  const coords = [[-58.5,-34.6],[-58.45,-34.6],[-58.4,-34.6],[-58.35,-34.6]];
  const cut = nearestOnLine(coords, [-58.425,-34.601]);
  assert.ok(Math.abs(cut.position - 1.5) < 1e-9);
  const [a,b] = splitLine(coords, cut.position);
  assert.deepEqual(a.at(-1), b[0]);
  assert.deepEqual(a[0], coords[0]); assert.deepEqual(b.at(-1), coords.at(-1));
  assert.ok(Math.abs(length(a) + length(b) - length(coords)) < 1e-5);
  assert.throws(() => splitLine(coords, 0), /inicio/);
  assert.throws(() => splitLine(coords, 3), /inicio/);
});

test('crop works in either click order, keeps remainders, handles vertices and rejects empty spans', () => {
  const coords = [[0,0],[1,0],[2,0],[3,0]];
  const { before, middle, after } = extractLine(coords, 2.5, .5);
  assert.deepEqual(before, [[0,0],[.5,0]]);
  assert.deepEqual(middle, [[.5,0],[1,0],[2,0],[2.5,0]]);
  assert.deepEqual(after, [[2.5,0],[3,0]]);
  assert.ok(Math.abs(length(before) + length(middle) + length(after) - length(coords)) < 1e-6);
  assert.deepEqual(extractLine(coords, 0, 3), { before: null, middle: coords, after: null });
  assert.throws(() => extractLine(coords, 1, 1), /diferentes/);
  assert.throws(() => extractLine(coords, 1, 1.000000001), /metro/);
});

test('project validation rejects malformed backups, duplicate IDs and mismatched geometry categories', () => {
  const p = createDemo(); assert.equal(validateProject(p).features.length, 16);
  assert.deepEqual(validateProject(emptyProject()), emptyProject());
  assert.throws(() => validateProject({ ...p, version: 2 }), /compatible/);
  assert.throws(() => validateProject({ ...p, features: [p.features[0], p.features[0]] }), /repetidos/);
  assert.throws(() => validateProject({ ...p, features: [{ ...p.features[0], layer: 'nodos' }] }), /puntos/);
  assert.throws(() => validateProject({ ...p, features: [{ ...p.features[0], geometry: { type: 'LineString', coordinates: [[NaN,2],[3,4]] } }] }), /coordenadas/);
});

test('bus folders infer and normalize line numbers while respecting manual assignments', () => {
  assert.equal(normalizeBusLine(' 059 '), 'Línea 59');
  assert.equal(normalizeBusLine('linea_152'), 'Línea 152');
  assert.equal(inferBusLine('59 · Ida'), 'Línea 59');
  assert.equal(inferBusLine('Recorrido sin referencia', 'linea_067.kml'), 'Línea 67');
  assert.equal(inferBusLine('Sin número'), '');
  assert.equal(busLineFor({ name: 'Línea 59', busLine: '' }), '');
  const result = parse(kml(`<Folder><name>Colectivo local</name><Folder><name>Línea 059</name><Placemark><name>Ida</name>${route}</Placemark><Placemark><name>Vuelta</name>${route}</Placemark></Folder><Placemark><name>Sin referencia</name>${route}</Placemark></Folder>`));
  const groups = groupBusFeatures(result.features, 'local');
  assert.deepEqual(groups.map((g) => [g.label,g.features.length]), [['Línea 59',2],['Sin línea asignada',1]]);
});

test('older projects acquire bus folders and line visibility is independent in each layer', () => {
  const old = createDemo(); delete old.lineVisibility;
  old.features.forEach((f) => { delete f.busLine; });
  const project = validateProject(old);
  const bus = project.features.find((f) => f.layer === 'troncal');
  assert.equal(bus.busLine, 'Línea 59');
  const local = { ...structuredClone(bus), id: 'local59', layer: 'local' };
  project.features.push(local);
  project.lineVisibility[busGroupKey('local','59')] = false;
  assert.equal(isFeatureVisible(project, local), false);
  assert.equal(isFeatureVisible(project, bus), true);
  project.visibility.local = false;
  revealFeature(project, local);
  assert.equal(isFeatureVisible(project, local), true);
  project.lineVisibility[busGroupKey('local','59')] = false;
  const restored = validateProject(JSON.parse(JSON.stringify(project)));
  assert.equal(isFeatureVisible(restored, restored.features.find((f) => f.id === local.id)), false);
  assert.equal(restored.features.find((f) => f.id === local.id).busLine,'Línea 59');
});

test('nested KML bus folders preserve custom line names, unassigned routes and visibility on round trip', () => {
  const project = createDemo();
  const bus = project.features.find((f) => f.layer === 'local');
  bus.busLine = 'Expreso & <Norte>';
  const unassigned = project.features.find((f) => f.layer === 'troncal'); unassigned.busLine = '';
  project.lineVisibility[busGroupKey(bus.layer,bus.busLine)] = false;
  const xml = exportKML(project);
  assert.ok(xml.includes('<Folder><name>Expreso &amp; &lt;Norte&gt;</name><visibility>0</visibility>'));
  assert.ok(xml.includes('<Folder><name>Sin línea asignada</name>'));
  const parsed = parse(xml);
  assert.equal(parsed.features.find((f) => f.name === bus.name).busLine, bus.busLine);
  assert.equal(parsed.features.find((f) => f.name === unassigned.name).busLine, '');
  assert.equal(parsed.lineVisibility[busGroupKey(bus.layer,bus.busLine)],false);
  assert.equal(parsed.features.length,project.features.length);
});

test('layer colors are project-specific, validate safely and support older projects', () => {
  const original = emptyProject(); delete original.layerColors; delete original.featureVisibility;
  const migrated = validateProject(original);
  assert.equal(layerColor(migrated,'subte'),layerById('subte').color);
  migrated.layerColors.subte = '#12AB34';
  const restored = validateProject(JSON.parse(JSON.stringify(migrated)));
  assert.equal(layerColor(restored,'subte'),'#12ab34');
  assert.equal(layerColor(emptyProject(),'subte'),layerById('subte').color);
  assert.throws(() => validateProject({...original,layerColors:{subte:'red;display:none'}}), /color/);
});

test('individual visibility works for routes and nodes and respects parent layers', () => {
  const project = createDemo();
  const train = project.features.find((f) => f.layer === 'urbano');
  const node = project.features.find((f) => f.layer === 'nodos');
  project.featureVisibility[train.id] = false;
  project.featureVisibility[node.id] = false;
  assert.equal(isFeatureVisible(project,train),false);
  assert.equal(isFeatureVisible(project,node),false);
  const restored = validateProject(JSON.parse(JSON.stringify(project)));
  assert.equal(restored.featureVisibility[train.id],false);
  project.visibility.urbano = false;
  revealFeature(project,train);
  assert.equal(isFeatureVisible(project,train),true);
  assert.equal(isFeatureVisible(project,node),false);
});

test('custom colors and hidden elements survive KML export and reimport', () => {
  const project = createDemo();
  project.layerColors = {urbano:'#12ab34',nodos:'#11aa66'};
  const node = project.features.find((f) => f.layer === 'nodos');
  const train = project.features.find((f) => f.layer === 'urbano');
  project.featureVisibility[node.id] = false;
  project.featureVisibility[train.id] = false;
  const xml = exportKML(project);
  assert.ok(xml.includes('<color>ff34ab12</color>'));
  const restored = parse(xml);
  assert.deepEqual(restored.layerColors,project.layerColors);
  assert.equal(restored.featureVisibility[restored.features.find((f) => f.name === node.name).id],false);
  assert.equal(restored.featureVisibility[restored.features.find((f) => f.name === train.name).id],false);
  assert.deepEqual(parse(exportKML(project,'nodos')).layerColors,{nodos:'#11aa66'});
});
