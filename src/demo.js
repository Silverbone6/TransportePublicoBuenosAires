import { emptyProject, uid, isBusLayer, inferBusLine } from './model.js';
export function createDemo() {
  const p = emptyProject();
  p.name = 'Ejemplo · Buenos Aires';
  const line = (name, layer, coords) => ({ id: uid(), name, layer, ...(isBusLayer(layer) ? { busLine: inferBusLine(name) } : {}), source: 'Ejemplo ilustrativo · No usar para viajar', description: 'Trazado simplificado de demostración; no representa un servicio oficial ni su recorrido preciso.', geometry: { type: 'LineString', coordinates: coords.map(([lat, lng]) => [lng, lat]) } });
  p.features = [
    line('Mitre · Retiro – Tigre', 'regional', [[-34.5908,-58.3747],[-34.5675,-58.4084],[-34.5505,-58.438],[-34.5358,-58.4698],[-34.5105,-58.489],[-34.4749,-58.515],[-34.425,-58.579]]),
    line('Roca · Constitución – Avellaneda', 'urbano', [[-34.627,-58.3816],[-34.643,-58.3789],[-34.6517,-58.3863],[-34.665,-58.375],[-34.683,-58.359]]),
    line('Sarmiento · Once – Liniers', 'urbano', [[-34.6083,-58.407],[-34.6109,-58.426],[-34.619,-58.449],[-34.629,-58.474],[-34.636,-58.501],[-34.639,-58.527]]),
    line('Línea B · Alem – Rosas', 'subte', [[-34.602,-58.370],[-34.6034,-58.3807],[-34.6043,-58.392],[-34.6048,-58.411],[-34.598,-58.431],[-34.587,-58.455],[-34.581,-58.486]]),
    line('Línea D · Catedral – Congreso', 'subte', [[-34.608,-58.3735],[-34.604,-58.381],[-34.599,-58.393],[-34.594,-58.403],[-34.588,-58.412],[-34.578,-58.425],[-34.565,-58.443],[-34.555,-58.462]]),
    line('Línea A · Plaza de Mayo – Flores', 'subte', [[-34.6088,-58.3714],[-34.609,-58.3816],[-34.609,-58.393],[-34.609,-58.406],[-34.615,-58.429],[-34.623,-58.449],[-34.627,-58.461]]),
    line('Premetro · Saguier – Savio', 'tranvia', [[-34.643,-58.461],[-34.652,-58.462],[-34.665,-58.452],[-34.678,-58.448],[-34.683,-58.459]]),
    line('Línea 59 · Tramo troncal', 'troncal', [[-34.628,-58.381],[-34.619,-58.381],[-34.609,-58.381],[-34.603,-58.381],[-34.593,-58.382],[-34.582,-58.392],[-34.571,-58.407],[-34.562,-58.423],[-34.553,-58.441]]),
    line('Línea 152 · Tramo troncal', 'troncal', [[-34.633,-58.363],[-34.622,-58.37],[-34.613,-58.378],[-34.607,-58.386],[-34.597,-58.4],[-34.584,-58.415],[-34.573,-58.43],[-34.564,-58.447]]),
    line('Línea 39 · Ramal local', 'local', [[-34.626,-58.403],[-34.62,-58.407],[-34.612,-58.413],[-34.606,-58.42],[-34.601,-58.43],[-34.594,-58.436],[-34.588,-58.443]]),
    line('Línea 67 · Ramal local', 'local', [[-34.553,-58.441],[-34.55,-58.447],[-34.553,-58.458],[-34.56,-58.467],[-34.565,-58.474],[-34.569,-58.484]]),
  ];
  for (const [name, coordinates, nodeType] of [['Retiro',[-58.3747,-34.5908],'trasbordo'],['Constitución',[-58.3816,-34.627],'trasbordo'],['Once',[-58.407,-34.6083],'combinacion'],['Obelisco',[-58.381,-34.6034],'destino'],['Pacífico',[-58.425,-34.578],'combinacion']]) {
    p.features.push({ id: uid(), name, layer: 'nodos', nodeType, source: 'Ejemplo ilustrativo', description: '', geometry: { type: 'Point', coordinates } });
  }
  return p;
}
