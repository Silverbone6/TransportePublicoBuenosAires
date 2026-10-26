export const LAYERS = [
  { id: 'regional', name: 'Tren regional', color: '#6751a5', icon: 'train-front', short: 'REG' },
  { id: 'urbano', name: 'Tren urbano', color: '#3b78ae', icon: 'train-front', short: 'URB' },
  { id: 'subte', name: 'Subte', color: '#dfad30', icon: 'tram-front', short: 'SUB' },
  { id: 'tranvia', name: 'Tranvía', color: '#cb6d84', icon: 'tram-front', short: 'TRA' },
  { id: 'troncal', name: 'Colectivo troncal', color: '#148577', icon: 'bus-front', short: 'TRC' },
  { id: 'local', name: 'Colectivo local', color: '#e48645', icon: 'bus-front', short: 'LOC' },
  { id: 'nodos', name: 'Nodos', color: '#4c6073', icon: 'waypoints', short: 'NOD' },
];
export const NODE_TYPES = { trasbordo: 'Trasbordo', combinacion: 'Combinación', destino: 'Destino' };
export const layerById = (id) => LAYERS.find((l) => l.id === id);
export const uid = () => crypto.randomUUID();
export const clone = (data) => structuredClone(data);
export const emptyProject = () => ({ version: 1, name: 'Red de Buenos Aires', features: [], visibility: Object.fromEntries(LAYERS.map((l) => [l.id, true])) });
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
    return { id: f.id, name: f.name, layer: f.layer, geometry: { type: g.type, coordinates: clone(g.coordinates) }, description: String(f.description || '').slice(0, 10000), source: String(f.source || '').slice(0, 500), ...(g.type === 'Point' ? { nodeType: Object.hasOwn(NODE_TYPES, f.nodeType) ? f.nodeType : 'trasbordo' } : {}) };
  });
  return { version: 1, name: value.name, features, visibility: Object.fromEntries(LAYERS.map((l) => [l.id, value.visibility?.[l.id] !== false])) };
}
