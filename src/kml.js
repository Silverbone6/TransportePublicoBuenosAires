import { LAYERS, NODE_TYPES, uid, validCoordinate, escapeHTML } from './model.js';
const elements = (el, name) => Array.from(el.getElementsByTagNameNS('*', name));
const directText = (el, name) => Array.from(el.childNodes).find((n) => n.localName === name)?.textContent?.trim() || '';
const normal = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
function inferredLayer(placemark) {
  let el = placemark.parentNode;
  while (el?.nodeType === 1) {
    if (el.localName === 'Folder') {
      const label = normal(directText(el, 'name'));
      const layer = LAYERS.find((l) => normal(l.name) === label || l.id === label);
      if (layer && layer.id !== 'nodos') return layer.id;
    }
    el = el.parentNode;
  }
  return null;
}
function readCoordinates(text) {
  if (!text.trim()) return [];
  return text.trim().split(/\s+/).map((tuple) => {
    const raw = tuple.split(',');
    if (raw.length < 2 || !raw[0].trim() || !raw[1].trim()) throw new Error('Coordenada incompleta');
    const c = raw.map(Number);
    if (!validCoordinate(c)) throw new Error('Coordenada inválida');
    return c.slice(0, 2);
  });
}
export function parseKML(text, { defaultLayer = 'local', source = 'Archivo KML', inferLayers = true, Parser = globalThis.DOMParser } = {}) {
  if (!LAYERS.some((l) => l.id === defaultLayer && l.id !== 'nodos')) throw new Error('Elegí una capa de transporte válida.');
  const xml = new Parser().parseFromString(text, 'application/xml');
  if (elements(xml, 'parsererror').length || !xml.documentElement || xml.documentElement.localName !== 'kml') throw new Error('El archivo no es un KML válido. Revisá su formato XML.');
  const features = [];
  let skipped = 0;
  for (const placemark of elements(xml, 'Placemark')) {
    const name = directText(placemark, 'name').slice(0, 480) || 'Sin nombre';
    const description = directText(placemark, 'description').slice(0, 10000);
    const data = Object.fromEntries(elements(placemark, 'Data').map((d) => [d.getAttribute('name'), elements(d, 'value')[0]?.textContent || '']));
    const storedLayer = LAYERS.find((l) => l.id === data.trama_layer && l.id !== 'nodos')?.id;
    const layer = inferLayers ? storedLayer || inferredLayer(placemark) || defaultLayer : defaultLayer;
    const geometries = [...elements(placemark, 'LineString'), ...elements(placemark, 'Point'), ...elements(placemark, 'Track')];
    if (!geometries.length) { skipped++; continue; }
    geometries.forEach((g, index) => {
      try {
        const coords = g.localName === 'Track'
          ? elements(g, 'coord').map((c) => c.textContent.trim().split(/\s+/).map(Number).slice(0, 2))
          : readCoordinates(elements(g, 'coordinates')[0]?.textContent || '');
        const isPoint = g.localName === 'Point';
        if (coords.length < (isPoint ? 1 : 2) || (isPoint && coords.length !== 1) || !coords.every(validCoordinate)) throw new Error('Geometría inválida');
        features.push({ id: uid(), name: geometries.length > 1 ? `${name} · ${index + 1}` : name, description, source, layer: isPoint ? 'nodos' : layer, geometry: { type: isPoint ? 'Point' : 'LineString', coordinates: isPoint ? coords[0] : coords }, ...(isPoint ? { nodeType: Object.hasOwn(NODE_TYPES, data.trama_node_type) ? data.trama_node_type : 'trasbordo' } : {}) });
      } catch { skipped++; }
    });
  }
  if (!features.length) throw new Error('No encontramos recorridos ni puntos válidos. Se admiten LineString, MultiGeometry, Point y gx:Track.');
  return { features, skipped };
}
function kmlColor(hex) { return `ff${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}`; }
export function exportKML(project, onlyLayer = null) {
  const layers = LAYERS.filter((l) => !onlyLayer || l.id === onlyLayer);
  const styles = layers.map((l) => `<Style id="${l.id}"><LineStyle><color>${kmlColor(l.color)}</color><width>4</width></LineStyle><IconStyle><color>${kmlColor(l.color)}</color><scale>1.1</scale></IconStyle></Style>`).join('');
  const folders = layers.map((l) => `<Folder><name>${escapeHTML(l.name)}</name>${project.features.filter((f) => f.layer === l.id).map((f) => {
    const point = f.geometry.type === 'Point';
    const coordinates = (point ? [f.geometry.coordinates] : f.geometry.coordinates).map((c) => `${c[0]},${c[1]},0`).join(' ');
    return `<Placemark><name>${escapeHTML(f.name)}</name><description>${escapeHTML(f.description || '')}</description><styleUrl>#${l.id}</styleUrl><ExtendedData><Data name="trama_layer"><value>${l.id}</value></Data>${point ? `<Data name="trama_node_type"><value>${escapeHTML(f.nodeType || 'trasbordo')}</value></Data>` : ''}</ExtendedData><${point ? 'Point' : 'LineString'}>${point ? '' : '<tessellate>1</tessellate>'}<coordinates>${coordinates}</coordinates></${point ? 'Point' : 'LineString'}></Placemark>`;
  }).join('')}</Folder>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeHTML(project.name)}</name>${styles}${folders}</Document></kml>`;
}
