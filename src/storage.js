import { emptyProject, validateProject } from './model.js';

let database;
const state = { mode: 'loading', revision: null, hasProject: false, conflict: null };
export const getStorageStatus = () => ({ ...state });
async function db() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('trama-local', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(request.error); };
  });
  return database;
}
async function readCache() {
  const database = await db();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('projects');
    const project = transaction.objectStore('projects').get('current');
    const sync = transaction.objectStore('projects').get('sync');
    transaction.oncomplete = () => resolve({ project: project.result || null, sync: sync.result || null });
    transaction.onerror = () => reject(transaction.error);
  });
}
async function writeCache(project, sync) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('projects', 'readwrite');
    transaction.objectStore('projects').put(project, 'current');
    transaction.objectStore('projects').put(sync, 'sync');
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
async function reply(response) {
  let result;
  try { result = await response.json(); }
  catch { throw new Error('El servidor no devolvió un proyecto válido. Iniciá la app con npm start.'); }
  if (!response.ok) {
    const error = new Error(result.error || 'No se pudo guardar el proyecto en el repositorio.');
    if (result.code === 'conflict') {
      state.conflict = { revision: result.revision, project: result.project };
      error.code = 'conflict';
    }
    throw error;
  }
  if (result.storage !== 'repository') throw new Error('El servidor no admite el guardado de proyectos en archivos.');
  return result;
}
function conflictError() {
  const error = new Error('Hay dos versiones del proyecto. Resolvé el guardado para continuar sincronizando con el repositorio.');
  error.code = 'conflict';
  return error;
}
export async function loadProject() {
  state.mode = 'unavailable';
  const cached = await readCache().catch(() => null);
  let response;
  try { response = await fetch('/api/project', { cache: 'no-store' }); }
  catch { throw new Error('No se pudo conectar con el guardado del repositorio. Comprobá que el servidor local esté funcionando.'); }
  if (response.status === 404) {
    state.mode = 'browser';
    return cached?.project || null;
  }
  const stored = await reply(response);
  state.mode = 'repository'; state.revision = stored.revision; state.hasProject = !!stored.project;
  if (cached?.sync?.pending && cached.project) {
    const local = validateProject(cached.project);
    if (stored.project && JSON.stringify(local) === JSON.stringify(stored.project)) {
      await writeCache(stored.project, { pending: false, baseRevision: stored.revision }).catch(() => {});
      return stored.project;
    }
    if (cached.sync.baseRevision !== stored.revision) {
      state.conflict = { revision: stored.revision, project: stored.project };
      return local;
    }
    await saveProject(local);
    return local;
  }
  if (!stored.project && cached?.project) {
    const migrated = validateProject(cached.project);
    await saveProject(migrated);
    return migrated;
  }
  if (stored.project) await writeCache(stored.project, { pending: false, baseRevision: stored.revision }).catch(() => {});
  return stored.project;
}
export async function saveProject(project) {
  if (state.mode === 'browser') return writeCache(project, { pending: false, baseRevision: null });
  if (state.mode !== 'repository') throw new Error('El guardado del repositorio no está disponible. Recargá la app para volver a conectar; exportá tus cambios como respaldo.');
  await writeCache(project, { pending: true, baseRevision: state.revision }).catch(() => {});
  if (state.conflict) throw conflictError();
  let response;
  try {
    response = await fetch('/api/project', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project, baseRevision: state.revision }) });
  } catch { throw new Error('No se pudo guardar en el repositorio. Tus cambios siguen en esta sesión; comprobá el servidor y reintentá.'); }
  const saved = await reply(response);
  state.revision = saved.revision; state.hasProject = true;
  await writeCache(project, { pending: false, baseRevision: saved.revision }).catch(() => {});
}
export async function resolveRepositoryConflict(strategy, localProject) {
  if (!state.conflict) return localProject;
  const conflict = state.conflict;
  state.revision = conflict.revision;
  state.hasProject = !!conflict.project;
  state.conflict = null;
  if (strategy === 'local') {
    await saveProject(localProject);
    return localProject;
  }
  const stored = conflict.project ? validateProject(conflict.project) : emptyProject();
  await writeCache(stored, { pending: false, baseRevision: state.revision }).catch(() => {});
  return stored;
}
