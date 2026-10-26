export const LAYERS = [
  { id: 'regional', name: 'Tren regional', color: '#6751a5', icon: 'train-front', short: 'REG' },
  { id: 'urbano', name: 'Tren urbano', color: '#3b78ae', icon: 'train-front', short: 'URB' },
  { id: 'subte', name: 'Subte', color: '#dfad30', icon: 'tram-front', short: 'SUB' },
  { id: 'tranvia', name: 'Tranvía', color: '#cb6d84', icon: 'tram-front', short: 'TRA' },
  { id: 'troncal', name: 'Colectivo troncal', color: '#148577', icon: 'bus-front', short: 'TRC' },
  { id: 'local', name: 'Colectivo local', color: '#e48645', icon: 'bus-front', short: 'LOC' },
  { id: 'suprimir', name: 'Colectivos a suprimir', color: '#bc5252', icon: 'bus-front', short: 'SUP' },
  { id: 'nodos', name: 'Nodos', color: '#4c6073', icon: 'waypoints', short: 'NOD' },
];
export const NODE_TYPES = { trasbordo: 'Trasbordo', combinacion: 'Combinación', destino: 'Destino' };
export const BUS_LAYERS = ['troncal', 'local', 'suprimir'];
export const isBusLayer = (layer) => BUS_LAYERS.includes(layer);
export const validLayerColor = (color) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color);
export const layerColor = (project, id) => validLayerColor(project.layerColors?.[id]) ? project.layerColors[id] : layerById(id)?.color;
export function normalizeLayerColors(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Los colores de las capas deben tener un formato válido.');
  return Object.fromEntries(LAYERS.filter((l) => Object.hasOwn(value, l.id)).map((l) => {
    if (!validLayerColor(value[l.id])) throw new Error(`El color de ${l.name} debe tener formato #RRGGBB.`);
    return [l.id, value[l.id].toLowerCase()];
  }));
}
export function normalizeBusLine(value = '') {
  const text = String(value).trim().replace(/\s+/g, ' ');
  const match = text.match(/^(?:l[ií]nea[\s_.-]*)?(\d+)([a-z]?)$/i);
  return (match ? `Línea ${match[1].replace(/^0+(?=\d)/, '')}${match[2].toUpperCase()}` : text).slice(0, 200);
}
export function inferBusLine(...candidates) {
  for (const candidate of candidates) {
    const text = String(candidate || '').trim();
    const match = text.match(/\bl[ií]nea[\s_.-]*(\d+[a-z]?)(?=$|[\s_.:/–—-])/i) || text.match(/^(\d+[a-z]?)(?=$|[\s_.:/–—-])/i);
    if (match) return normalizeBusLine(match[1]);
  }
  return '';
}
export const busLineFor = (feature) => Object.hasOwn(feature, 'busLine') ? normalizeBusLine(feature.busLine) : inferBusLine(feature.name, feature.source);
export const busGroupKey = (layer, line) => JSON.stringify([layer, normalizeBusLine(line).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()]);
export function groupBusFeatures(features, layer) {
  const groups = new Map();
  for (const f of features) {
    if (!isBusLayer(f.layer) || (layer && f.layer !== layer)) continue;
    const line = busLineFor(f), key = busGroupKey(f.layer, line);
    if (!groups.has(key)) groups.set(key, { key, layer: f.layer, line, label: line || 'Sin línea asignada', features: [] });
    groups.get(key).features.push(f);
  }
  return [...groups.values()].sort((a, b) => Number(!a.line) - Number(!b.line) || a.label.localeCompare(b.label, 'es', { numeric: true, sensitivity: 'base' }));
}
export const isFeatureVisible = (project, f) => project.visibility[f.layer] !== false && project.featureVisibility?.[f.id] !== false && (!isBusLayer(f.layer) || project.lineVisibility?.[busGroupKey(f.layer, busLineFor(f))] !== false);
export function revealFeature(project, f) {
  project.visibility[f.layer] = true;
  delete (project.featureVisibility ||= {})[f.id];
  if (isBusLayer(f.layer)) delete (project.lineVisibility ||= {})[busGroupKey(f.layer, busLineFor(f))];
}
export const layerById = (id) => LAYERS.find((l) => l.id === id);
export const uid = () => crypto.randomUUID();
export const clone = (data) => structuredClone(data);
export const emptyProject = () => ({ version: 1, name: 'Red de Buenos Aires', features: [], visibility: Object.fromEntries(LAYERS.map((l) => [l.id, true])), lineVisibility: {}, layerColors: {}, featureVisibility: {} });
export const escapeHTML = (text = '') => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export function validCoordinate(c) {
  return Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;
}
export function validateProject(value) {
  if (!value || value.version !== 1 || typeof value.name !== 'string' || value.name.length > 200 || !Array.isArray(value.features)) throw new Error('Este archivo no es un proyecto Trama compatible (versión 1).');
  const ids = new Set();
  const features = value.features.map((f) => {
    if (!f || typeof f.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(f.id) || ids.has(f.id) || typeof f.name !== 'string' || f.name.length > 500 || !layerById(f.layer)) throw new Error('El proyecto contiene elementos inválidos o identificadores repetidos.');
    ids.add(f.id);
    const g = f.geometry;
    if (!g || !['Point', 'LineString'].includes(g.type)) throw new Error('El proyecto contiene una geometría no compatible.');
    const coords = g.type === 'Point' ? [g.coordinates] : g.coordinates;
    if (!Array.isArray(coords) || coords.length < (g.type === 'Point' ? 1 : 2) || !coords.every(validCoordinate)) throw new Error('El proyecto contiene coordenadas inválidas.');
    if ((g.type === 'Point') !== (f.layer === 'nodos')) throw new Error('Los puntos deben estar en Nodos y los recorridos en una capa de transporte.');
    if (Object.hasOwn(f, 'busLine') && (typeof f.busLine !== 'string' || f.busLine.length > 200)) throw new Error('El proyecto contiene un nombre de línea inválido.');
    return { id: f.id, name: f.name, layer: f.layer, geometry: { type: g.type, coordinates: clone(g.coordinates) }, description: String(f.description || '').slice(0, 10000), source: String(f.source || '').slice(0, 500), ...(g.type === 'Point' ? { nodeType: Object.hasOwn(NODE_TYPES, f.nodeType) ? f.nodeType : 'trasbordo' } : {}), ...((isBusLayer(f.layer) || Object.hasOwn(f, 'busLine')) ? { busLine: busLineFor(f) } : {}) };
  });
  const lineVisibility = Object.fromEntries(groupBusFeatures(features).filter((g) => value.lineVisibility?.[g.key] === false).map((g) => [g.key, false]));
  const featureVisibility = Object.fromEntries(features.filter((f) => value.featureVisibility?.[f.id] === false).map((f) => [f.id, false]));
  return { version: 1, name: value.name, features, visibility: Object.fromEntries(LAYERS.map((l) => [l.id, value.visibility?.[l.id] !== false])), lineVisibility, layerColors: normalizeLayerColors(value.layerColors), featureVisibility };
}
