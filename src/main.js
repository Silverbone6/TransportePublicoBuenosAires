import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { createIcons, ArrowUpRight, ArrowDownToLine, Upload, Layers, Pencil, Eye, EyeOff, Plus, Minus, LocateFixed, Map, Search, X, Check, ChevronDown, ChevronRight, TrainFront, TramFront, BusFront, Waypoints, MousePointer2, Scissors, Crop, Route, Undo2, Redo2, HelpCircle, FolderOpen, FileUp, Download, Trash2, MoveUpRight, CircleCheck, HardDrive, Network, MapPin, Grip, ExternalLink, LoaderCircle, Info, PanelLeftClose, Menu, Maximize2 } from 'lucide';
import { LAYERS, NODE_TYPES, uid, clone, emptyProject, escapeHTML as esc, layerById, validateProject } from './model.js';
import { length, formatLength, nearestOnLine, splitLine, extractLine } from './geometry.js';
import { parseKML, exportKML } from './kml.js';
import { loadProject, saveProject } from './storage.js';
import { createDemo } from './demo.js';
import './style.css';

const icons = { ArrowUpRight, ArrowDownToLine, Upload, Layers, Pencil, Eye, EyeOff, Plus, Minus, LocateFixed, Map, Search, X, Check, ChevronDown, ChevronRight, TrainFront, TramFront, BusFront, Waypoints, MousePointer2, Scissors, Crop, Route, Undo2, Redo2, HelpCircle, FolderOpen, FileUp, Download, Trash2, MoveUpRight, CircleCheck, HardDrive, Network, MapPin, Grip, ExternalLink, LoaderCircle, Info, PanelLeftClose, Menu, Maximize2 };
const icon = (name, cls = '') => `<i data-lucide="${name}" class="${cls}" aria-hidden="true"></i>`;
const refreshIcons = () => createIcons({ icons, attrs: { 'stroke-width': 1.7 } });
const $ = (selector) => document.querySelector(selector);
let project = emptyProject();
let mode = 'explore', selectedId = null, filter = 'all', query = '', tool = null, cuts = [], vertexDirty = false;
let undoStack = [], redoStack = [], checked = new Set(), mapLayers = new globalThis.Map(), editLayer = null;
let revision = 0, savedRevision = 0, saveQueue = Promise.resolve(), storageError = false, loading = true;
let cutTarget = 'troncal', keepRemainder = true, base = 'light', importFiles = [], importBusy = false;
let baseLayer, previewGroup, lastTileError = 0;

$('#app').innerHTML = `
  <header class="app-header">
    <button class="mobile-menu icon-button" title="Abrir capas" aria-label="Abrir capas" data-action="sidebar">${icon('menu')}</button>
    <a class="brand" href="#" aria-label="Trama, inicio"><img src="/favicon.svg" alt=""/><span>trama<span class="brand-dot">.</span></span></a>
    <div class="project-heading"><span class="eyebrow">BUENOS AIRES</span><button id="project-title" data-action="rename-project" title="Cambiar nombre del proyecto">Red de Buenos Aires ${icon('chevron-down')}</button></div>
    <div class="mode-switch" aria-label="Modo de trabajo"><button data-mode="explore" class="active">${icon('map')}<span>Explorar</span></button><button data-mode="edit">${icon('pencil')}<span>Editar red</span></button></div>
    <div class="header-actions"><span class="local-badge"><span></span> LOCAL</span><button class="icon-button" data-action="help" title="Cómo usar Trama" aria-label="Cómo usar Trama">${icon('help-circle')}</button><button class="button secondary export-button" data-action="export">${icon('arrow-down-to-line')}<span>Exportar</span></button><button class="button primary import-button" data-action="import">${icon('plus')}<span>Importar KML</span></button></div>
  </header>
  <main class="workspace">
    <aside class="sidebar" aria-label="Capas y recorridos">
      <div class="sidebar-scroll">
        <div class="sidebar-title"><div><div class="eyebrow">TU ESPACIO DE TRABAJO</div><h1>La red, capa por capa<span>.</span></h1></div><button class="icon-button sidebar-close" data-action="sidebar" aria-label="Cerrar capas">${icon('x')}</button></div>
        <div class="section-heading"><h2>${icon('layers')} Capas de transporte</h2><button class="text-button" id="visibility-all" data-action="visibility-all">Ocultar todas</button></div>
        <nav id="layers-list" aria-label="Capas del mapa"></nav>
        <div class="layer-summary"><button class="text-button" data-action="all-routes" id="show-all">Ver toda la red ${icon('arrow-up-right')}</button><span>7 capas</span></div>
        <div class="routes-section"><div class="section-heading"><h2 id="list-heading">Elementos de la red <span id="list-count">0</span></h2><button class="icon-button" data-action="list-menu" aria-label="Opciones del proyecto" title="Opciones del proyecto">${icon('folder-open')}</button></div>
          <label class="search-box">${icon('search')}<input type="search" id="search" placeholder="Buscar línea o nodo…" autocomplete="off" aria-label="Buscar línea o nodo"/><kbd>/</kbd></label>
          <div id="batch-actions"></div><div id="route-list"></div>
        </div>
      </div>
      <div class="sidebar-footer"><span id="save-status" role="status">${icon('loader-circle')} Abriendo proyecto…</span><button class="text-button" data-action="help" aria-label="Información del guardado local">${icon('info')}</button></div>
    </aside>
    <section class="map-workspace" aria-label="Mapa de Buenos Aires">
      <div id="map"></div>
      <div class="map-heading"><span class="map-heading-mark">${icon('map-pin')}</span><div><span class="eyebrow">ÁREA METROPOLITANA</span><h2>Buenos Aires</h2></div><span class="map-heading-line"></span><span id="visible-count">0 elementos visibles</span></div>
      <div class="map-top-actions"><button class="map-button" data-action="base" title="Cambiar mapa base">${icon('map')}<span id="base-label">Mapa claro</span>${icon('chevron-down')}</button></div>
      <div class="map-controls"><button data-action="zoom-in" aria-label="Acercar" title="Acercar">${icon('plus')}</button><button data-action="zoom-out" aria-label="Alejar" title="Alejar">${icon('minus')}</button><span></span><button data-action="fit" aria-label="Encuadrar red" title="Encuadrar red">${icon('maximize-2')}</button><button data-action="home" aria-label="Volver a Buenos Aires" title="Volver a Buenos Aires">${icon('locate-fixed')}</button></div>
      <div id="editor-toolbar"></div><div id="inspector"></div><div id="welcome"></div><div id="tool-hint"></div>
      <div class="map-bottom"><span class="coordinate-readout" id="coordinates">34.6037° S &nbsp; 58.3816° O</span><span class="network-state" id="network-state"></span></div>
      <div class="history-controls"><button class="icon-button" data-action="undo" id="undo" title="Deshacer (Ctrl+Z)" aria-label="Deshacer" disabled>${icon('undo-2')}</button><button class="icon-button" data-action="redo" id="redo" title="Rehacer (Ctrl+Mayús+Z)" aria-label="Rehacer" disabled>${icon('redo-2')}</button><span>Historial</span></div>
    </section>
  </main>
  <dialog id="dialog" aria-labelledby="dialog-title"></dialog>
  <div class="toasts" aria-live="polite" id="toasts"></div>
  <input id="project-file" type="file" accept=".json,application/json" hidden/>
`;

const map = L.map('map', { zoomControl: false, attributionControl: true, minZoom: 3, maxZoom: 20, preferCanvas: false }).setView([-34.6037, -58.425], 12);
map.attributionControl.setPrefix(false);
L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 100 }).addTo(map);
previewGroup = L.layerGroup().addTo(map);
function setBase(value) {
  base = value;
  map.getContainer().classList.toggle('base-light', value === 'light');
  if (baseLayer) map.removeLayer(baseLayer);
  $('#network-state').textContent = '';
  if (value !== 'none') {
    baseLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20, maxNativeZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    });
    baseLayer.on('tileerror', () => {
      lastTileError = Date.now();
      $('#network-state').textContent = 'Mapa base sin conexión · Tus datos siguen disponibles';
    });
    baseLayer.on('tileload', () => { if (Date.now() - lastTileError > 5000) $('#network-state').textContent = ''; });
    baseLayer.addTo(map);
  } else { baseLayer = null; $('#network-state').textContent = 'Sin mapa base · Edición disponible sin conexión'; }
  $('#base-label').textContent = { light: 'Mapa claro', streets: 'Calles', none: 'Sin mapa base' }[value];
}
setBase('light');

function toast(message, error = false) {
  const el = document.createElement('div'); el.className = `toast ${error ? 'error' : ''}`;
  el.innerHTML = `${icon(error ? 'info' : 'circle-check')}<span>${esc(message)}</span><button class="icon-button" aria-label="Cerrar aviso">${icon('x')}</button>`;
  el.querySelector('button').onclick = () => el.remove();
  $('#toasts').append(el); refreshIcons(); setTimeout(() => el.remove(), error ? 10000 : 5500);
}
function selected() { return project.features.find((f) => f.id === selectedId); }
function routeOptions(value, includeNodes = false) { return LAYERS.filter((l) => includeNodes || l.id !== 'nodos').map((l) => `<option value="${l.id}" ${value === l.id ? 'selected' : ''}>${l.name}</option>`).join(''); }
function persist() {
  const snap = clone(project), current = ++revision;
  $('#save-status').innerHTML = `${icon('loader-circle')} Guardando…`; refreshIcons();
  saveQueue = saveQueue.catch(() => {}).then(() => saveProject(snap)).then(() => {
    savedRevision = current;
    if (current === revision) { $('#save-status').innerHTML = `${icon('hard-drive')} Guardado en este navegador`; refreshIcons(); storageError = false; }
  }).catch(() => {
    $('#save-status').innerHTML = `${icon('info')} No se pudo guardar`; refreshIcons();
    if (!storageError) toast('No se pudo guardar en el navegador. Exportá el proyecto para conservar tu trabajo.', true);
    storageError = true;
  });
}
function mutate(fn, { fit = false, fields = false } = {}) {
  undoStack.push(clone(project)); if (undoStack.length > 25) undoStack.shift(); redoStack = [];
  fn();
  checked = new Set([...checked].filter((id) => project.features.some((f) => f.id === id)));
  persist(); if (fields) syncFieldUI(); else render(); if (fit) fitFeatures();
}
// Update in place on blur so an incoming click on a tool or route is retained.
function syncFieldUI() {
  const f = selected(); if (!f) return;
  const l = layerById(f.layer), point = f.geometry.type === 'Point';
  document.querySelectorAll('[data-layer]').forEach((el) => { el.querySelector('.layer-count').textContent = project.features.filter((item) => item.layer === el.dataset.layer).length; });
  const row = document.querySelector(`[data-feature="${f.id}"]`);
  if (row) {
    row.querySelector('strong').textContent = f.name;
    row.querySelector('small').textContent = point ? NODE_TYPES[f.nodeType] : `${l.name} · ${formatLength(length(f.geometry.coordinates))}`;
    row.closest('.route-row').style.setProperty('--layer-color', l.color);
  }
  const heading = $('#inspector .inspector-name h2'); if (heading) heading.textContent = f.name;
  const symbol = $('#inspector .inspector-symbol'); if (symbol) { symbol.style.setProperty('--layer-color',l.color); symbol.innerHTML = icon(l.icon); }
  const meta = $('#inspector .feature-meta'); if (meta) meta.innerHTML = `<span style="--layer-color:${l.color}"><b></b>${l.name}</span><span>${point ? NODE_TYPES[f.nodeType] : formatLength(length(f.geometry.coordinates))}</span>`;
  const layer = mapLayers.get(f.id);
  if (layer) {
    if (point) layer.setIcon(L.divIcon({ className: `node-marker selected node-${f.nodeType}`, html: '<span></span>', iconSize: [20,20], iconAnchor: [10,10] }));
    else layer.setStyle({ color: l.color, dashArray: f.layer === 'local' ? '6 5' : null });
    const label = document.createElement('span'); label.textContent = f.name; layer.setTooltipContent(label);
  }
  $('#undo').disabled = !undoStack.length; $('#redo').disabled = !redoStack.length;
  refreshIcons();
}
function finishGeometry(save = true) {
  if (tool !== 'vertices' || !editLayer) return;
  const f = selected();
  let coords;
  if (f && save && vertexDirty) coords = f.geometry.type === 'Point' ? [editLayer.getLatLng().lng, editLayer.getLatLng().lat] : editLayer.getLatLngs().map((p) => [p.lng, p.lat]);
  if (editLayer.pm?.enabled()) editLayer.pm.disable();
  if (editLayer.dragging?.enabled()) editLayer.dragging.disable();
  editLayer = null; tool = null; vertexDirty = false;
  if (coords && f) {
    if (f.geometry.type === 'LineString' && (coords.length < 2 || length(coords) < 0.001)) { toast('El recorrido debe conservar al menos dos vértices y un metro de longitud.', true); return; }
    mutate(() => { f.geometry.coordinates = coords; });
    toast('Geometría actualizada.');
  }
}
function resetTool({ save = true } = {}) {
  finishGeometry(save);
  map.pm.disableDraw(); tool = null; cuts = []; previewGroup.clearLayers(); map.getContainer().classList.remove('crosshair');
}
function selectFeature(id, fit = false) {
  resetTool(); selectedId = id;
  const f = selected();
  if (f && !project.visibility[f.layer]) { project.visibility[f.layer] = true; persist(); }
  render();
  if (fit && f) fitFeature(f);
}
function fitFeature(f) {
  if (f.geometry.type === 'Point') map.setView([...f.geometry.coordinates].reverse(), 15);
  else map.fitBounds(f.geometry.coordinates.map((c) => [c[1], c[0]]), { paddingTopLeft: [40, 100], paddingBottomRight: [window.innerWidth > 1000 ? 340 : 40, 100], maxZoom: 16 });
}
function fitFeatures() {
  const coords = project.features.filter((f) => project.visibility[f.layer]).flatMap((f) => f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.coordinates);
  if (!coords.length) { map.setView([-34.6037, -58.425], 12); return; }
  const bounds = L.latLngBounds(coords.map((c) => [c[1], c[0]]));
  map.fitBounds(bounds, { paddingTopLeft: [45, 95], paddingBottomRight: [selectedId && window.innerWidth > 1000 ? 340 : 45, 100], maxZoom: 15 });
}
function setMode(value) { resetTool(); mode = value; checked.clear(); render(); }
function render() {
  document.body.classList.toggle('is-editing', mode === 'edit');
  document.querySelectorAll('[data-mode]').forEach((b) => { b.classList.toggle('active', b.dataset.mode === mode); b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
  $('#project-title').innerHTML = `${esc(project.name)} ${icon('chevron-down')}`;
  $('#undo').disabled = !undoStack.length || loading; $('#redo').disabled = !redoStack.length || loading;
  renderLayers(); renderList(); renderToolbar(); renderMap(); renderInspector(); renderWelcome(); renderHint(); refreshIcons();
}
function renderLayers() {
  $('#layers-list').innerHTML = LAYERS.map((l) => {
    const count = project.features.filter((f) => f.layer === l.id).length;
    return `<div class="layer-row ${filter === l.id ? 'selected' : ''} ${project.visibility[l.id] ? '' : 'muted'} ${l.id === 'nodos' ? 'nodes-row' : ''}" style="--layer-color:${l.color}"><button class="layer-filter" data-layer="${l.id}" aria-pressed="${filter === l.id}"><span class="layer-icon">${icon(l.icon)}</span><span>${l.name}</span><span class="layer-count">${count}</span></button><button class="visibility-button" data-visibility="${l.id}" role="switch" aria-checked="${project.visibility[l.id]}" aria-label="Mostrar ${l.name}" title="${project.visibility[l.id] ? 'Ocultar' : 'Mostrar'} ${l.name}">${icon(project.visibility[l.id] ? 'eye' : 'eye-off')}</button></div>`;
  }).join('');
  $('#visibility-all').textContent = LAYERS.every((l) => !project.visibility[l.id]) ? 'Mostrar todas' : 'Ocultar todas';
  $('#show-all').classList.toggle('active', filter === 'all');
}
function filteredFeatures() {
  const search = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return project.features.filter((f) => (filter === 'all' || f.layer === filter) && `${f.name} ${f.source}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(search));
}
function renderList() {
  const features = filteredFeatures();
  $('#list-heading').innerHTML = `${filter === 'all' ? 'Elementos de la red' : esc(layerById(filter).name)} <span>${features.length}</span>`;
  $('#batch-actions').innerHTML = mode === 'edit' && features.some((f) => f.geometry.type === 'LineString') ? `<div class="batch-top"><label><input type="checkbox" id="check-all" ${features.filter((f) => f.geometry.type === 'LineString').every((f) => checked.has(f.id)) ? 'checked' : ''}/> Seleccionar visibles en la lista</label>${checked.size ? `<button class="text-button" data-action="clear-checked">Limpiar (${checked.size})</button>` : ''}</div>${checked.size ? `<div class="batch-box"><strong>${checked.size} recorrido${checked.size > 1 ? 's' : ''} seleccionado${checked.size > 1 ? 's' : ''}</strong><div><select id="batch-layer" aria-label="Capa para recorridos seleccionados">${routeOptions('troncal')}</select><button class="button primary" data-action="batch-move" title="Mover seleccionados a esta capa">Mover</button></div></div>` : ''}` : '';
  if (!features.length) {
    $('#route-list').innerHTML = project.features.length ? `<div class="empty-list">${icon('search')}<h3>Sin resultados</h3><p>Probá con otro nombre o elegí otra capa.</p><button class="text-button" data-action="clear-search">Ver toda la red</button></div>` : `<div class="empty-list first-import"><span class="empty-icon">${icon('route')}</span><h3>Tu red empieza con un KML</h3><p>Importá tus recorridos y organizalos<br/>a tu manera.</p><button class="button secondary" data-action="import">${icon('upload')} Cargar mi primer KML</button><button class="text-button" data-action="demo">o explorar un ejemplo ${icon('arrow-up-right')}</button></div>`;
    return;
  }
  $('#route-list').innerHTML = features.slice(0, 250).map((f) => {
    const l = layerById(f.layer), point = f.geometry.type === 'Point';
    return `<div class="route-row ${selectedId === f.id ? 'selected' : ''}" style="--layer-color:${l.color}">${mode === 'edit' && !point ? `<input type="checkbox" data-check="${f.id}" aria-label="Seleccionar ${esc(f.name)} para mover" ${checked.has(f.id) ? 'checked' : ''}/>` : ''}<button data-feature="${f.id}" class="route-item"><span class="route-glyph">${icon(point ? 'map-pin' : 'route')}</span><span><strong>${esc(f.name)}</strong><small>${point ? NODE_TYPES[f.nodeType] : `${l.name} <span>·</span> ${formatLength(length(f.geometry.coordinates))}`}</small></span>${icon('chevron-right')}</button></div>`;
  }).join('') + (features.length > 250 ? `<p class="list-limit">Mostrando 250 de ${features.length}. Usá la búsqueda para encontrar un elemento.</p>` : '');
}
function renderMap() {
  if (tool === 'vertices') return;
  mapLayers.forEach((layer) => map.removeLayer(layer)); mapLayers.clear();
  let visible = 0;
  for (const f of project.features) {
    if (!project.visibility[f.layer]) continue;
    visible++;
    const selected = f.id === selectedId, color = layerById(f.layer).color;
    let layer;
    if (f.geometry.type === 'Point') {
      layer = L.marker([...f.geometry.coordinates].reverse(), { icon: L.divIcon({ className: `node-marker ${selected ? 'selected' : ''} node-${f.nodeType}`, html: '<span></span>', iconSize: [20,20], iconAnchor: [10,10] }), keyboard: true, title: f.name });
    } else {
      layer = L.polyline(f.geometry.coordinates.map((c) => [c[1], c[0]]), { color, weight: selected ? 7 : f.layer === 'local' ? 3.5 : 4.5, opacity: selectedId && !selected ? 0.48 : 0.92, dashArray: f.layer === 'local' ? '6 5' : undefined, lineCap: 'round', bubblingMouseEvents: false });
    }
    const tooltip = document.createElement('span'); tooltip.textContent = f.name;
    layer.bindTooltip(tooltip, { sticky: f.geometry.type !== 'Point', direction: 'top', offset: [0,-8], className: 'route-tooltip' });
    layer.on('click', (e) => {
      L.DomEvent.stopPropagation(e.originalEvent);
      if (tool === 'split' || tool === 'trim') { addCut(e.latlng); return; }
      if (tool === 'node') { openNodeDialog([e.latlng.lng, e.latlng.lat]); return; }
      if (tool === 'draw' || tool === 'vertices') return;
      selectFeature(f.id);
    });
    layer.addTo(map); mapLayers.set(f.id, layer);
  }
  if (selectedId && mapLayers.get(selectedId)?.bringToFront) mapLayers.get(selectedId).bringToFront();
  $('#visible-count').textContent = `${visible} elemento${visible === 1 ? '' : 's'} visible${visible === 1 ? '' : 's'}`;
  drawCuts();
}
function renderToolbar() {
  const f = selected(), isLine = f?.geometry.type === 'LineString';
  $('#editor-toolbar').innerHTML = mode !== 'edit' ? '' : `<div class="editor-toolbar" role="toolbar" aria-label="Herramientas de edición"><button data-tool="select" class="${!tool ? 'active' : ''}" aria-label="Seleccionar" title="Seleccionar (V)">${icon('mouse-pointer-2')}</button><span></span><button data-tool="split" class="${tool === 'split' ? 'active' : ''}" ${isLine ? '' : 'disabled'} title="Dividir recorrido (D)" aria-label="Dividir recorrido">${icon('scissors')}</button><button data-tool="trim" class="${tool === 'trim' ? 'active' : ''}" ${isLine ? '' : 'disabled'} title="Recortar tramo (R)" aria-label="Recortar tramo">${icon('crop')}</button><span></span><button data-tool="draw" class="${tool === 'draw' ? 'active' : ''}" title="Dibujar recorrido" aria-label="Dibujar recorrido">${icon('route')}</button><button data-tool="node" class="${tool === 'node' ? 'active' : ''}" title="Agregar nodo (N)" aria-label="Agregar nodo">${icon('waypoints')}</button></div>`;
}
function renderInspector() {
  const f = selected(), container = $('#inspector');
  if (!f) {
    container.innerHTML = mode === 'edit' && project.features.length ? `<div class="editor-tip"><span class="tip-icon">${icon('mouse-pointer-2')}</span><div><strong>Elegí un recorrido</strong><p>Seleccioná una línea en el mapa o la lista para empezar a editar.</p></div></div>` : '';
    return;
  }
  const point = f.geometry.type === 'Point', l = layerById(f.layer), editing = mode === 'edit';
  const isCutting = tool === 'split' || tool === 'trim';
  container.innerHTML = `<section class="inspector-card" aria-label="Detalle del elemento"><div class="inspector-top"><span class="eyebrow">${point ? 'NODO DE LA RED' : editing ? 'EDITOR DE RECORRIDO' : 'DETALLE DEL RECORRIDO'}</span><button class="icon-button" data-action="close-inspector" aria-label="Cerrar detalle">${icon('x')}</button></div><div class="inspector-name"><span class="inspector-symbol" style="--layer-color:${l.color}">${icon(l.icon)}</span><h2>${esc(f.name)}</h2></div><div class="feature-meta"><span style="--layer-color:${l.color}"><b></b>${l.name}</span><span>${point ? NODE_TYPES[f.nodeType] : formatLength(length(f.geometry.coordinates))}</span></div>
    ${editing ? `${!isCutting && tool !== 'vertices' ? `<div class="inspector-fields"><label>Nombre<input id="feature-name" value="${esc(f.name)}" maxlength="500"/></label>${point ? `<label>Tipo de nodo<select id="node-type">${Object.entries(NODE_TYPES).map(([id,name]) => `<option value="${id}" ${f.nodeType === id ? 'selected' : ''}>${name}</option>`).join('')}</select></label>` : `<label>Capa de transporte<select id="feature-layer">${routeOptions(f.layer)}</select></label>`}<label>Notas<textarea id="feature-notes" rows="2" maxlength="10000" placeholder="Agregá una referencia…">${esc(f.description || '')}</textarea></label></div><div class="edit-tools"><button class="button secondary full" data-tool="vertices">${icon('pencil')} ${point ? 'Mover nodo' : 'Editar vértices'}</button>${!point ? `<div><button class="button secondary" data-tool="split">${icon('scissors')} Dividir</button><button class="button secondary" data-tool="trim">${icon('crop')} Recortar</button></div>` : ''}</div>` : ''}
    ${tool === 'vertices' ? `<div class="operation-panel"><h3>${point ? 'Ubicá el nodo' : 'Ajustá el recorrido'}</h3><p>${point ? 'Arrastrá el punto a su nueva ubicación.' : 'Arrastrá los vértices para moverlos. Arrastrá los puntos intermedios para agregar vértices; hacé clic derecho en uno para eliminarlo.'}</p><button class="button primary full" data-action="save-geometry">${icon('check')} Guardar geometría</button><button class="text-button full" data-action="cancel-tool">Cancelar cambios</button></div>` : ''}
    ${isCutting ? `<div class="operation-panel"><div class="operation-title">${icon(tool === 'split' ? 'scissors' : 'crop')}<h3>${tool === 'split' ? 'Dividir en dos tramos' : 'Aislar un tramo'}</h3></div><p>${tool === 'split' ? 'Marcá sobre la línea el lugar donde querés hacer el corte.' : 'Marcá dos puntos sobre la línea. El tramo entre A y B quedará resaltado.'}</p><div class="cut-steps"><span class="${cuts[0] ? 'done' : ''}"><b>A</b>${cuts[0] ? 'Punto marcado' : 'Elegí un punto'}</span>${tool === 'trim' ? `<span class="${cuts[1] ? 'done' : ''}"><b>B</b>${cuts[1] ? 'Punto marcado' : 'Elegí otro punto'}</span>` : ''}</div>${tool === 'trim' ? `<label class="form-label">Capa del tramo recortado<select id="cut-layer">${routeOptions(cutTarget)}</select></label><label class="checkbox-label"><input id="keep-remainder" type="checkbox" ${keepRemainder ? 'checked' : ''}/> Conservar los tramos restantes</label>` : ''}<button class="button primary full" data-action="apply-cut" ${cuts.length < (tool === 'split' ? 1 : 2) ? 'disabled' : ''}>${icon('check')} ${tool === 'split' ? 'Aplicar división' : keepRemainder ? 'Separar y clasificar' : 'Conservar solo este tramo'}</button><div class="operation-footer"><button class="text-button" data-action="reset-cuts">Volver a marcar</button><button class="text-button" data-action="cancel-tool">Cancelar</button></div><p class="operation-note">${icon('undo-2')} Podés deshacer esta operación.</p></div>` : ''}
    ${!isCutting && tool !== 'vertices' ? `<div class="inspector-footer"><button class="text-button danger" data-action="delete-feature">${icon('trash-2')} Eliminar ${point ? 'nodo' : 'recorrido'}</button><button class="icon-button" data-action="fit-selected" title="Encuadrar elemento" aria-label="Encuadrar elemento">${icon('maximize-2')}</button></div>` : ''}` : `<div class="explore-detail">${f.description ? `<p>${esc(f.description).slice(0, 500)}</p>` : ''}<button class="button primary full" data-action="edit-selected">${icon('pencil')} Editar ${point ? 'nodo' : 'recorrido'}</button><button class="text-button full" data-action="fit-selected">${icon('maximize-2')} Encuadrar en el mapa</button></div>`}
    ${f.source ? `<div class="source-note">${icon('file-up')}<span title="${esc(f.source)}">${esc(f.source)}</span></div>` : ''}</section>`;
}
function renderWelcome() {
  $('#welcome').innerHTML = project.features.length || loading || tool ? '' : `<div class="welcome-card"><span class="welcome-illustration"><span></span><b></b><i></i>${icon('waypoints')}</span><div class="eyebrow">CONECTÁ TUS IDEAS</div><h2>Una ciudad.<br/>Muchas conexiones.</h2><p>Explorá y diseñá la red de transporte<br/>de Buenos Aires, a tu manera.</p><div><button class="button primary" data-action="import">${icon('upload')} Importar un KML</button><button class="button welcome-demo" data-action="demo">Ver ejemplo ${icon('arrow-up-right')}</button></div><span class="welcome-note">${icon('hard-drive')} Tu proyecto queda en este navegador.</span></div>`;
}
function renderHint() {
  const text = { split: 'Hacé clic sobre el recorrido para marcar el corte', trim: `Marcá ${cuts.length === 0 ? 'el inicio (A)' : cuts.length === 1 ? 'el final (B)' : 'otro punto para ajustar B'} del tramo`, node: 'Hacé clic en el mapa para agregar un nodo', draw: 'Hacé clic para dibujar · Doble clic para terminar', vertices: selected()?.geometry.type === 'Point' ? 'Arrastrá el nodo para moverlo' : 'Arrastrá los vértices para ajustar el recorrido' }[tool];
  $('#tool-hint').innerHTML = text ? `<div class="tool-hint">${icon(tool === 'node' ? 'waypoints' : tool === 'split' ? 'scissors' : tool === 'trim' ? 'crop' : 'pencil')}<span>${text}</span><button data-action="cancel-tool" title="Cancelar herramienta"><kbd>Esc</kbd></button></div>` : mode === 'edit' ? '<div class="mode-caption"><span></span> MODO EDITOR <span class="caption-divider">/</span> Seleccioná, recortá y conectá.</div>' : '';
}

function activateTool(value) {
  if (mode !== 'edit') mode = 'edit';
  resetTool();
  if (value === 'select') { render(); return; }
  const f = selected();
  if (['split', 'trim', 'vertices'].includes(value) && !f) return;
  if (['split', 'trim'].includes(value) && f.geometry.type !== 'LineString') return;
  tool = value;
  if (value === 'node' || value === 'draw') selectedId = null;
  if (value === 'trim') { cutTarget = 'troncal'; keepRemainder = true; }
  if (value === 'vertices') {
    editLayer = mapLayers.get(f.id);
    if (!editLayer) { project.visibility[f.layer] = true; tool = null; render(); tool = value; editLayer = mapLayers.get(f.id); }
    if (f.geometry.type === 'Point') { editLayer.dragging.enable(); editLayer.on('dragend', () => { vertexDirty = true; }); }
    else { editLayer.pm.enable({ snappable: false, allowSelfIntersection: true, limitMarkersToCount: 100, limitMarkersToViewport: true }); editLayer.on('pm:edit', () => { vertexDirty = true; }); }
  } else renderMap();
  if (value === 'draw') map.pm.enableDraw('Line', { snappable: false, finishOn: 'dblclick', pathOptions: { color: '#148577', weight: 4 }, tooltips: true });
  map.getContainer().classList.toggle('crosshair', ['split','trim','node'].includes(value));
  renderToolbar(); renderInspector(); renderWelcome(); renderHint(); refreshIcons();
}
function addCut(latlng) {
  const f = selected(); if (!f || !['split','trim'].includes(tool)) return;
  const cut = nearestOnLine(f.geometry.coordinates, [latlng.lng, latlng.lat]);
  const a = map.latLngToContainerPoint(latlng), b = map.latLngToContainerPoint([cut.coordinate[1],cut.coordinate[0]]);
  if (a.distanceTo(b) > 24) { toast('Marcá el corte más cerca del recorrido seleccionado.', true); return; }
  if (tool === 'split') cuts = [cut]; else if (cuts.length < 2) cuts.push(cut); else cuts[1] = cut;
  drawCuts(); renderInspector(); renderHint(); refreshIcons();
}
function drawCuts() {
  previewGroup.clearLayers();
  cuts.forEach((cut, i) => {
    const marker = L.marker([cut.coordinate[1], cut.coordinate[0]], { icon: L.divIcon({ className: 'cut-marker', html: `<span>${i ? 'B' : 'A'}</span>`, iconSize: [28, 28], iconAnchor: [14,14] }), draggable: true, zIndexOffset: 1000, title: `Punto ${i ? 'B' : 'A'}: arrastrá para ajustar` });
    marker.on('dragend', (e) => {
      const p = e.target.getLatLng(); cuts[i] = nearestOnLine(selected().geometry.coordinates, [p.lng, p.lat]); drawCuts(); renderInspector(); refreshIcons();
    }); marker.addTo(previewGroup);
  });
  if (tool === 'trim' && cuts.length === 2) {
    try { const piece = extractLine(selected().geometry.coordinates, cuts[0].position, cuts[1].position).middle; L.polyline(piece.map((c) => [c[1], c[0]]), { color: '#c5e274', weight: 11, opacity: 0.95, interactive: false }).addTo(previewGroup); } catch { /* Invalid short cuts are explained when applying. */ }
  }
}
function applyCut() {
  const f = selected(); if (!f) return;
  const action = tool;
  try {
    const coords = f.geometry.coordinates;
    let parts;
    if (action === 'split' && cuts.length === 1) parts = splitLine(coords, cuts[0].position).map((c,i) => ({ ...clone(f), id: uid(), name: `${f.name.slice(0, 470)} · Tramo ${i + 1}`, geometry: { type: 'LineString', coordinates: c } }));
    else if (action === 'trim' && cuts.length === 2) {
      const { before, middle, after } = extractLine(coords, cuts[0].position, cuts[1].position);
      const central = { ...clone(f), id: uid(), name: `${f.name.slice(0,470)} · Recorte`, layer: cutTarget, geometry: { type: 'LineString', coordinates: middle } };
      parts = [central];
      if (keepRemainder) { if (before) parts.push({ ...clone(f), id: uid(), name: `${f.name.slice(0,470)} · Inicio`, geometry: { type: 'LineString', coordinates: before } }); if (after) parts.push({ ...clone(f), id: uid(), name: `${f.name.slice(0,470)} · Final`, geometry: { type: 'LineString', coordinates: after } }); }
    } else return;
    resetTool();
    mutate(() => { const index = project.features.findIndex((p) => p.id === f.id); project.features.splice(index, 1, ...parts); parts.forEach((p) => { project.visibility[p.layer] = true; }); selectedId = parts[0].id; });
    toast(action === 'split' ? 'Recorrido dividido. Ahora podés asignar cada tramo a una capa.' : 'Tramo recortado y clasificado.');
  } catch (err) { toast(err.message, true); }
}

map.on('click', (e) => {
  if ($('#dialog').open) return;
  if (tool === 'node') openNodeDialog([e.latlng.lng, e.latlng.lat]);
  else if (tool === 'split' || tool === 'trim') addCut(e.latlng);
});
map.on('mousemove', (e) => { $('#coordinates').textContent = `${Math.abs(e.latlng.lat).toFixed(4)}° ${e.latlng.lat < 0 ? 'S' : 'N'}   ${Math.abs(e.latlng.lng).toFixed(4)}° ${e.latlng.lng < 0 ? 'O' : 'E'}`; });
map.pm.setLang('es');
map.on('pm:create', (e) => {
  const coords = e.layer.getLatLngs().map((p) => [p.lng, p.lat]); map.removeLayer(e.layer); resetTool();
  if (coords.length < 2 || length(coords) < 0.001) { toast('El recorrido debe medir al menos un metro.', true); render(); return; }
  const f = { id: uid(), name: 'Nuevo recorrido', layer: filter !== 'all' && filter !== 'nodos' ? filter : 'local', description: '', source: 'Dibujado en Trama', geometry: { type: 'LineString', coordinates: coords } };
  mutate(() => { project.features.push(f); project.visibility[f.layer] = true; selectedId = f.id; }); toast('Recorrido creado. Podés cambiar su nombre y capa.');
});

function openDialog(content, className = '') {
  const dialog = $('#dialog');
  if (dialog.open) dialog.close();
  dialog.className = className; dialog.innerHTML = content; refreshIcons(); dialog.showModal();
}
const dialogHeader = (eyebrow, title, glyph = 'layers') => `<div class="dialog-header"><span class="dialog-symbol">${icon(glyph)}</span><button class="icon-button" data-action="close-dialog" aria-label="Cerrar ventana">${icon('x')}</button><div class="eyebrow">${eyebrow}</div><h2 id="dialog-title">${title}</h2></div>`;
function openImport() {
  resetTool(); render(); importFiles = []; importBusy = false;
  openDialog(`${dialogHeader('SUMÁ RECORRIDOS A TU RED', 'Importar un KML', 'upload')}<p class="dialog-description">Cargá uno o varios archivos. Después podés dividir los recorridos y mover cada tramo a su capa.</p><label class="drop-zone" id="drop-zone" tabindex="0">${icon('file-up')}<strong>Arrastrá tus archivos KML acá</strong><span>o hacé clic para elegir · Uno o varios archivos</span><input type="file" id="kml-files" accept=".kml,application/vnd.google-earth.kml+xml" multiple hidden/></label><div id="import-file-list"></div><div class="dialog-fields"><label>Capa inicial para los recorridos<select id="import-layer">${routeOptions(filter !== 'all' && filter !== 'nodos' ? filter : 'local')}</select></label><label class="checkbox-label"><input type="checkbox" id="infer-layers" checked/> Reconocer las capas por los nombres de las carpetas KML</label><p class="field-note">Los puntos se agregan automáticamente a Nodos. Los recorridos sin una capa reconocida usan la capa inicial.</p></div><div id="import-error" role="alert"></div><div class="dialog-footer"><button class="button secondary" data-action="close-dialog">Cancelar</button><button class="button primary" id="import-confirm" data-action="import-confirm" disabled>${icon('upload')} Importar archivos</button></div>`);
  const zone = $('#drop-zone');
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('dragover'); setImportFiles([...e.dataTransfer.files]); });
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#kml-files').click(); } });
}
function setImportFiles(files) {
  if (importBusy) return;
  importFiles = files;
  $('#import-file-list').innerHTML = files.map((f) => `<div class="import-file">${icon('file-up')}<span>${esc(f.name)}</span><small>${(f.size / 1024).toLocaleString('es-AR', { maximumFractionDigits: 0 })} KB</small></div>`).join('');
  $('#import-confirm').disabled = !files.length; $('#import-error').textContent = ''; refreshIcons();
}
async function performImport() {
  if (!importFiles.length || importBusy) return;
  importBusy = true; $('#import-confirm').disabled = true; $('#import-confirm').textContent = 'Importando…';
  const defaultLayer = $('#import-layer').value, inferLayers = $('#infer-layers').checked;
  try {
    const additions = []; let skipped = 0;
    for (const file of importFiles) {
      if (!file.name.toLowerCase().endsWith('.kml')) throw new Error(`${file.name}: elegí archivos .kml. Para un proyecto usá “Abrir proyecto”.`);
      try { const result = parseKML(await file.text(), { defaultLayer, inferLayers, source: file.name }); for (const feature of result.features) additions.push(feature); skipped += result.skipped; } catch (err) { throw new Error(`${file.name}: ${err.message}`); }
    }
    validateProject({ ...project, features: [...project.features, ...additions] });
    $('#dialog').close(); selectedId = null; filter = 'all'; query = ''; $('#search').value = '';
    mutate(() => { project.features = project.features.concat(additions); additions.forEach((f) => { project.visibility[f.layer] = true; }); mode = 'edit'; }, { fit: true });
    toast(`${additions.length} elementos importados${skipped ? `. Se omitieron ${skipped} geometrías incompatibles o inválidas` : ''}.`);
  } catch (err) { if ($('#import-error')) { $('#import-error').textContent = err.message; $('#import-confirm').disabled = false; $('#import-confirm').innerHTML = `${icon('upload')} Volver a intentar`; refreshIcons(); } else toast(err.message, true); }
  finally { importBusy = false; }
}
function openNodeDialog(coords) {
  openDialog(`${dialogHeader('UN PUNTO DE CONEXIÓN', 'Agregar nodo', 'waypoints')}<form id="node-form"><div class="dialog-fields"><label>Nombre del nodo<input id="new-node-name" placeholder="Ej. Centro de trasbordo Retiro" maxlength="500" required autofocus/></label><label>Tipo de nodo<select id="new-node-type">${Object.entries(NODE_TYPES).map(([id,name]) => `<option value="${id}">${name}</option>`).join('')}</select></label><label>Notas<textarea id="new-node-notes" rows="2" maxlength="10000" placeholder="Líneas que conecta, accesos, referencias…"></textarea></label><p class="node-coordinates">${icon('map-pin')} ${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}</p></div><div class="dialog-footer"><button type="button" class="button secondary" data-action="close-dialog">Cancelar</button><button type="submit" class="button primary">${icon('plus')} Crear nodo</button></div></form>`);
  $('#node-form').addEventListener('submit', (e) => {
    e.preventDefault(); const name = $('#new-node-name').value.trim(); if (!name) { $('#new-node-name').focus(); return; }
    const f = { id: uid(), name, layer: 'nodos', nodeType: $('#new-node-type').value, description: $('#new-node-notes').value, source: 'Creado en Trama', geometry: { type: 'Point', coordinates: coords } };
    $('#dialog').close(); resetTool(); mutate(() => { project.features.push(f); project.visibility.nodos = true; selectedId = f.id; }); toast('Nodo agregado a la red.');
  });
}
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const filename = () => project.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase() || 'trama';
function openExport() {
  resetTool(); render();
  openDialog(`${dialogHeader('LLEVATE TU TRABAJO', 'Exportar la red', 'download')}<p class="dialog-description">Guardá una copia para seguir trabajando o compartí tus recorridos con otras herramientas de mapas.</p><div class="export-options"><button data-action="download-project"><span class="export-icon">${icon('folder-open')}</span><span><strong>Proyecto Trama <small>.json</small></strong><p>Todos los recorridos, nodos y capas.<br/>Abrilo en Trama para retomar la edición.</p></span>${icon('arrow-down-to-line')}</button><button data-action="download-kml"><span class="export-icon">${icon('map')}</span><span><strong>Red completa <small>.kml</small></strong><p>Un KML con una carpeta por capa.<br/>Compatible con Google Earth y QGIS.</p></span>${icon('arrow-down-to-line')}</button></div><label class="form-label layer-export">Exportar una capa<div><select id="export-layer">${routeOptions('troncal', true)}</select><button class="button secondary" data-action="download-layer" aria-label="Descargar capa KML">${icon('download')}</button></div></label><p class="field-note">Se exportan también las capas ocultas. Los ejemplos son ilustrativos y no son información oficial de transporte.</p><div class="dialog-footer"><button class="button secondary" data-action="close-dialog">Cerrar</button></div>`);
}
function confirmDialog(title, description, callback, confirmText = 'Confirmar', danger = false) {
  openDialog(`${dialogHeader('PROYECTO LOCAL', esc(title), danger ? 'trash-2' : 'folder-open')}<p class="dialog-description">${esc(description)}</p><div class="dialog-footer"><button class="button secondary" data-action="close-dialog">Cancelar</button><button class="button ${danger ? 'danger-button' : 'primary'}" id="confirm-dialog">${esc(confirmText)}</button></div>`);
  $('#confirm-dialog').onclick = () => { $('#dialog').close(); callback(); };
}
function openProjectMenu() {
  openDialog(`${dialogHeader('TU ESPACIO DE TRABAJO', 'Administrar proyecto', 'folder-open')}<div class="project-options"><button data-action="open-project">${icon('folder-open')}<span><strong>Abrir proyecto</strong><small>Restaurar un archivo .json de Trama</small></span>${icon('chevron-right')}</button><button data-action="rename-project">${icon('pencil')}<span><strong>Cambiar nombre</strong><small>${esc(project.name)}</small></span>${icon('chevron-right')}</button><button data-action="demo">${icon('network')}<span><strong>Cargar red de ejemplo</strong><small>Recorridos ilustrativos para probar el editor</small></span>${icon('chevron-right')}</button><button data-action="new-project">${icon('plus')}<span><strong>Nuevo proyecto vacío</strong><small>Empezar una nueva red</small></span>${icon('chevron-right')}</button></div><p class="field-note">Trama guarda un proyecto por navegador y dirección local. Exportá un .json para guardar otros proyectos.</p>`);
}
function replaceProject(next) {
  resetTool(); selectedId = null; checked.clear(); filter = 'all'; query = ''; $('#search').value = '';
  mutate(() => { project = next; }, { fit: true });
}
function loadDemo() {
  const load = () => { $('#dialog').close(); replaceProject(createDemo()); toast('Ejemplo cargado: trazados simplificados, no aptos para planificar viajes.'); };
  if (project.features.length) confirmDialog('Cargar red de ejemplo', 'El ejemplo reemplaza el proyecto actual. Podés exportarlo antes o recuperar el anterior con Deshacer.', load, 'Cargar ejemplo'); else load();
}
function openHelp() {
  openDialog(`${dialogHeader('UN MAPA, MUCHAS POSIBILIDADES', 'Así se teje una red', 'help-circle')}<div class="help-steps"><div><b>01</b><span><strong>Importá y organizá</strong><p>Cargá archivos KML. Elegí una capa inicial o reconocé las carpetas por sus nombres. Activá u ocultá capas con el ojo; hacé clic en su nombre para filtrar la lista.</p></span></div><div><b>02</b><span><strong>Separá lo troncal de lo local</strong><p>En Editar red, elegí un recorrido y usá Recortar. Marcá A y B sobre la línea, elegí la capa del tramo y aplicá. Con “Conservar los tramos restantes” obtenés hasta tres recorridos independientes.</p></span></div><div><b>03</b><span><strong>Ajustá y conectá</strong><p>Dividir crea dos recorridos en un punto. Editar vértices permite mover, agregar o eliminar puntos. Agregar nodo crea puntos de trasbordo, combinación o destino.</p></span></div><div><b>04</b><span><strong>Guardá una copia</strong><p>El proyecto se guarda en este navegador. Exportá un .json como respaldo o un .kml para usarlo en otras herramientas. El mapa base necesita internet; el editor y tus datos funcionan localmente.</p></span></div></div><div class="shortcut-list"><span><kbd>Ctrl / ⌘ Z</kbd> Deshacer</span><span><kbd>Mayús Z</kbd> Rehacer con Ctrl / ⌘</span><span><kbd>Esc</kbd> Cancelar herramienta</span><span><kbd>/</kbd> Buscar</span></div><div class="dialog-footer"><button class="button primary" data-action="close-dialog">Empezar a explorar ${icon('arrow-up-right')}</button></div>`, 'help-dialog');
}
function renameProject() {
  openDialog(`${dialogHeader('TU ESPACIO DE TRABAJO', 'Nombre del proyecto', 'pencil')}<form id="rename-form"><div class="dialog-fields"><label>Nombre<input id="new-project-name" value="${esc(project.name)}" maxlength="200" required autofocus/></label></div><div class="dialog-footer"><button type="button" class="button secondary" data-action="close-dialog">Cancelar</button><button type="submit" class="button primary">Guardar nombre</button></div></form>`);
  $('#rename-form').onsubmit = (e) => { e.preventDefault(); const value = $('#new-project-name').value.trim(); if (!value) return; $('#dialog').close(); mutate(() => { project.name = value; }); };
}
function undo(redo = false) {
  if (loading) return;
  resetTool({ save: false }); const from = redo ? redoStack : undoStack, to = redo ? undoStack : redoStack;
  if (!from.length) { render(); return; } to.push(clone(project)); project = from.pop(); selectedId = null; checked.clear(); persist(); render(); toast(redo ? 'Cambio rehecho.' : 'Cambio deshecho.');
}

document.addEventListener('click', (e) => {
  const target = e.target.closest('button, [data-mode], [data-tool]'); if (!target || target.disabled || loading) return;
  if (target.dataset.mode) { setMode(target.dataset.mode); return; }
  if (target.dataset.tool) { activateTool(target.dataset.tool); return; }
  if (target.dataset.layer) { filter = filter === target.dataset.layer ? 'all' : target.dataset.layer; renderLayers(); renderList(); refreshIcons(); return; }
  if (target.dataset.visibility) {
    const id = target.dataset.visibility; if (selected()?.layer === id && project.visibility[id]) { resetTool(); selectedId = null; }
    project.visibility[id] = !project.visibility[id]; persist(); render(); return;
  }
  if (target.dataset.feature) { selectFeature(target.dataset.feature, true); if (window.innerWidth < 760) document.body.classList.remove('sidebar-open'); return; }
  const action = target.dataset.action;
  switch (action) {
    case 'import': openImport(); break;
    case 'close-dialog': if (!importBusy) $('#dialog').close(); break;
    case 'import-confirm': performImport(); break;
    case 'export': openExport(); break;
    case 'download-project': download(JSON.stringify(project, null, 2), `${filename()}.trama.json`, 'application/json'); toast('Proyecto exportado. Conservá este archivo como respaldo.'); break;
    case 'download-kml': download(exportKML(project), `${filename()}.kml`, 'application/vnd.google-earth.kml+xml'); toast('Red exportada en KML.'); break;
    case 'download-layer': { const l = $('#export-layer').value; download(exportKML(project, l), `${filename()}-${l}.kml`, 'application/vnd.google-earth.kml+xml'); toast('Capa exportada en KML.'); break; }
    case 'demo': loadDemo(); break;
    case 'help': openHelp(); break;
    case 'list-menu': resetTool(); render(); openProjectMenu(); break;
    case 'rename-project': resetTool(); render(); renameProject(); break;
    case 'open-project': $('#project-file').click(); break;
    case 'new-project': confirmDialog('Empezar una nueva red', 'Se vaciará el proyecto actual. Podés exportar una copia antes o recuperarlo con Deshacer.', () => { replaceProject(emptyProject()); toast('Proyecto vacío creado.'); }, 'Crear proyecto', true); break;
    case 'zoom-in': map.zoomIn(); break;
    case 'zoom-out': map.zoomOut(); break;
    case 'home': map.setView([-34.6037,-58.425],12); break;
    case 'fit': fitFeatures(); break;
    case 'fit-selected': if (selected()) fitFeature(selected()); break;
    case 'base': {
      openDialog(`${dialogHeader('EL CONTEXTO DE TU RED', 'Mapa base', 'map')}<div class="base-options">${[['light','Mapa claro','Un fondo liviano para destacar tus capas.'],['streets','Calles','Mapa detallado de OpenStreetMap.'],['none','Sin mapa base','Trabajá sin descargar mapas de internet.']].map(([id,name,desc]) => `<button data-base="${id}" class="${base === id ? 'active' : ''}"><span class="base-swatch ${id}"></span><span><strong>${name}</strong><small>${desc}</small></span>${base === id ? icon('check') : ''}</button>`).join('')}</div>`); break;
    }
    case 'all-routes': filter = 'all'; renderLayers(); renderList(); refreshIcons(); break;
    case 'visibility-all': {
      resetTool(); selectedId = null; const next = LAYERS.every((l) => !project.visibility[l.id]); LAYERS.forEach((l) => { project.visibility[l.id] = next; }); persist(); render(); break;
    }
    case 'clear-search': filter = 'all'; query = ''; $('#search').value = ''; renderLayers(); renderList(); refreshIcons(); break;
    case 'clear-checked': checked.clear(); renderList(); refreshIcons(); break;
    case 'batch-move': {
      const layer = $('#batch-layer').value; resetTool(); mutate(() => { project.features.filter((f) => checked.has(f.id) && f.geometry.type === 'LineString').forEach((f) => { f.layer = layer; }); project.visibility[layer] = true; checked.clear(); }); toast('Recorridos movidos a la capa seleccionada.'); break;
    }
    case 'close-inspector': resetTool(); selectedId = null; render(); break;
    case 'edit-selected': setMode('edit'); break;
    case 'save-geometry': finishGeometry(); render(); break;
    case 'cancel-tool': resetTool({ save: false }); render(); break;
    case 'reset-cuts': cuts = []; drawCuts(); renderInspector(); renderHint(); refreshIcons(); break;
    case 'apply-cut': applyCut(); break;
    case 'delete-feature': {
      const f = selected(); if (!f) break;
      confirmDialog(`Eliminar ${f.geometry.type === 'Point' ? 'nodo' : 'recorrido'}`, `Se eliminará “${f.name}”. Podés recuperar este elemento con Deshacer.`, () => { resetTool(); mutate(() => { project.features = project.features.filter((x) => x.id !== f.id); selectedId = null; }); toast('Elemento eliminado.'); }, 'Eliminar', true); break;
    }
    case 'undo': undo(); break;
    case 'redo': undo(true); break;
    case 'sidebar': document.body.classList.toggle('sidebar-open'); setTimeout(() => map.invalidateSize(), 250); break;
  }
  if (target.dataset.base) { setBase(target.dataset.base); $('#dialog').close(); refreshIcons(); }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'search') { query = e.target.value; renderList(); refreshIcons(); }
});
document.addEventListener('change', (e) => {
  const target = e.target, f = selected();
  if (target.id === 'kml-files') setImportFiles([...target.files]);
  if (target.dataset.check) { target.checked ? checked.add(target.dataset.check) : checked.delete(target.dataset.check); renderList(); refreshIcons(); }
  if (target.id === 'check-all') { filteredFeatures().filter((f) => f.geometry.type === 'LineString').forEach((f) => { target.checked ? checked.add(f.id) : checked.delete(f.id); }); renderList(); refreshIcons(); }
  if (target.id === 'cut-layer') cutTarget = target.value;
  if (target.id === 'keep-remainder') { keepRemainder = target.checked; renderInspector(); refreshIcons(); }
  if (f && target.id === 'feature-name') { const name = target.value.trim(); if (name && name !== f.name) mutate(() => { f.name = name; }, { fields: true }); else target.value = f.name; }
  if (f && target.id === 'feature-notes' && target.value !== f.description) mutate(() => { f.description = target.value; }, { fields: true });
  if (f && target.id === 'feature-layer' && target.value !== f.layer) { mutate(() => { f.layer = target.value; project.visibility[f.layer] = true; }, { fields: true }); renderMap(); renderLayers(); renderList(); refreshIcons(); }
  if (f && target.id === 'node-type' && target.value !== f.nodeType) mutate(() => { f.nodeType = target.value; }, { fields: true });
});
$('#project-file').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  try {
    const next = validateProject(JSON.parse(await file.text()));
    const apply = () => { $('#dialog').close(); replaceProject(next); toast('Proyecto abierto.'); };
    if (project.features.length) confirmDialog('Abrir otro proyecto', 'El proyecto del archivo reemplazará al actual. Podés exportar una copia antes o recuperar el anterior con Deshacer.', apply, 'Abrir proyecto'); else apply();
  } catch (err) { toast(`No se pudo abrir el proyecto: ${err.message}`, true); }
});
$('#dialog').addEventListener('click', (e) => { if (e.target === $('#dialog') && !importBusy) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });
$('#dialog').addEventListener('cancel', (e) => { if (importBusy) e.preventDefault(); });
document.addEventListener('keydown', (e) => {
  const typing = ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
  if ($('#dialog').open || loading) return;
  if (e.key === 'Escape') { resetTool({ save: false }); render(); return; }
  if (typing) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(e.shiftKey); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); undo(true); }
  else if (e.key === '/') { e.preventDefault(); $('#search').focus(); document.body.classList.add('sidebar-open'); }
  else if (mode === 'edit' && !e.ctrlKey && !e.metaKey) {
    const shortcut = { v:'select', d:'split', r:'trim', n:'node' }[e.key.toLowerCase()]; if (shortcut) activateTool(shortcut);
  }
});
window.addEventListener('beforeunload', (e) => { if (savedRevision !== revision || vertexDirty) { e.preventDefault(); e.returnValue = ''; } });
new ResizeObserver(() => map.invalidateSize()).observe($('.map-workspace'));

render();
try {
  const stored = await loadProject(); if (stored) project = validateProject(stored);
  $('#save-status').innerHTML = `${icon('hard-drive')} Guardado en este navegador`;
} catch {
  storageError = true; $('#save-status').innerHTML = `${icon('info')} Guardado local no disponible`;
  toast('No pudimos abrir el guardado local. Podés trabajar y exportar un respaldo .json.', true);
}
loading = false; render();
// The map and data remain browser-local; no uploaded file is sent to a server.
