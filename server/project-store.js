import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { validateProject } from '../src/model.js';

export class ProjectStoreError extends Error {
  constructor(message, status = 500, details = {}) {
    super(message);
    this.status = status;
    Object.assign(this, details);
  }
}

export function createProjectStore(directory) {
  const file = path.resolve(directory, 'proyecto.json');
  let writes = Promise.resolve();

  async function read() {
    let text;
    try { text = await readFile(file, 'utf8'); }
    catch (error) {
      if (error.code === 'ENOENT') return { project: null, revision: null };
      throw new ProjectStoreError('No se pudo leer data/proyecto.json. Revisá los permisos de la carpeta de datos.');
    }
    try {
      return { project: validateProject(JSON.parse(text)), revision: createHash('sha256').update(text).digest('hex') };
    } catch {
      throw new ProjectStoreError('El proyecto guardado contiene datos inválidos. Conservá una copia de data/proyecto.json y corregilo antes de continuar.');
    }
  }

  function write(value, baseRevision) {
    const operation = writes.catch(() => {}).then(async () => {
      let project;
      try { project = validateProject(value); }
      catch (error) { throw new ProjectStoreError(error.message, 400); }
      const current = await read();
      if (current.revision !== baseRevision) {
        throw new ProjectStoreError('El proyecto del repositorio cambió en otra pestaña o instancia.', 409, { revision: current.revision, project: current.project });
      }
      await mkdir(path.dirname(file), { recursive: true });
      const temporary = path.join(path.dirname(file), `.proyecto-${randomUUID()}.tmp`);
      const text = `${JSON.stringify(project, null, 2)}\n`;
      try {
        const handle = await open(temporary, 'wx');
        try { await handle.writeFile(text, 'utf8'); await handle.sync(); }
        finally { await handle.close(); }
        await rename(temporary, file);
      } catch {
        throw new ProjectStoreError('No se pudo guardar data/proyecto.json. Revisá el espacio disponible y los permisos de la carpeta de datos.');
      } finally { await unlink(temporary).catch(() => {}); }
      return { project, revision: createHash('sha256').update(text).digest('hex') };
    });
    writes = operation;
    return operation;
  }
  return { file, read, write };
}
