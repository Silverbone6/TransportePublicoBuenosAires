const R = 6371.0088;
const rad = (n) => n * Math.PI / 180;
export function distance(a, b) {
  const p1 = rad(a[1]), p2 = rad(b[1]);
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(rad(b[0] - a[0]) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function length(coords) { return coords.slice(1).reduce((sum, p, i) => sum + distance(coords[i], p), 0); }
export function formatLength(km) { return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString('es-AR', { maximumFractionDigits: 1 })} km`; }
export function nearestOnLine(coords, point) {
  const scale = Math.cos(rad(point[1]));
  let best = null;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i], b = coords[i + 1];
    const dx = (b[0] - a[0]) * scale, dy = b[1] - a[1];
    const den = dx * dx + dy * dy;
    const t = den === 0 ? 0 : Math.max(0, Math.min(1, (((point[0] - a[0]) * scale * dx) + (point[1] - a[1]) * dy) / den));
    const coordinate = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const d = ((point[0] - coordinate[0]) * scale) ** 2 + (point[1] - coordinate[1]) ** 2;
    if (!best || d < best.distanceSquared) best = { index: i, t, coordinate, position: i + t, distanceSquared: d };
  }
  return best;
}
function atPosition(coords, position) {
  const i = Math.min(coords.length - 2, Math.floor(position));
  const t = position - i;
  return [coords[i][0] + (coords[i + 1][0] - coords[i][0]) * t, coords[i][1] + (coords[i + 1][1] - coords[i][1]) * t];
}
export function sliceLine(coords, start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > coords.length - 1 || end <= start) throw new Error('Elegí dos puntos diferentes dentro del recorrido.');
  const points = [atPosition(coords, start)];
  for (let i = Math.floor(start) + 1; i < end; i++) points.push([...coords[i]]);
  points.push(atPosition(coords, end));
  return points.filter((p, i, a) => i === 0 || distance(a[i - 1], p) > 0.0000001);
}
export function splitLine(coords, position) {
  if (position <= 0.000001 || position >= coords.length - 1 - 0.000001) throw new Error('El corte debe estar entre el inicio y el final del recorrido.');
  const pieces = [sliceLine(coords, 0, position), sliceLine(coords, position, coords.length - 1)];
  if (pieces.some((p) => p.length < 2 || length(p) < 0.001)) throw new Error('El corte deja un tramo de menos de un metro. Elegí otro punto.');
  return pieces;
}
export function extractLine(coords, first, second) {
  const [start, end] = [first, second].sort((a, b) => a - b);
  const middle = sliceLine(coords, start, end);
  if (middle.length < 2 || length(middle) < 0.001) throw new Error('El tramo debe medir al menos un metro.');
  const before = start > 0.000001 ? sliceLine(coords, 0, start) : null;
  const after = end < coords.length - 1 - 0.000001 ? sliceLine(coords, end, coords.length - 1) : null;
  return { before: before?.length >= 2 ? before : null, middle, after: after?.length >= 2 ? after : null };
}
