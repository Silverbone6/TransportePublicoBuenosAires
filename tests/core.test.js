import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { parseKML, exportKML } from '../src/kml.js';
import { length, nearestOnLine, splitLine, extractLine } from '../src/geometry.js';
import { emptyProject, validateProject } from '../src/model.js';
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
